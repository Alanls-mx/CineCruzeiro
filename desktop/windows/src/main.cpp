#include <windows.h>
#include <bcrypt.h>
#include <devguid.h>
#include <setupapi.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <urlmon.h>
#include <wininet.h>
#include <mmsystem.h>
#include <winspool.h>
#include <wrl.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <memory>
#include <sstream>
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
constexpr wchar_t kAppVersion[] = L"1.3.3";
constexpr wchar_t kDefaultAdminUrl[] = L"https://lumixengine.com/projects/cinecruzeiro/admin/";
constexpr wchar_t kUpdateManifestUrl[] = L"https://lumixengine.com/projects/cinecruzeiro/api/desktop/update/latest.ini";
constexpr UINT_PTR kReconnectTimer = 1;
constexpr UINT_PTR kUpdateTimer = 2;
constexpr UINT_PTR kPrintTimer = 3;
constexpr UINT_PTR kIntroTimer = 4;
constexpr UINT_PTR kScreenshotTimer = 5;
constexpr UINT kPrintTimeoutMs = 60000;
constexpr UINT kIntroDurationMs = 3200;
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

std::wstring Base64Encode(const BYTE* data, size_t size) {
  static constexpr wchar_t alphabet[] = L"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::wstring output;
  output.reserve(((size + 2) / 3) * 4);
  for (size_t index = 0; index < size; index += 3) {
    const uint32_t value = (static_cast<uint32_t>(data[index]) << 16) |
      (index + 1 < size ? static_cast<uint32_t>(data[index + 1]) << 8 : 0) |
      (index + 2 < size ? static_cast<uint32_t>(data[index + 2]) : 0);
    output += alphabet[(value >> 18) & 63];
    output += alphabet[(value >> 12) & 63];
    output += index + 1 < size ? alphabet[(value >> 6) & 63] : L'=';
    output += index + 2 < size ? alphabet[value & 63] : L'=';
  }
  return output;
}

std::wstring EmbeddedSplashLogo(HINSTANCE instance) {
  HRSRC resource = FindResourceW(instance, MAKEINTRESOURCEW(IDR_SPLASH_LOGO), RT_RCDATA);
  if (!resource) return {};
  HGLOBAL loaded = LoadResource(instance, resource);
  const DWORD size = SizeofResource(instance, resource);
  const auto* data = static_cast<const BYTE*>(LockResource(loaded));
  if (!data || !size) return {};
  return L"data:image/webp;base64," + Base64Encode(data, size);
}

template <typename T>
void AppendWaveValue(std::vector<BYTE>& bytes, T value) {
  const auto* begin = reinterpret_cast<const BYTE*>(&value);
  bytes.insert(bytes.end(), begin, begin + sizeof(T));
}

