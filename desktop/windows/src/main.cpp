#include <windows.h>
#include <bcrypt.h>
#include <devguid.h>
#include <setupapi.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <urlmon.h>
#include <wininet.h>
#include <winspool.h>
#include <wrl.h>

#include <algorithm>
#include <array>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#include "WebView2.h"
#include "resource.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"CineCruzeiroDesktopWindow";
constexpr wchar_t kWindowTitle[] = L"Painel Cine Cruzeiro";
constexpr wchar_t kAppVersion[] = L"1.1.1";
constexpr wchar_t kDefaultAdminUrl[] = L"https://lumixengine.com/projects/cinecruzeiro/admin";
constexpr wchar_t kUpdateManifestUrl[] = L"https://lumixengine.com/projects/cinecruzeiro/api/desktop/update/latest.ini";
constexpr UINT_PTR kReconnectTimer = 1;
constexpr UINT_PTR kUpdateTimer = 2;
constexpr UINT kUpdateReadyMessage = WM_APP + 20;
constexpr UINT kUpdateIntervalMs = 6 * 60 * 60 * 1000;

struct UpdateResult {
  bool ready = false;
  std::wstring version;
  std::wstring notes;
  std::filesystem::path executable;
  std::filesystem::path loader;
  std::wstring error;
};

std::wstring GetCommandValue(const std::wstring& name) {
  const std::wstring prefix = L"--" + name + L"=";
  int count = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &count);
  if (!arguments) return {};
  std::wstring value;
  for (int i = 1; i < count; ++i) {
    const std::wstring argument(arguments[i]);
    if (argument.rfind(prefix, 0) == 0) { value = argument.substr(prefix.size()); break; }
  }
  LocalFree(arguments);
  return value;
}

bool HasCommandFlag(const std::wstring& name) {
  const std::wstring expected = L"--" + name;
  int count = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &count);
  if (!arguments) return false;
  bool found = false;
  for (int i = 1; i < count; ++i) if (expected == arguments[i]) { found = true; break; }
  LocalFree(arguments);
  return found;
}

std::filesystem::path CurrentExecutablePath() {
  std::array<wchar_t, 32768> buffer{};
  const DWORD length = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
  return std::filesystem::path(std::wstring(buffer.data(), length));
}

std::wstring QuoteArgument(const std::wstring& value) { return L"\"" + value + L"\""; }

std::wstring LocalAppDataDirectory() {
  PWSTR path = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &path))) return L".";
  const std::filesystem::path directory = std::filesystem::path(path) / L"Cine Cruzeiro" / L"Painel Desktop";
  CoTaskMemFree(path);
  std::error_code error;
  std::filesystem::create_directories(directory, error);
  return directory.wstring();
}

void WriteLog(const std::wstring& message) {
  std::wofstream stream(std::filesystem::path(LocalAppDataDirectory()) / L"desktop.log", std::ios::app);
  if (!stream) return;
  SYSTEMTIME time{};
  GetLocalTime(&time);
  stream << time.wYear << L'-' << time.wMonth << L'-' << time.wDay << L' '
         << time.wHour << L':' << time.wMinute << L':' << time.wSecond << L' ' << message << L'\n';
}

std::wstring ReadAdminUrl() {
  std::wstring value = GetCommandValue(L"server");
  if (value.empty()) {
    wchar_t environmentValue[2048]{};
    const DWORD length = GetEnvironmentVariableW(L"CINE_CRUZEIRO_ADMIN_URL", environmentValue, 2048);
    if (length > 0 && length < 2048) value.assign(environmentValue, length);
  }
  if (value.empty()) value = kDefaultAdminUrl;
  while (value.size() > 1 && value.back() == L'/') value.pop_back();
  if (value.size() < 6 || value.substr(value.size() - 6) != L"/admin") value += L"/admin";
  return value;
}

struct UrlParts { std::wstring scheme; std::wstring host; INTERNET_PORT port = 0; bool valid = false; };

UrlParts ParseUrl(const std::wstring& url) {
  wchar_t scheme[32]{}, host[INTERNET_MAX_HOST_NAME_LENGTH]{};
  URL_COMPONENTSW components{};
  components.dwStructSize = sizeof(components);
  components.lpszScheme = scheme; components.dwSchemeLength = static_cast<DWORD>(std::size(scheme));
  components.lpszHostName = host; components.dwHostNameLength = static_cast<DWORD>(std::size(host));
  if (!InternetCrackUrlW(url.c_str(), 0, ICU_DECODE, &components)) return {};
  UrlParts result;
  result.scheme.assign(scheme, components.dwSchemeLength); result.host.assign(host, components.dwHostNameLength);
  const auto lower = [](wchar_t c) { return static_cast<wchar_t>(std::towlower(c)); };
  std::transform(result.scheme.begin(), result.scheme.end(), result.scheme.begin(), lower);
  std::transform(result.host.begin(), result.host.end(), result.host.begin(), lower);
  result.port = components.nPort; result.valid = !result.scheme.empty() && !result.host.empty();
  return result;
}

bool SameOrigin(const std::wstring& first, const std::wstring& second) {
  const UrlParts a = ParseUrl(first), b = ParseUrl(second);
  return a.valid && b.valid && a.scheme == b.scheme && a.host == b.host && a.port == b.port;
}