std::vector<BYTE> BuildIntroWave() {
  constexpr uint32_t sampleRate = 44100;
  constexpr uint16_t channels = 2;
  constexpr uint16_t bitsPerSample = 16;
  constexpr double duration = 3.05;
  constexpr double pi = 3.14159265358979323846;
  const uint32_t frameCount = static_cast<uint32_t>(sampleRate * duration);
  const uint32_t dataSize = frameCount * channels * (bitsPerSample / 8);
  std::vector<BYTE> wave;
  wave.reserve(44 + dataSize);
  wave.insert(wave.end(), {'R', 'I', 'F', 'F'}); AppendWaveValue<uint32_t>(wave, 36 + dataSize);
  wave.insert(wave.end(), {'W', 'A', 'V', 'E', 'f', 'm', 't', ' '}); AppendWaveValue<uint32_t>(wave, 16);
  AppendWaveValue<uint16_t>(wave, 1); AppendWaveValue<uint16_t>(wave, channels); AppendWaveValue<uint32_t>(wave, sampleRate);
  AppendWaveValue<uint32_t>(wave, sampleRate * channels * bitsPerSample / 8);
  AppendWaveValue<uint16_t>(wave, channels * bitsPerSample / 8); AppendWaveValue<uint16_t>(wave, bitsPerSample);
  wave.insert(wave.end(), {'d', 'a', 't', 'a'}); AppendWaveValue<uint32_t>(wave, dataSize);

  for (uint32_t frame = 0; frame < frameCount; ++frame) {
    const double time = static_cast<double>(frame) / sampleRate;
    const double attack = (std::min)(1.0, time / 0.36);
    const double release = (std::min)(1.0, (duration - time) / 0.72);
    const double bedEnvelope = attack * release;
    double signal = bedEnvelope * (
      0.23 * std::sin(2.0 * pi * 73.42 * time) +
      0.16 * std::sin(2.0 * pi * 110.00 * time) +
      0.12 * std::sin(2.0 * pi * 146.83 * time));
    if (time >= 1.18) {
      const double bellTime = time - 1.18;
      const double bell = std::exp(-1.35 * bellTime) * (std::min)(1.0, bellTime / 0.05);
      signal += bell * (0.19 * std::sin(2.0 * pi * 293.66 * bellTime) +
                        0.14 * std::sin(2.0 * pi * 369.99 * bellTime) +
                        0.11 * std::sin(2.0 * pi * 440.00 * bellTime));
    }
    if (time < 0.22) {
      const double transient = std::exp(-18.0 * time);
      signal += transient * 0.08 * std::sin(2.0 * pi * (88.0 + 520.0 * time) * time);
    }
    signal = std::clamp(signal, -0.82, 0.82);
    const int16_t left = static_cast<int16_t>(signal * 32767.0);
    const int16_t right = static_cast<int16_t>(signal * (0.96 + 0.04 * std::sin(2.0 * pi * 0.4 * time)) * 32767.0);
    AppendWaveValue<int16_t>(wave, left); AppendWaveValue<int16_t>(wave, right);
  }
  return wave;
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

struct PrinterDetails {
  std::wstring name;
  std::wstring driver;
  std::wstring port;
};

std::vector<PrinterDetails> PhysicalPrinters() {
  DWORD needed = 0, returned = 0;
  EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, nullptr, 2, nullptr, 0, &needed, &returned);
  if (!needed) return {};
  std::vector<BYTE> buffer(needed);
  if (!EnumPrintersW(PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS, nullptr, 2, buffer.data(), needed, &needed, &returned)) return {};
  const auto* entries = reinterpret_cast<const PRINTER_INFO_2W*>(buffer.data());
  std::vector<PrinterDetails> result;
  for (DWORD i = 0; i < returned; ++i) {
    PrinterDetails printer{entries[i].pPrinterName ? entries[i].pPrinterName : L"",
                           entries[i].pDriverName ? entries[i].pDriverName : L"",
                           entries[i].pPortName ? entries[i].pPortName : L""};
    std::wstring identity = printer.name + L" " + printer.driver;
    std::wstring port = printer.port;
    std::transform(identity.begin(), identity.end(), identity.begin(), [](wchar_t ch) { return std::towlower(ch); });
    std::transform(port.begin(), port.end(), port.begin(), [](wchar_t ch) { return std::towlower(ch); });
    const bool virtualPrinter = identity.find(L"pdf") != std::wstring::npos ||
      identity.find(L"xps") != std::wstring::npos || identity.find(L"onenote") != std::wstring::npos ||
      identity.find(L"fax") != std::wstring::npos || port.find(L"portprompt:") != std::wstring::npos ||
      port.find(L"file:") != std::wstring::npos || port.find(L"nul:") != std::wstring::npos ||
      port.find(L"shrfax:") != std::wstring::npos;
    if (!printer.name.empty() && !virtualPrinter) result.push_back(std::move(printer));
  }
  return result;
}

std::filesystem::path PrinterSettingsPath() {
  return std::filesystem::path(LocalAppDataDirectory()) / L"printer.ini";
}

struct PrintPrinterChoice {
  std::wstring name;
  std::wstring message;
};

PrintPrinterChoice ChoosePrintPrinter() {
  const auto printers = PhysicalPrinters();
  if (printers.empty()) return {L"", L"Nenhuma impressora física está instalada. Instale a térmica e tente novamente."};
  wchar_t configured[512]{};
  GetPrivateProfileStringW(L"printing", L"printer", L"", configured, static_cast<DWORD>(std::size(configured)), PrinterSettingsPath().c_str());
  if (configured[0]) {
    for (const auto& printer : printers) if (printer.name == configured) return {printer.name, L""};
    return {L"", L"A impressora selecionada não está disponível. Escolha outra em Dispositivos."};
  }
  std::wstring defaultPrinter;
  EnumeratePrinters(defaultPrinter);
  for (const auto& printer : printers) if (printer.name == defaultPrinter) return {printer.name, L""};
  if (printers.size() == 1) return {printers[0].name, L""};
  return {L"", L"Selecione uma impressora física em Dispositivos antes de vender."};
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
  const auto physicalPrinters = PhysicalPrinters();
  std::vector<std::wstring> physicalPrinterNames;
  for (const auto& printer : physicalPrinters) physicalPrinterNames.push_back(printer.name);
  wchar_t configuredPrinter[512]{};
  GetPrivateProfileStringW(L"printing", L"printer", L"", configuredPrinter, static_cast<DWORD>(std::size(configuredPrinter)), PrinterSettingsPath().c_str());
  const auto printPrinter = ChoosePrintPrinter();
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
    L",\"physicalPrinters\":" + JsonArray(physicalPrinterNames) + L",\"configuredPrinter\":\"" + JsonEscape(configuredPrinter) +
    L"\",\"printPrinter\":\"" + JsonEscape(printPrinter.name) + L"\",\"printError\":\"" + JsonEscape(printPrinter.message) + L"\"" +
    L",\"cameras\":" + JsonArray(cameras) + L",\"ports\":" + JsonArray(ports) + L"}}";
}

std::array<int, 3> ParseVersion(const std::wstring& version) {
  std::array<int, 3> parts{}; swscanf_s(version.c_str(), L"%d.%d.%d", &parts[0], &parts[1], &parts[2]); return parts;
}

std::wstring ReadIniValue(const std::filesystem::path& path, const wchar_t* key) {
  std::ifstream stream(path, std::ios::binary);
  if (!stream) return {};
  const std::string bytes(std::istreambuf_iterator<char>(stream), {});
  if (bytes.empty()) return {};
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(), static_cast<int>(bytes.size()), nullptr, 0);
  if (!length) return {};
  std::wstring content(length, L'\0');
  if (!MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.data(), static_cast<int>(bytes.size()), content.data(), length)) return {};
  std::wistringstream lines(content);
  std::wstring line;
  bool inUpdate = false;
  const std::wstring prefix = std::wstring(key) + L"=";
  while (std::getline(lines, line)) {
    if (!line.empty() && line.back() == L'\r') line.pop_back();
    if (line == L"[update]") { inUpdate = true; continue; }
    if (!line.empty() && line.front() == L'[') { inUpdate = false; continue; }
    if (inUpdate && line.rfind(prefix, 0) == 0) return line.substr(prefix.size());
  }
  return {};
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
    if (location.protocol === 'about:' || location.protocol === 'data:') return;
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
    const printerChecks=new Map();
    window.cineDesktop={
      isAvailable:true,
      printUrl:(url,jobId='print')=>chrome.webview.postMessage(`print_url|${jobId}|${new URL(url,location.href).href}`),
      checkPrinter:()=>new Promise(resolve=>{
        const id=crypto.randomUUID();
        const timer=setTimeout(()=>{printerChecks.delete(id);resolve({ready:false,message:'O aplicativo não confirmou a impressora. Tente novamente.'})},4000);
        printerChecks.set(id,result=>{clearTimeout(timer);resolve(result)});
        chrome.webview.postMessage(`check_printer|${id}`);
      })
    };
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
    if(data?.type==='desktop.print_result')window.dispatchEvent(new CustomEvent('cine-desktop-print-result',{detail:data}));
    if(data?.type==='desktop.printer_status'){
      const resolve=printerChecks.get(data.requestId);
      if(resolve){printerChecks.delete(data.requestId);resolve(data)}
    }
    if(data?.type==='desktop.components'){
      const p=data.payload, backdrop=document.getElementById('cine-device-backdrop'), content=backdrop.querySelector('.cine-device-content');content.replaceChildren();
      const summary=document.createElement('div');summary.className='cine-device-summary';[['Impressoras',p.printers.length],['Câmeras',p.cameras.length],['Monitores',p.monitorCount]].forEach(([label,value])=>{const item=document.createElement('div');item.className='cine-device-stat';const b=document.createElement('b');b.textContent=value;const span=document.createElement('span');span.textContent=label;item.append(b,span);summary.appendChild(item)});content.appendChild(summary);
      const printerSection=document.createElement('section');printerSection.className='cine-device-group';
      const printerTitle=document.createElement('h3');printerTitle.textContent='Impressora de ingressos';printerSection.appendChild(printerTitle);
      const printerSelect=document.createElement('select');printerSelect.className='cine-desktop-button';printerSelect.style.width='100%';printerSelect.style.maxWidth='420px';
      printerSelect.add(new Option('Automática (padrão físico)', ''));
      p.physicalPrinters.forEach(name=>printerSelect.add(new Option(name,name)));
      printerSelect.value=p.configuredPrinter||'';printerSelect.disabled=!p.physicalPrinters.length;
      printerSelect.onchange=()=>chrome.webview.postMessage(`set_print_printer|${printerSelect.value}`);
      printerSection.appendChild(printerSelect);
      const printerStatus=document.createElement('p');printerStatus.className='cine-device-empty';printerStatus.textContent=p.printPrinter?`Pronta: ${p.printPrinter}`:p.printError;printerSection.appendChild(printerStatus);
      content.append(printerSection,list('Impressora padrão do Windows',[p.defaultPrinter]),list('Impressoras disponíveis',p.printers),list('Câmeras e leitores',p.cameras),list('Portas para equipamentos PDV',p.ports),list('Aplicativo e runtime',[`Painel ${p.appVersion}`,`WebView2 ${p.webViewRuntime}`,p.windows]));backdrop.style.display='grid';
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();
})();
)JS";