std::wstring HtmlEscape(const std::wstring& value) {
  std::wstring result;
  for (const wchar_t c : value) {
    if (c == L'&') result += L"&amp;"; else if (c == L'<') result += L"&lt;";
    else if (c == L'>') result += L"&gt;"; else if (c == L'\"') result += L"&quot;"; else result += c;
  }
  return result;
}

std::wstring JsonEscape(const std::wstring& value) {
  std::wstring result;
  for (const wchar_t c : value) {
    if (c == L'\\') result += L"\\\\"; else if (c == L'\"') result += L"\\\"";
    else if (c == L'\n') result += L"\\n"; else if (c != L'\r') result += c;
  }
  return result;
}

std::wstring JsonArray(const std::vector<std::wstring>& values) {
  std::wstring result = L"[";
  for (size_t i = 0; i < values.size(); ++i) { if (i) result += L','; result += L"\"" + JsonEscape(values[i]) + L"\""; }
  return result + L"]";
}

std::vector<std::wstring> EnumeratePrinters(std::wstring& defaultPrinter) {
  DWORD length = 0;
  GetDefaultPrinterW(nullptr, &length);
  if (length) { std::vector<wchar_t> value(length); if (GetDefaultPrinterW(value.data(), &length)) defaultPrinter = value.data(); }
  DWORD needed = 0, returned = 0;
  EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, nullptr, 4, nullptr, 0, &needed, &returned);
  if (!needed) return {};
  std::vector<BYTE> buffer(needed);
  if (!EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, nullptr, 4, buffer.data(), needed, &needed, &returned)) return {};
  auto* printers = reinterpret_cast<PRINTER_INFO_4W*>(buffer.data());
  std::vector<std::wstring> result;
  for (DWORD i = 0; i < returned; ++i) if (printers[i].pPrinterName) result.emplace_back(printers[i].pPrinterName);
  return result;
}

std::vector<std::wstring> EnumerateDeviceClass(const GUID& deviceClass) {
  HDEVINFO devices = SetupDiGetClassDevsW(&deviceClass, nullptr, nullptr, DIGCF_PRESENT);
  if (devices == INVALID_HANDLE_VALUE) return {};
  std::vector<std::wstring> result;
  SP_DEVINFO_DATA device{}; device.cbSize = sizeof(device);
  for (DWORD i = 0; SetupDiEnumDeviceInfo(devices, i, &device); ++i) {
    std::array<wchar_t, 512> name{}; DWORD type = 0, needed = 0;
    if (!SetupDiGetDeviceRegistryPropertyW(devices, &device, SPDRP_FRIENDLYNAME, &type, reinterpret_cast<PBYTE>(name.data()), static_cast<DWORD>(name.size() * sizeof(wchar_t)), &needed))
      SetupDiGetDeviceRegistryPropertyW(devices, &device, SPDRP_DEVICEDESC, &type, reinterpret_cast<PBYTE>(name.data()), static_cast<DWORD>(name.size() * sizeof(wchar_t)), &needed);
    if (name[0]) result.emplace_back(name.data());
  }
  SetupDiDestroyDeviceInfoList(devices);
  return result;
}

std::wstring BuildComponentsJson() {
  std::wstring defaultPrinter;
  const auto printers = EnumeratePrinters(defaultPrinter);
  auto cameras = EnumerateDeviceClass(GUID_DEVCLASS_CAMERA);
  const auto images = EnumerateDeviceClass(GUID_DEVCLASS_IMAGE);
  cameras.insert(cameras.end(), images.begin(), images.end());
  std::sort(cameras.begin(), cameras.end()); cameras.erase(std::unique(cameras.begin(), cameras.end()), cameras.end());
  const auto ports = EnumerateDeviceClass(GUID_DEVCLASS_PORTS);
  LPWSTR runtimeRaw = nullptr; std::wstring runtime = L"Não identificado";
  if (SUCCEEDED(GetAvailableCoreWebView2BrowserVersionString(nullptr, &runtimeRaw)) && runtimeRaw) { runtime = runtimeRaw; CoTaskMemFree(runtimeRaw); }
  return L"{\"type\":\"desktop.components\",\"payload\":{" L"\"appVersion\":\"" + std::wstring(kAppVersion) + L"\","
    L"\"windows\":\"Windows x64\",\"webViewRuntime\":\"" + JsonEscape(runtime) + L"\",\"monitorCount\":" + std::to_wstring(GetSystemMetrics(SM_CMONITORS)) + L","
    L"\"defaultPrinter\":\"" + JsonEscape(defaultPrinter.empty() ? L"Nenhuma definida" : defaultPrinter) + L"\",\"printers\":" + JsonArray(printers) +
    L",\"cameras\":" + JsonArray(cameras) + L",\"ports\":" + JsonArray(ports) + L"}}";
}

std::array<int, 3> ParseVersion(const std::wstring& version) {
  std::array<int, 3> parts{}; swscanf_s(version.c_str(), L"%d.%d.%d", &parts[0], &parts[1], &parts[2]); return parts;
}

std::wstring ReadIniValue(const std::filesystem::path& path, const wchar_t* key) {
  std::array<wchar_t, 4096> value{};
  GetPrivateProfileStringW(L"update", key, L"", value.data(), static_cast<DWORD>(value.size()), path.c_str());
  return value.data();
}