class DesktopWindow {
 public:
  explicit DesktopWindow(HINSTANCE instance)
      : instance_(instance), adminUrl_(ReadAdminUrl()), trustedOrigin_(adminUrl_), screenshotPath_(GetCommandValue(L"screenshot")),
        introPreview_(HasCommandFlag(L"intro-preview")) {
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
        if (wParam == kPrintTimer && !printJobId_.empty()) FinishPrint(false, L"A impressora não confirmou a operação em 60 segundos.");
        if (wParam == kIntroTimer) CompleteIntro();
        if (wParam == kScreenshotTimer) { KillTimer(window_, kScreenshotTimer); CaptureScreenshot(); }
        return 0;
      case kUpdateReadyMessage: HandleUpdateResult(std::unique_ptr<UpdateResult>(reinterpret_cast<UpdateResult*>(lParam))); return 0;
      case WM_SETFOCUS: if (controller_) controller_->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC); return 0;
      case WM_DESTROY: KillTimer(window_, kUpdateTimer); KillTimer(window_, kPrintTimer); KillTimer(window_, kIntroTimer); KillTimer(window_, kScreenshotTimer); PlaySoundW(nullptr, nullptr, 0); if (printController_) printController_->Close(); printController_.Reset(); printWebView_.Reset(); controller_.Reset(); webView_.Reset(); PostQuitMessage(0); return 0;
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
          ConfigureWebView(); ResizeWebView(); ShowIntro(); CheckForUpdates(); SetTimer(window_, kUpdateTimer, kUpdateIntervalMs, nullptr); return S_OK;
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
        if (kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN || kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN) {
          if (key == VK_ESCAPE && introPlaying_) { args->put_Handled(TRUE); CompleteIntro(); }
          else if (key == VK_F11 || (key == VK_ESCAPE && fullscreen_)) { args->put_Handled(TRUE); ToggleFullscreen(); }
        }
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
        if (success && introPlaying_) { if (introPreview_) SetTimer(window_, kScreenshotTimer, 1450, nullptr); else CaptureScreenshot(); }
        else if (success) { showingOfflinePage_ = false; CaptureScreenshot(); SendFullscreenState(); if (readyUpdate_) SendUpdateState(); }
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
          if (message == L"intro_complete") CompleteIntro();
          else if (message == L"retry") NavigateHome();
          else if (message == L"toggle_fullscreen") ToggleFullscreen();
          else if (message == L"discover_components") SendComponents();
          else if (message.rfind(L"check_printer|", 0) == 0) SendPrinterStatus(message.substr(14));
          else if (message.rfind(L"set_print_printer|", 0) == 0) {
            const std::wstring selected = message.substr(18);
            const auto printers = PhysicalPrinters();
            const bool allowed = selected.empty() || std::any_of(printers.begin(), printers.end(), [&](const auto& printer) { return printer.name == selected; });
            if (allowed) WritePrivateProfileStringW(L"printing", L"printer", selected.c_str(), PrinterSettingsPath().c_str());
            SendComponents();
          }
          else if (message == L"install_update") InstallReadyUpdate();
          else if (message == L"check_updates") CheckForUpdates();
          else if (message.rfind(L"print_url|", 0) == 0) {
            const size_t separator = message.find(L'|', 10);
            if (separator != std::wstring::npos) StartPrint(message.substr(separator + 1), message.substr(10, separator - 10));
          }
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