bool DownloadFile(const std::wstring& url, const std::filesystem::path& destination) {
  std::error_code error; std::filesystem::create_directories(destination.parent_path(), error); std::filesystem::remove(destination, error);
  DeleteUrlCacheEntryW(url.c_str());
  return SUCCEEDED(URLDownloadToFileW(nullptr, url.c_str(), destination.c_str(), 0, nullptr));
}

std::wstring Sha256(const std::filesystem::path& path) {
  BCRYPT_ALG_HANDLE algorithm = nullptr; BCRYPT_HASH_HANDLE hash = nullptr;
  DWORD objectLength = 0, hashLength = 0, read = 0;
  if (!BCRYPT_SUCCESS(BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0))) return {};
  if (!BCRYPT_SUCCESS(BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&objectLength), sizeof(objectLength), &read, 0)) ||
      !BCRYPT_SUCCESS(BCryptGetProperty(algorithm, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hashLength), sizeof(hashLength), &read, 0))) { BCryptCloseAlgorithmProvider(algorithm, 0); return {}; }
  std::vector<UCHAR> object(objectLength), digest(hashLength);
  if (!BCRYPT_SUCCESS(BCryptCreateHash(algorithm, &hash, object.data(), objectLength, nullptr, 0, 0))) { BCryptCloseAlgorithmProvider(algorithm, 0); return {}; }
  std::ifstream stream(path, std::ios::binary); std::array<char, 65536> buffer{}; bool okay = static_cast<bool>(stream);
  while (okay && stream) { stream.read(buffer.data(), static_cast<std::streamsize>(buffer.size())); const auto count = stream.gcount(); if (count > 0) okay = BCRYPT_SUCCESS(BCryptHashData(hash, reinterpret_cast<PUCHAR>(buffer.data()), static_cast<ULONG>(count), 0)); }
  okay = okay && !stream.bad() && BCRYPT_SUCCESS(BCryptFinishHash(hash, digest.data(), hashLength, 0));
  BCryptDestroyHash(hash); BCryptCloseAlgorithmProvider(algorithm, 0); if (!okay) return {};
  constexpr wchar_t digits[] = L"0123456789abcdef"; std::wstring result;
  for (const UCHAR byte : digest) { result += digits[byte >> 4]; result += digits[byte & 15]; }
  return result;
}

void CheckForUpdateWorker(HWND window) {
  auto result = std::make_unique<UpdateResult>();
  const auto root = std::filesystem::path(LocalAppDataDirectory()) / L"updates";
  const auto manifest = root / L"latest.ini";
  if (!DownloadFile(kUpdateManifestUrl, manifest)) result->error = L"Não foi possível consultar novas versões.";
  else {
    result->version = ReadIniValue(manifest, L"version"); result->notes = ReadIniValue(manifest, L"notes");
    if (ParseVersion(result->version) > ParseVersion(kAppVersion)) {
      std::wstring exeHash = ReadIniValue(manifest, L"exe_sha256"), loaderHash = ReadIniValue(manifest, L"loader_sha256");
      std::transform(exeHash.begin(), exeHash.end(), exeHash.begin(), ::towlower); std::transform(loaderHash.begin(), loaderHash.end(), loaderHash.begin(), ::towlower);
      const std::wstring exeUrl = ReadIniValue(manifest, L"exe_url"), loaderUrl = ReadIniValue(manifest, L"loader_url");
      const auto stage = root / result->version; result->executable = stage / L"CineCruzeiroDesktop.exe"; result->loader = stage / L"WebView2Loader.dll";
      if (exeUrl.rfind(L"https://", 0) || loaderUrl.rfind(L"https://", 0) || !DownloadFile(exeUrl, result->executable) || !DownloadFile(loaderUrl, result->loader)) result->error = L"O download da atualização não foi concluído.";
      else if (Sha256(result->executable) != exeHash || Sha256(result->loader) != loaderHash) result->error = L"A atualização foi descartada: verificação de integridade inválida.";
      else result->ready = true;
    }
  }
  if (IsWindow(window)) PostMessageW(window, kUpdateReadyMessage, 0, reinterpret_cast<LPARAM>(result.release()));
}

bool CopyWithRetry(const std::filesystem::path& source, const std::filesystem::path& destination) {
  for (int i = 0; i < 30; ++i) { std::error_code error; std::filesystem::copy_file(source, destination, std::filesystem::copy_options::overwrite_existing, error); if (!error) return true; Sleep(500); }
  return false;
}

int ApplyPendingUpdate() {
  const std::filesystem::path target = GetCommandValue(L"target");
  const DWORD processId = static_cast<DWORD>(_wtoi(GetCommandValue(L"pid").c_str()));
  if (target.empty() || !processId) return 2;
  if (HANDLE process = OpenProcess(SYNCHRONIZE, FALSE, processId)) { WaitForSingleObject(process, 30000); CloseHandle(process); }
  const auto source = CurrentExecutablePath().parent_path(), targetExe = target / L"CineCruzeiroDesktop.exe";
  if (!CopyWithRetry(source / L"CineCruzeiroDesktop.exe", targetExe) || !CopyWithRetry(source / L"WebView2Loader.dll", target / L"WebView2Loader.dll")) {
    MessageBoxW(nullptr, L"Não foi possível concluir a atualização.", kWindowTitle, MB_OK | MB_ICONERROR); return 3;
  }
  ShellExecuteW(nullptr, L"open", targetExe.c_str(), nullptr, target.c_str(), SW_SHOWNORMAL); return 0;
}

constexpr wchar_t kDesktopBridgeScript[] = LR"JS(
(() => {
  const ensure = () => {
    if (document.getElementById('cine-desktop-tools')) return;
    const style = document.createElement('style');
    style.textContent = `
      #cine-desktop-tools{position:relative;z-index:2147483646;display:block;font-family:"Segoe UI",sans-serif;flex:0 0 auto}
      #cine-desktop-tools.cine-desktop-floating{position:fixed;right:14px;bottom:14px}
      .cine-desktop-trigger{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid #2b3a53;border-radius:7px;background:#172235;color:#f3f6fb;cursor:pointer;box-shadow:0 6px 20px #0005}
      .cine-desktop-trigger svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .cine-desktop-menu{position:absolute;right:0;top:calc(100% + 8px);display:grid;min-width:190px;padding:6px;border:1px solid #2b3a53;border-radius:7px;background:#0d1420;box-shadow:0 16px 45px #000a}
      #cine-desktop-tools.cine-desktop-floating .cine-desktop-menu{top:auto;bottom:calc(100% + 8px)}
      .cine-desktop-menu[hidden]{display:none!important}.cine-desktop-menu .cine-desktop-button{width:100%;justify-content:flex-start;box-shadow:none;border-color:transparent;background:transparent}
      .cine-desktop-button{display:flex;align-items:center;height:34px;padding:0 12px;border:1px solid #2b3a53;border-radius:7px;background:#172235;color:#f3f6fb;font:650 12px "Segoe UI",sans-serif;cursor:pointer;box-shadow:0 6px 20px #0005}
      .cine-desktop-button:hover{border-color:#4d8dff;background:#1d2c43}.cine-desktop-button:focus-visible{outline:2px solid #f5c518;outline-offset:2px}
      #cine-desktop-update-ready{background:#f5c518;color:#050914;border-color:#f5c518;display:none}
      #cine-device-backdrop{position:fixed;inset:0;z-index:2147483647;display:none;place-items:center;background:#03060dcc;padding:24px;font-family:"Segoe UI",sans-serif}
      #cine-device-dialog{width:min(720px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;background:#0d1420;color:#f3f6fb;border:1px solid #233047;border-radius:8px;box-shadow:0 30px 100px #000b}
      .cine-device-head{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;padding:20px 22px;background:#0d1420;border-bottom:1px solid #233047}.cine-device-head h2{font-size:20px;margin:0}
      .cine-device-content{padding:22px;display:grid;gap:18px}.cine-device-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.cine-device-stat{padding:12px;background:#172235;border-radius:7px}.cine-device-stat b{display:block;font-size:18px;color:#f5c518}.cine-device-stat span{font-size:11px;color:#9aa8bd}
      .cine-device-group{padding-top:14px;border-top:1px solid #233047}.cine-device-group h3{font-size:12px;text-transform:uppercase;color:#9aa8bd;margin:0 0 8px}.cine-device-group ul{margin:0;padding:0;list-style:none;display:grid;gap:6px}.cine-device-group li{padding:9px 11px;background:#101a29;border-radius:6px;font-size:13px}.cine-device-empty{color:#9aa8bd;font-size:13px}
      @media(max-width:700px){#cine-desktop-tools.cine-desktop-floating{right:8px;bottom:8px}.cine-device-summary{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
)JS";

constexpr wchar_t kDesktopBridgeScriptActions[] = LR"JS(
    const tools = document.createElement('div'); tools.id = 'cine-desktop-tools';
    const trigger = document.createElement('button'); trigger.className='cine-desktop-trigger'; trigger.type='button'; trigger.title='Opções do aplicativo'; trigger.setAttribute('aria-label','Abrir opções do aplicativo'); trigger.setAttribute('aria-expanded','false'); trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>';
    const menu = document.createElement('div'); menu.className='cine-desktop-menu'; menu.hidden=true;
    const devices = document.createElement('button'); devices.className='cine-desktop-button'; devices.textContent='Dispositivos'; devices.title='Identificar impressoras, câmeras e portas conectadas'; devices.onclick=()=>chrome.webview.postMessage('discover_components');
    const fullscreen = document.createElement('button'); fullscreen.className='cine-desktop-button'; fullscreen.textContent='Tela cheia'; fullscreen.title='Alternar tela cheia (F11)'; fullscreen.onclick=()=>chrome.webview.postMessage('toggle_fullscreen');
    const update = document.createElement('button'); update.id='cine-desktop-update-ready'; update.className='cine-desktop-button'; update.textContent='Atualização pronta'; update.onclick=()=>chrome.webview.postMessage('install_update');
    menu.append(devices, fullscreen, update); tools.append(trigger, menu);
    const topbarActions=document.querySelector('.topbar-actions');
    if(topbarActions)topbarActions.insertBefore(tools,document.getElementById('logoutButton'));else{tools.classList.add('cine-desktop-floating');document.body.appendChild(tools)}
    trigger.onclick=()=>{menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden))};
    document.addEventListener('click',event=>{if(!tools.contains(event.target)){menu.hidden=true;trigger.setAttribute('aria-expanded','false')}});
    const backdrop=document.createElement('div'); backdrop.id='cine-device-backdrop'; backdrop.setAttribute('role','dialog'); backdrop.setAttribute('aria-modal','true'); backdrop.setAttribute('aria-label','Dispositivos deste computador');
    backdrop.innerHTML='<section id="cine-device-dialog"><header class="cine-device-head"><h2>Dispositivos deste computador</h2><button class="cine-desktop-button" type="button">Fechar</button></header><div class="cine-device-content"><p class="cine-device-empty">Identificando componentes...</p></div></section>';
    backdrop.querySelector('button').onclick=()=>backdrop.style.display='none'; backdrop.onclick=e=>{if(e.target===backdrop)backdrop.style.display='none'}; document.body.appendChild(backdrop);
  };
  const list=(title,values)=>{const section=document.createElement('section');section.className='cine-device-group';const h=document.createElement('h3');h.textContent=title;section.appendChild(h);if(!values.length){const p=document.createElement('p');p.className='cine-device-empty';p.textContent='Nenhum dispositivo identificado';section.appendChild(p);return section}const ul=document.createElement('ul');values.forEach(value=>{const li=document.createElement('li');li.textContent=value;ul.appendChild(li)});section.appendChild(ul);return section};
  chrome.webview.addEventListener('message',({data})=>{
    ensure();
    if(data?.type==='desktop.fullscreen') document.querySelector('#cine-desktop-tools .cine-desktop-menu button:nth-child(2)').textContent=data.active?'Sair da tela cheia':'Tela cheia';
    if(data?.type==='desktop.update'&&data.ready){const button=document.getElementById('cine-desktop-update-ready');button.style.display='block';button.textContent=`Atualizar para ${data.version}`}
    if(data?.type==='desktop.components'){
      const p=data.payload, backdrop=document.getElementById('cine-device-backdrop'), content=backdrop.querySelector('.cine-device-content');content.replaceChildren();
      const summary=document.createElement('div');summary.className='cine-device-summary';[['Impressoras',p.printers.length],['Câmeras',p.cameras.length],['Monitores',p.monitorCount]].forEach(([label,value])=>{const item=document.createElement('div');item.className='cine-device-stat';const b=document.createElement('b');b.textContent=value;const span=document.createElement('span');span.textContent=label;item.append(b,span);summary.appendChild(item)});content.appendChild(summary);
      content.append(list('Impressora padrão',[p.defaultPrinter]),list('Impressoras disponíveis',p.printers),list('Câmeras e leitores',p.cameras),list('Portas para equipamentos PDV',p.ports),list('Aplicativo e runtime',[`Painel ${p.appVersion}`,`WebView2 ${p.webViewRuntime}`,p.windows]));backdrop.style.display='grid';
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
)JS";

class DesktopWindow {
 public:
  explicit DesktopWindow(HINSTANCE instance)
      : instance_(instance), adminUrl_(ReadAdminUrl()), trustedOrigin_(adminUrl_), screenshotPath_(GetCommandValue(L"screenshot")) {
    previousPlacement_.length = sizeof(previousPlacement_);
  }

  bool Create(int showCommand) {
    WNDCLASSEXW windowClass{};
    windowClass.cbSize = sizeof(windowClass); windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = WindowProcedure; windowClass.hInstance = instance_;
    windowClass.hIcon = LoadIconW(instance_, MAKEINTRESOURCEW(IDI_APP_ICON)); windowClass.hIconSm = windowClass.hIcon;
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW); windowClass.hbrBackground = CreateSolidBrush(RGB(5, 9, 20)); windowClass.lpszClassName = kWindowClass;
    if (!RegisterClassExW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return false;
    window_ = CreateWindowExW(0, kWindowClass, kWindowTitle, WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, CW_USEDEFAULT, CW_USEDEFAULT, 1440, 900, nullptr, nullptr, instance_, this);
    if (!window_) return false;
    ShowWindow(window_, showCommand); UpdateWindow(window_);
    if (HasCommandFlag(L"fullscreen")) ToggleFullscreen();
    InitializeWebView(); return true;
  }

 private:
  static LRESULT CALLBACK WindowProcedure(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
    DesktopWindow* self = reinterpret_cast<DesktopWindow*>(GetWindowLongPtrW(window, GWLP_USERDATA));
    if (message == WM_NCCREATE) { const auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam); self = static_cast<DesktopWindow*>(create->lpCreateParams); self->window_ = window; SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self)); }
    return self ? self->HandleMessage(message, wParam, lParam) : DefWindowProcW(window, message, wParam, lParam);
  }

  LRESULT HandleMessage(UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
      case WM_SIZE: ResizeWebView(); return 0;
      case WM_GETMINMAXINFO: reinterpret_cast<MINMAXINFO*>(lParam)->ptMinTrackSize = {960, 640}; return 0;
      case WM_TIMER:
        if (wParam == kReconnectTimer) { KillTimer(window_, kReconnectTimer); NavigateHome(); }
        if (wParam == kUpdateTimer) CheckForUpdates();
        return 0;
      case kUpdateReadyMessage: HandleUpdateResult(std::unique_ptr<UpdateResult>(reinterpret_cast<UpdateResult*>(lParam))); return 0;
      case WM_SETFOCUS: if (controller_) controller_->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC); return 0;
      case WM_DESTROY: KillTimer(window_, kUpdateTimer); controller_.Reset(); webView_.Reset(); PostQuitMessage(0); return 0;
      default: return DefWindowProcW(window_, message, wParam, lParam);
    }
  }

  void InitializeWebView() {
    const std::wstring userData = LocalAppDataDirectory() + L"\\WebView2";
    if (HasCommandFlag(L"reset-session")) { std::error_code error; std::filesystem::remove_all(userData, error); }
    WriteLog(L"Inicializando WebView2 " + std::wstring(kAppVersion) + L" em " + adminUrl_);
    const HRESULT result = CreateCoreWebView2EnvironmentWithOptions(nullptr, userData.c_str(), nullptr,
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([this](HRESULT environmentResult, ICoreWebView2Environment* environment)->HRESULT {
        if (FAILED(environmentResult) || !environment) { ShowInitializationError(environmentResult); return S_OK; }
        environment_ = environment;
        return environment_->CreateCoreWebView2Controller(window_, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([this](HRESULT controllerResult, ICoreWebView2Controller* controller)->HRESULT {
          if (FAILED(controllerResult) || !controller) { ShowInitializationError(controllerResult); return S_OK; }
          controller_ = controller; controller_->get_CoreWebView2(&webView_); controller_->put_IsVisible(TRUE);
          ConfigureWebView(); ResizeWebView(); NavigateHome(); CheckForUpdates(); SetTimer(window_, kUpdateTimer, kUpdateIntervalMs, nullptr); return S_OK;
        }).Get());
      }).Get());
    if (FAILED(result)) ShowInitializationError(result);
  }

  void ConfigureWebView() {
    ComPtr<ICoreWebView2Settings> settings;
    if (SUCCEEDED(webView_->get_Settings(&settings))) {
      settings->put_IsStatusBarEnabled(FALSE); settings->put_AreDefaultScriptDialogsEnabled(TRUE);
      settings->put_IsZoomControlEnabled(TRUE); settings->put_AreDevToolsEnabled(HasCommandFlag(L"devtools") ? TRUE : FALSE);
    }
    ComPtr<ICoreWebView2Settings2> settings2;
    if (SUCCEEDED(settings.As(&settings2))) settings2->put_UserAgent((L"CineCruzeiroDesktop/" + std::wstring(kAppVersion) + L" (Windows; WebView2) CineCruzeiroAdmin").c_str());
    COREWEBVIEW2_COLOR background{255, 5, 9, 20};
    ComPtr<ICoreWebView2Controller2> controller2;
    if (SUCCEEDED(controller_.As(&controller2))) controller2->put_DefaultBackgroundColor(background);

    controller_->add_AcceleratorKeyPressed(Callback<ICoreWebView2AcceleratorKeyPressedEventHandler>(
      [this](ICoreWebView2Controller*, ICoreWebView2AcceleratorKeyPressedEventArgs* args)->HRESULT {
        COREWEBVIEW2_KEY_EVENT_KIND kind{}; UINT key = 0; args->get_KeyEventKind(&kind); args->get_VirtualKey(&key);
        if ((kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN || kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN) &&
            (key == VK_F11 || (key == VK_ESCAPE && fullscreen_))) { args->put_Handled(TRUE); ToggleFullscreen(); }
        return S_OK;
      }).Get(), &acceleratorToken_);
    const std::wstring desktopBridgeScript = std::wstring(kDesktopBridgeScript) + kDesktopBridgeScriptActions;
    webView_->AddScriptToExecuteOnDocumentCreated(desktopBridgeScript.c_str(), nullptr);

    webView_->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>(
      [this](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args)->HRESULT {
        LPWSTR uri = nullptr;
        if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
          const std::wstring target(uri); CoTaskMemFree(uri); const bool internal = SameOrigin(target, trustedOrigin_);
          if (target.rfind(L"data:", 0) != 0 && target.rfind(L"about:", 0) != 0 && !internal) {
            args->put_Cancel(TRUE); ShellExecuteW(window_, L"open", target.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
          }
        }
        return S_OK;
      }).Get(), &navigationStartingToken_);

    webView_->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>(
      [this](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args)->HRESULT {
        BOOL success = FALSE; args->get_IsSuccess(&success);
        if (success) { showingOfflinePage_ = false; CaptureScreenshot(); SendFullscreenState(); if (readyUpdate_) SendUpdateState(); }
        else if (!showingOfflinePage_) ShowOfflinePage();
        return S_OK;
      }).Get(), &navigationCompletedToken_);

    webView_->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>(
      [this](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args)->HRESULT {
        LPWSTR uri = nullptr; if (FAILED(args->get_Uri(&uri)) || !uri) return S_OK;
        const std::wstring target(uri); CoTaskMemFree(uri); args->put_Handled(TRUE);
        if (SameOrigin(target, trustedOrigin_)) webView_->Navigate(target.c_str());
        else ShellExecuteW(window_, L"open", target.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        return S_OK;
      }).Get(), &newWindowToken_);

    webView_->add_PermissionRequested(Callback<ICoreWebView2PermissionRequestedEventHandler>(
      [this](ICoreWebView2*, ICoreWebView2PermissionRequestedEventArgs* args)->HRESULT {
        COREWEBVIEW2_PERMISSION_KIND kind; LPWSTR uri = nullptr;
        if (FAILED(args->get_PermissionKind(&kind)) || FAILED(args->get_Uri(&uri))) return S_OK;
        const bool trusted = uri && SameOrigin(uri, trustedOrigin_); if (uri) CoTaskMemFree(uri);
        args->put_State(trusted && kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA ? COREWEBVIEW2_PERMISSION_STATE_ALLOW : COREWEBVIEW2_PERMISSION_STATE_DEFAULT);
        return S_OK;
      }).Get(), &permissionToken_);

    webView_->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>(
      [this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args)->HRESULT {
        LPWSTR raw = nullptr;
        if (SUCCEEDED(args->TryGetWebMessageAsString(&raw)) && raw) {
          const std::wstring message(raw); CoTaskMemFree(raw);
          if (message == L"retry") NavigateHome();
          else if (message == L"toggle_fullscreen") ToggleFullscreen();
          else if (message == L"discover_components") SendComponents();
          else if (message == L"install_update") InstallReadyUpdate();
          else if (message == L"check_updates") CheckForUpdates();
        }
        return S_OK;
      }).Get(), &messageToken_);

    ComPtr<ICoreWebView2_3> webView3;
    if (SUCCEEDED(webView_.As(&webView3))) webView3->add_ProcessFailed(
      Callback<ICoreWebView2ProcessFailedEventHandler>([this](ICoreWebView2*, ICoreWebView2ProcessFailedEventArgs*)->HRESULT { SetTimer(window_, kReconnectTimer, 1500, nullptr); return S_OK; }).Get(), &processFailedToken_);
  }

  void ToggleFullscreen() {
    if (!window_) return;
    if (!fullscreen_) {
      previousStyle_ = static_cast<DWORD>(GetWindowLongPtrW(window_, GWL_STYLE)); GetWindowPlacement(window_, &previousPlacement_);
      MONITORINFO monitor{sizeof(monitor)}; GetMonitorInfoW(MonitorFromWindow(window_, MONITOR_DEFAULTTONEAREST), &monitor);
      SetWindowLongPtrW(window_, GWL_STYLE, previousStyle_ & ~WS_OVERLAPPEDWINDOW);
      SetWindowPos(window_, HWND_TOP, monitor.rcMonitor.left, monitor.rcMonitor.top, monitor.rcMonitor.right - monitor.rcMonitor.left, monitor.rcMonitor.bottom - monitor.rcMonitor.top, SWP_NOOWNERZORDER | SWP_FRAMECHANGED);
      fullscreen_ = true;
    } else {
      SetWindowLongPtrW(window_, GWL_STYLE, previousStyle_); SetWindowPlacement(window_, &previousPlacement_);
      SetWindowPos(window_, nullptr, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_FRAMECHANGED); fullscreen_ = false;
    }
    SendFullscreenState();
  }

  void SendFullscreenState() {
    if (webView_) webView_->PostWebMessageAsJson(fullscreen_ ? L"{\"type\":\"desktop.fullscreen\",\"active\":true}" : L"{\"type\":\"desktop.fullscreen\",\"active\":false}");
  }
  void SendComponents() { if (webView_) { const auto json = BuildComponentsJson(); webView_->PostWebMessageAsJson(json.c_str()); } }
  void SendUpdateState() {
    if (webView_ && readyUpdate_) { const auto json = L"{\"type\":\"desktop.update\",\"ready\":true,\"version\":\"" + JsonEscape(readyUpdate_->version) + L"\"}"; webView_->PostWebMessageAsJson(json.c_str()); }
  }

  void CheckForUpdates() {
    if (updateCheckRunning_) return;
    updateCheckRunning_ = true; std::thread(CheckForUpdateWorker, window_).detach();
  }

  void HandleUpdateResult(std::unique_ptr<UpdateResult> result) {
    updateCheckRunning_ = false;
    if (!result) return;
    if (!result->error.empty()) { WriteLog(L"Atualizador: " + result->error); return; }
    if (!result->ready) { WriteLog(L"Aplicativo atualizado; versão " + std::wstring(kAppVersion)); return; }
    readyUpdate_ = std::move(result); SendUpdateState();
    const std::wstring prompt = L"A versão " + readyUpdate_->version + L" está pronta.\n\n" + readyUpdate_->notes + L"\n\nReiniciar e instalar agora?";
    if (MessageBoxW(window_, prompt.c_str(), L"Atualização disponível", MB_YESNO | MB_ICONINFORMATION) == IDYES) InstallReadyUpdate();
  }

  void InstallReadyUpdate() {
    if (!readyUpdate_ || !readyUpdate_->ready) return;
    const auto target = CurrentExecutablePath().parent_path();
    const std::wstring arguments = L"--apply-update --target=" + QuoteArgument(target.wstring()) + L" --pid=" + std::to_wstring(GetCurrentProcessId());
    SHELLEXECUTEINFOW launch{sizeof(launch)}; launch.fMask = SEE_MASK_NOCLOSEPROCESS; launch.lpFile = readyUpdate_->executable.c_str();
    launch.lpParameters = arguments.c_str(); launch.lpDirectory = readyUpdate_->executable.parent_path().c_str(); launch.nShow = SW_HIDE;
    if (!ShellExecuteExW(&launch)) { MessageBoxW(window_, L"Não foi possível iniciar a atualização.", kWindowTitle, MB_OK | MB_ICONERROR); return; }
    if (launch.hProcess) CloseHandle(launch.hProcess); DestroyWindow(window_);
  }

  void NavigateHome() { if (webView_) { showingOfflinePage_ = false; webView_->Navigate(adminUrl_.c_str()); } }

  void ShowOfflinePage() {
    if (!webView_) return; showingOfflinePage_ = true;
    const std::wstring html = LR"HTML(<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050914;color:#f3f6fb;font:14px "Segoe UI",sans-serif}.panel{width:min(520px,calc(100% - 40px));padding:32px;background:#0d1420;border:1px solid #233047;border-radius:8px}.eyebrow{color:#4d8dff;font-size:11px;font-weight:750;text-transform:uppercase}.mark{width:44px;height:4px;margin:16px 0 24px;background:#f5c518}h1{margin:0 0 12px;font-size:28px}p{color:#9aa8bd;line-height:1.55}.server{margin:20px 0;padding:12px;background:#060a12;border-radius:7px;overflow-wrap:anywhere}button{min-height:42px;padding:0 16px;border:0;border-radius:7px;background:#f5c518;font-weight:750}</style></head><body><main class="panel"><span class="eyebrow">Painel Cine Cruzeiro</span><div class="mark"></div><h1>Não foi possível conectar</h1><p>Confira a internet e tente novamente. Sua sessão continuará salva neste computador.</p><div class="server">)HTML" + HtmlEscape(adminUrl_) + LR"HTML(</div><button onclick="chrome.webview.postMessage('retry')">Tentar novamente</button></main></body></html>)HTML";
    webView_->NavigateToString(html.c_str());
  }

  void ShowInitializationError(HRESULT result) {
    WriteLog(L"Falha ao iniciar WebView2: " + std::to_wstring(result)); wchar_t message[420]{};
    swprintf_s(message, L"Não foi possível iniciar o painel (0x%08X).\n\nInstale ou atualize o Microsoft Edge WebView2 Runtime.", static_cast<unsigned int>(result));
    MessageBoxW(window_, message, kWindowTitle, MB_OK | MB_ICONERROR);
  }

  void CaptureScreenshot() {
    if (screenshotPath_.empty() || !webView_) return;
    ComPtr<IStream> stream;
    if (FAILED(SHCreateStreamOnFileEx(screenshotPath_.c_str(), STGM_CREATE | STGM_WRITE | STGM_SHARE_EXCLUSIVE, FILE_ATTRIBUTE_NORMAL, TRUE, nullptr, &stream))) return;
    const std::wstring path = screenshotPath_; screenshotPath_.clear();
    webView_->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, stream.Get(),
      Callback<ICoreWebView2CapturePreviewCompletedHandler>([stream, path](HRESULT result)->HRESULT { if (stream) stream->Commit(STGC_DEFAULT); WriteLog(L"Captura concluída: " + std::to_wstring(result) + L" " + path); return S_OK; }).Get());
  }

  void ResizeWebView() { if (controller_ && window_) { RECT bounds{}; GetClientRect(window_, &bounds); controller_->put_Bounds(bounds); } }

  HINSTANCE instance_ = nullptr; HWND window_ = nullptr;
  std::wstring adminUrl_, trustedOrigin_, screenshotPath_;
  bool showingOfflinePage_ = false, fullscreen_ = false, updateCheckRunning_ = false;
  DWORD previousStyle_ = 0; WINDOWPLACEMENT previousPlacement_{};
  std::unique_ptr<UpdateResult> readyUpdate_;
  ComPtr<ICoreWebView2Environment> environment_; ComPtr<ICoreWebView2Controller> controller_; ComPtr<ICoreWebView2> webView_;
  EventRegistrationToken navigationStartingToken_{}, navigationCompletedToken_{}, newWindowToken_{}, permissionToken_{}, messageToken_{}, processFailedToken_{}, acceleratorToken_{};
};

}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  if (HasCommandFlag(L"apply-update")) return ApplyPendingUpdate();
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); SetCurrentProcessExplicitAppUserModelID(L"CineCruzeiro.PainelDesktop");
  if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 1;
  HANDLE singleInstance = CreateMutexW(nullptr, TRUE, L"Local\\CineCruzeiroDesktopPanel");
  if (singleInstance && GetLastError() == ERROR_ALREADY_EXISTS) {
    HWND existing = FindWindowW(kWindowClass, nullptr); if (existing) { ShowWindow(existing, SW_RESTORE); SetForegroundWindow(existing); }
    CloseHandle(singleInstance); CoUninitialize(); return 0;
  }
  DesktopWindow application(instance);
  if (!application.Create(showCommand)) { MessageBoxW(nullptr, L"Não foi possível criar a janela do painel.", kWindowTitle, MB_OK | MB_ICONERROR); if (singleInstance) CloseHandle(singleInstance); CoUninitialize(); return 1; }
  MSG message{}; while (GetMessageW(&message, nullptr, 0, 0) > 0) { TranslateMessage(&message); DispatchMessageW(&message); }
  if (singleInstance) CloseHandle(singleInstance); CoUninitialize(); return static_cast<int>(message.wParam);
}