  void SendPrintResult(const std::wstring& jobId, bool ok, const std::wstring& message) {
    if (!webView_) return;
    const std::wstring payload = L"{\"type\":\"desktop.print_result\",\"jobId\":\"" + JsonEscape(jobId) +
      L"\",\"ok\":" + (ok ? L"true" : L"false") + L",\"message\":\"" + JsonEscape(message) + L"\"}";
    webView_->PostWebMessageAsJson(payload.c_str());
  }

  void FinishPrint(bool ok, const std::wstring& message) {
    if (printJobId_.empty()) return;
    KillTimer(window_, kPrintTimer);
    const std::wstring jobId = printJobId_;
    WriteLog((ok ? L"Impressão concluída: " : L"Falha na impressão: ") + jobId + L" " + message);
    if (printController_) printController_->Close();
    printController_.Reset(); printWebView_.Reset(); printJobId_.clear(); printUrl_.clear(); printNavigationToken_ = {};
    SendPrintResult(jobId, ok, message);
  }

  void PrintLoadedDocument() {
    if (printJobId_.empty()) return;
    ComPtr<ICoreWebView2_16> printable;
    ComPtr<ICoreWebView2Environment6> environment6;
    ComPtr<ICoreWebView2PrintSettings> settings;
    if (!printWebView_ || FAILED(printWebView_.As(&printable)) || FAILED(environment_.As(&environment6)) ||
        FAILED(environment6->CreatePrintSettings(&settings))) {
      FinishPrint(false, L"O WebView2 instalado não oferece impressão silenciosa.");
      return;
    }
    const auto printer = ChoosePrintPrinter();
    if (printer.name.empty()) {
      FinishPrint(false, printer.message);
      return;
    }
    settings->put_ShouldPrintBackgrounds(TRUE);
    settings->put_ShouldPrintHeaderAndFooter(FALSE);
    settings->put_MarginTop(0); settings->put_MarginBottom(0); settings->put_MarginLeft(0); settings->put_MarginRight(0);
    ComPtr<ICoreWebView2PrintSettings2> settings2;
    if (FAILED(settings.As(&settings2)) || FAILED(settings2->put_PrinterName(printer.name.c_str()))) {
      FinishPrint(false, L"O WebView2 não conseguiu selecionar a impressora física.");
      return;
    }
    const std::wstring jobId = printJobId_;
    const HRESULT result = printable->Print(settings.Get(), Callback<ICoreWebView2PrintCompletedHandler>(
      [this, jobId](HRESULT errorCode, COREWEBVIEW2_PRINT_STATUS status)->HRESULT {
        if (printJobId_ != jobId) return S_OK;
        const bool ok = SUCCEEDED(errorCode) && status == COREWEBVIEW2_PRINT_STATUS_SUCCEEDED;
        FinishPrint(ok, ok ? L"Trabalho aceito pela impressora física selecionada." :
          status == COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE ? L"A impressora física está indisponível." : L"O Windows não confirmou a impressão.");
        return S_OK;
      }).Get());
    if (FAILED(result)) FinishPrint(false, L"Não foi possível iniciar a impressão no Windows.");
  }

  void StartPrint(const std::wstring& url, const std::wstring& jobId) {
    if (!SameOrigin(url, trustedOrigin_)) {
      SendPrintResult(jobId, false, L"A impressão foi bloqueada porque a URL não pertence ao painel.");
      return;
    }
    if (!printJobId_.empty()) {
      SendPrintResult(jobId, false, L"A impressora está ocupada com outro ingresso.");
      return;
    }
    printJobId_ = jobId; printUrl_ = url;
    SetTimer(window_, kPrintTimer, kPrintTimeoutMs, nullptr);
    environment_->CreateCoreWebView2Controller(window_, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
      [this, jobId](HRESULT result, ICoreWebView2Controller* controller)->HRESULT {
        if (printJobId_ != jobId) { if (controller) controller->Close(); return S_OK; }
        if (FAILED(result) || !controller) { FinishPrint(false, L"Não foi possível preparar o documento para impressão."); return S_OK; }
        printController_ = controller; printController_->put_IsVisible(FALSE); printController_->get_CoreWebView2(&printWebView_);
        printWebView_->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>(
          [this, jobId](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args)->HRESULT {
            if (printJobId_ != jobId) return S_OK;
            BOOL success = FALSE; args->get_IsSuccess(&success);
            if (!success) FinishPrint(false, L"Não foi possível carregar o ingresso para impressão.");
            else PrintLoadedDocument();
            return S_OK;
          }).Get(), &printNavigationToken_);
        printWebView_->Navigate(printUrl_.c_str());
        return S_OK;
      }).Get());
  }

  void SendFullscreenState() {
    if (webView_) webView_->PostWebMessageAsJson(fullscreen_ ? L"{\"type\":\"desktop.fullscreen\",\"active\":true}" : L"{\"type\":\"desktop.fullscreen\",\"active\":false}");
  }
  void SendComponents() { if (webView_) { const auto json = BuildComponentsJson(); webView_->PostWebMessageAsJson(json.c_str()); } }
  void SendPrinterStatus(const std::wstring& requestId) {
    if (!webView_) return;
    const auto printer = ChoosePrintPrinter();
    const std::wstring payload = L"{\"type\":\"desktop.printer_status\",\"requestId\":\"" + JsonEscape(requestId) +
      L"\",\"ready\":" + (printer.name.empty() ? L"false" : L"true") + L",\"printer\":\"" +
      JsonEscape(printer.name) + L"\",\"message\":\"" + JsonEscape(printer.message) + L"\"}";
    webView_->PostWebMessageAsJson(payload.c_str());
  }
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

  std::wstring BuildIntroHtml() const {
    const std::wstring logo = EmbeddedSplashLogo(instance_);
    const std::wstring timeout = introPreview_ ? L"30000" : std::to_wstring(kIntroDurationMs - 120);
    return std::wstring(LR"HTML(<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cine Cruzeiro</title><style>
      *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#03060d;color:#f7f8fb;font-family:"Segoe UI",Arial,sans-serif}
      body{display:grid;place-items:center}.intro{position:relative;isolation:isolate;width:100%;height:100%;display:grid;place-items:center;background:#03060d;box-shadow:inset 0 0 180px rgba(0,0,0,.72)}
      .grain{position:absolute;inset:0;opacity:.075;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.88' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.7'/%3E%3C/svg%3E");background-size:180px 180px;mix-blend-mode:screen;pointer-events:none}
      .beam{position:absolute;left:50%;top:50%;width:min(94vw,1180px);height:min(68vw,760px);transform:translate(-50%,-50%) scale(.42);clip-path:polygon(50% 0,100% 82%,0 82%);background:linear-gradient(180deg,rgba(77,141,255,.26),rgba(16,48,91,.06) 67%,transparent);opacity:0;animation:beam 2.7s cubic-bezier(.22,.72,.18,1) forwards}
      .horizon{position:absolute;left:50%;top:50%;width:min(74vw,920px);height:min(38vw,420px);transform:translate(-50%,-42%);border-top:1px solid rgba(245,197,24,.85);border-radius:50% 50% 0 0;opacity:0;animation:horizon 1.85s .46s cubic-bezier(.16,.72,.3,1) forwards}
      .stage{position:relative;z-index:2;display:grid;justify-items:center;gap:22px;width:min(620px,74vw);animation:stage 2.8s cubic-bezier(.18,.75,.18,1) forwards}
      .logo{display:block;width:min(390px,70vw);height:auto;max-height:240px;object-fit:contain;filter:drop-shadow(0 20px 38px rgba(0,0,0,.62));opacity:0;transform:scale(.88);animation:logo 1.45s .45s cubic-bezier(.14,.78,.2,1) forwards}
      .fallback{display:none;font-size:clamp(34px,6vw,70px);font-weight:800;text-align:center;letter-spacing:0;color:#f7f8fb}.fallback b{display:block;color:#f5c518}
      .caption{display:grid;gap:7px;text-align:center;opacity:0;transform:translateY(10px);animation:caption .75s 1.34s ease-out forwards}.caption strong{font-size:12px;letter-spacing:3.2px;text-transform:uppercase;color:#f5c518}.caption span{font-size:13px;color:#93a3ba;letter-spacing:.5px}
      .progress{position:absolute;z-index:3;left:50%;bottom:36px;width:min(280px,48vw);height:2px;transform:translateX(-50%);background:#162236;overflow:hidden}.progress::after{content:"";display:block;width:100%;height:100%;background:#f5c518;transform-origin:left;animation:progress 3.08s linear forwards}
      @keyframes beam{0%{opacity:0;transform:translate(-50%,-50%) scale(.35)}34%{opacity:.78}100%{opacity:.12;transform:translate(-50%,-50%) scale(1.06)}}
      @keyframes horizon{0%{opacity:0;transform:translate(-50%,-42%) scaleX(.15)}55%{opacity:.9}100%{opacity:.2;transform:translate(-50%,-42%) scaleX(1)}}
      @keyframes logo{0%{opacity:0;transform:scale(.88)}62%{opacity:1;transform:scale(1.02)}100%{opacity:1;transform:scale(1)}}
      @keyframes stage{0%,82%{opacity:1}100%{opacity:0;transform:scale(1.025)}}@keyframes caption{to{opacity:1;transform:none}}@keyframes progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
      @media(prefers-reduced-motion:reduce){.beam,.horizon{animation:none}.grain{opacity:.05}.stage,.logo,.caption{animation:fade .45s ease-out forwards}.progress::after{animation-duration:.8s}@keyframes fade{to{opacity:1;transform:none}}}
    </style></head><body><main class="intro" aria-label="Abertura do Painel Cine Cruzeiro"><div class="grain" aria-hidden="true"></div><div class="beam" aria-hidden="true"></div><div class="horizon" aria-hidden="true"></div><section class="stage"><img class="logo" src=)HTML") + L"\"" + HtmlEscape(logo) + L"\"" + LR"HTML( alt="Cine Cruzeiro" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="fallback">CINE <b>CRUZEIRO</b></div><div class="caption"><strong>A sess&atilde;o vai come&ccedil;ar</strong><span>Painel de opera&ccedil;&atilde;o</span></div></section><div class="progress" aria-hidden="true"></div></main><script>
      const finish=()=>{if(window.chrome?.webview)chrome.webview.postMessage('intro_complete')};
      document.addEventListener('keydown',event=>{if(event.key==='Escape')finish()});const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?850:)HTML" + timeout + LR"HTML(;setTimeout(finish,delay);
    </script></body></html>)HTML";
  }

  void PlayIntroSound() {
    if (HasCommandFlag(L"mute-intro")) return;
    introWave_ = BuildIntroWave();
    if (!introWave_.empty()) PlaySoundW(reinterpret_cast<LPCWSTR>(introWave_.data()), nullptr, SND_MEMORY | SND_ASYNC | SND_NODEFAULT);
  }

  void ShowIntro() {
    if (!webView_) return;
    if (HasCommandFlag(L"skip-intro") || (!introPreview_ && !screenshotPath_.empty())) { NavigateHome(); return; }
    introPlaying_ = true;
    webView_->NavigateToString(BuildIntroHtml().c_str());
    PlayIntroSound();
    SetTimer(window_, kIntroTimer, introPreview_ ? 30500 : kIntroDurationMs + 500, nullptr);
  }

  void CompleteIntro() {
    if (!introPlaying_) return;
    introPlaying_ = false;
    KillTimer(window_, kIntroTimer);
    PlaySoundW(nullptr, nullptr, 0);
    introWave_.clear();
    NavigateHome();
  }

  void NavigateHome() { if (webView_) { introPlaying_ = false; showingOfflinePage_ = false; webView_->Navigate(adminUrl_.c_str()); } }

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
  bool showingOfflinePage_ = false, fullscreen_ = false, updateCheckRunning_ = false, introPlaying_ = false, introPreview_ = false;
  DWORD previousStyle_ = 0; WINDOWPLACEMENT previousPlacement_{};
  std::unique_ptr<UpdateResult> readyUpdate_;
  ComPtr<ICoreWebView2Environment> environment_; ComPtr<ICoreWebView2Controller> controller_; ComPtr<ICoreWebView2> webView_;
  ComPtr<ICoreWebView2Controller> printController_; ComPtr<ICoreWebView2> printWebView_;
  std::wstring printJobId_, printUrl_;
  std::vector<BYTE> introWave_;
  EventRegistrationToken navigationStartingToken_{}, navigationCompletedToken_{}, newWindowToken_{}, permissionToken_{}, messageToken_{}, processFailedToken_{}, acceleratorToken_{};
  EventRegistrationToken printNavigationToken_{};
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
