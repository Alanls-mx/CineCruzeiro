#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <wininet.h>
#include <wrl.h>

#include <algorithm>
#include <cwctype>
#include <filesystem>
#include <fstream>
#include <string>

#include "WebView2.h"
#include "resource.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {

constexpr wchar_t kWindowClass[] = L"CineCruzeiroDesktopWindow";
constexpr wchar_t kWindowTitle[] = L"Painel Cine Cruzeiro";
constexpr wchar_t kDefaultAdminUrl[] = L"https://lumixengine.com/projects/cinecruzeiro/admin";
constexpr UINT kReconnectTimer = 1;

std::wstring GetCommandValue(const std::wstring& name) {
  const std::wstring prefix = L"--" + name + L"=";
  int count = 0;
  LPWSTR* arguments = CommandLineToArgvW(GetCommandLineW(), &count);
  if (!arguments) return {};
  std::wstring value;
  for (int index = 1; index < count; ++index) {
    const std::wstring argument(arguments[index]);
    if (argument.rfind(prefix, 0) == 0) {
      value = argument.substr(prefix.size());
      break;
    }
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
  for (int index = 1; index < count; ++index) {
    if (expected == arguments[index]) {
      found = true;
      break;
    }
  }
  LocalFree(arguments);
  return found;
}

std::wstring LocalAppDataDirectory() {
  PWSTR path = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &path))) return L".";
  std::filesystem::path directory = std::filesystem::path(path) / L"Cine Cruzeiro" / L"Painel Desktop";
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

struct UrlParts {
  std::wstring scheme;
  std::wstring host;
  INTERNET_PORT port = 0;
  bool valid = false;
};

UrlParts ParseUrl(const std::wstring& url) {
  wchar_t scheme[32]{};
  wchar_t host[INTERNET_MAX_HOST_NAME_LENGTH]{};
  URL_COMPONENTSW components{};
  components.dwStructSize = sizeof(components);
  components.lpszScheme = scheme;
  components.dwSchemeLength = static_cast<DWORD>(std::size(scheme));
  components.lpszHostName = host;
  components.dwHostNameLength = static_cast<DWORD>(std::size(host));
  if (!InternetCrackUrlW(url.c_str(), 0, ICU_DECODE, &components)) return {};
  UrlParts result;
  result.scheme.assign(scheme, components.dwSchemeLength);
  result.host.assign(host, components.dwHostNameLength);
  const auto lower = [](wchar_t character) { return static_cast<wchar_t>(std::towlower(character)); };
  std::transform(result.scheme.begin(), result.scheme.end(), result.scheme.begin(), lower);
  std::transform(result.host.begin(), result.host.end(), result.host.begin(), lower);
  result.port = components.nPort;
  result.valid = !result.scheme.empty() && !result.host.empty();
  return result;
}

bool SameOrigin(const std::wstring& first, const std::wstring& second) {
  const UrlParts left = ParseUrl(first);
  const UrlParts right = ParseUrl(second);
  return left.valid && right.valid && left.scheme == right.scheme && left.host == right.host && left.port == right.port;
}

std::wstring HtmlEscape(const std::wstring& value) {
  std::wstring result;
  result.reserve(value.size());
  for (const wchar_t character : value) {
    switch (character) {
      case L'&': result += L"&amp;"; break;
      case L'<': result += L"&lt;"; break;
      case L'>': result += L"&gt;"; break;
      case L'\"': result += L"&quot;"; break;
      default: result += character; break;
    }
  }
  return result;
}

class DesktopWindow {
 public:
  explicit DesktopWindow(HINSTANCE instance)
      : instance_(instance), adminUrl_(ReadAdminUrl()), trustedOrigin_(adminUrl_), screenshotPath_(GetCommandValue(L"screenshot")) {}

  bool Create(int showCommand) {
    WNDCLASSEXW windowClass{};
    windowClass.cbSize = sizeof(windowClass);
    windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = WindowProcedure;
    windowClass.hInstance = instance_;
    windowClass.hIcon = LoadIconW(instance_, MAKEINTRESOURCEW(IDI_APP_ICON));
    windowClass.hIconSm = windowClass.hIcon;
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    windowClass.hbrBackground = CreateSolidBrush(RGB(5, 9, 20));
    windowClass.lpszClassName = kWindowClass;
    if (!RegisterClassExW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return false;

    window_ = CreateWindowExW(
        0, kWindowClass, kWindowTitle, WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
        CW_USEDEFAULT, CW_USEDEFAULT, 1440, 900, nullptr, nullptr, instance_, this);
    if (!window_) return false;

    ShowWindow(window_, showCommand);
    UpdateWindow(window_);
    InitializeWebView();
    return true;
  }

 private:
  static LRESULT CALLBACK WindowProcedure(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
    DesktopWindow* self = reinterpret_cast<DesktopWindow*>(GetWindowLongPtrW(window, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
      const auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
      self = static_cast<DesktopWindow*>(create->lpCreateParams);
      self->window_ = window;
      SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
    }
    if (self) return self->HandleMessage(message, wParam, lParam);
    return DefWindowProcW(window, message, wParam, lParam);
  }

  LRESULT HandleMessage(UINT message, WPARAM wParam, LPARAM lParam) {
    switch (message) {
      case WM_SIZE:
        ResizeWebView();
        return 0;
      case WM_GETMINMAXINFO: {
        auto* info = reinterpret_cast<MINMAXINFO*>(lParam);
        info->ptMinTrackSize = {960, 640};
        return 0;
      }
      case WM_TIMER:
        if (wParam == kReconnectTimer) {
          KillTimer(window_, kReconnectTimer);
          NavigateHome();
        }
        return 0;
      case WM_SETFOCUS:
        if (controller_) controller_->MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC);
        return 0;
      case WM_DESTROY:
        controller_.Reset();
        webView_.Reset();
        PostQuitMessage(0);
        return 0;
      default:
        return DefWindowProcW(window_, message, wParam, lParam);
    }
  }

  void InitializeWebView() {
    const std::wstring userData = LocalAppDataDirectory() + L"\\WebView2";
    if (HasCommandFlag(L"reset-session")) {
      std::error_code error;
      std::filesystem::remove_all(userData, error);
    }

    WriteLog(L"Inicializando WebView2 em " + adminUrl_);
    HRESULT result = CreateCoreWebView2EnvironmentWithOptions(
        nullptr, userData.c_str(), nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this](HRESULT environmentResult, ICoreWebView2Environment* environment) -> HRESULT {
              if (FAILED(environmentResult) || !environment) {
                WriteLog(L"Falha ao criar ambiente WebView2: " + std::to_wstring(environmentResult));
                ShowInitializationError(environmentResult);
                return S_OK;
              }
              environment_ = environment;
              return environment_->CreateCoreWebView2Controller(
                  window_, Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                               [this](HRESULT controllerResult, ICoreWebView2Controller* controller) -> HRESULT {
                                 if (FAILED(controllerResult) || !controller) {
                                   WriteLog(L"Falha ao criar controller WebView2: " + std::to_wstring(controllerResult));
                                   ShowInitializationError(controllerResult);
                                   return S_OK;
                                 }
                                 controller_ = controller;
                                 controller_->get_CoreWebView2(&webView_);
                                 controller_->put_IsVisible(TRUE);
                                 WriteLog(L"Controller WebView2 criado");
                                 ConfigureWebView();
                                 ResizeWebView();
                                 NavigateHome();
                                 return S_OK;
                               }).Get());
            }).Get());
    if (FAILED(result)) ShowInitializationError(result);
  }

  void ConfigureWebView() {
    ComPtr<ICoreWebView2Settings> settings;
    if (SUCCEEDED(webView_->get_Settings(&settings))) {
      settings->put_IsStatusBarEnabled(FALSE);
      settings->put_AreDefaultScriptDialogsEnabled(TRUE);
      settings->put_IsZoomControlEnabled(TRUE);
      settings->put_AreDevToolsEnabled(HasCommandFlag(L"devtools") ? TRUE : FALSE);
    }

    ComPtr<ICoreWebView2Settings2> settings2;
    if (SUCCEEDED(settings.As(&settings2))) {
      settings2->put_UserAgent(L"CineCruzeiroDesktop/1.0 (Windows; WebView2) CineCruzeiroAdmin");
    }

    COREWEBVIEW2_COLOR background{255, 5, 9, 20};
    ComPtr<ICoreWebView2Controller2> controller2;
    if (SUCCEEDED(controller_.As(&controller2))) controller2->put_DefaultBackgroundColor(background);

    webView_->add_NavigationStarting(
        Callback<ICoreWebView2NavigationStartingEventHandler>(
            [this](ICoreWebView2*, ICoreWebView2NavigationStartingEventArgs* args) -> HRESULT {
              LPWSTR uri = nullptr;
              if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
                const std::wstring target(uri);
                CoTaskMemFree(uri);
                const bool internal = SameOrigin(target, trustedOrigin_);
                WriteLog(internal ? L"Navegação interna iniciada" : L"Navegação externa encaminhada ao navegador");
                if (target.rfind(L"data:", 0) != 0 && target.rfind(L"about:", 0) != 0 && !internal) {
                  args->put_Cancel(TRUE);
                  ShellExecuteW(window_, L"open", target.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
                }
              }
              return S_OK;
            }).Get(), &navigationStartingToken_);

    webView_->add_NavigationCompleted(
        Callback<ICoreWebView2NavigationCompletedEventHandler>(
            [this](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
              BOOL success = FALSE;
              args->get_IsSuccess(&success);
              COREWEBVIEW2_WEB_ERROR_STATUS status = COREWEBVIEW2_WEB_ERROR_STATUS_UNKNOWN;
              args->get_WebErrorStatus(&status);
              WriteLog(L"Navegação concluída: sucesso=" + std::to_wstring(success) + L" status=" + std::to_wstring(status));
              if (success) CaptureScreenshot();
              if (!success && !showingOfflinePage_) ShowOfflinePage();
              if (success) showingOfflinePage_ = false;
              return S_OK;
            }).Get(), &navigationCompletedToken_);

    webView_->add_NewWindowRequested(
        Callback<ICoreWebView2NewWindowRequestedEventHandler>(
            [this](ICoreWebView2*, ICoreWebView2NewWindowRequestedEventArgs* args) -> HRESULT {
              LPWSTR uri = nullptr;
              if (FAILED(args->get_Uri(&uri)) || !uri) return S_OK;
              const std::wstring target(uri);
              CoTaskMemFree(uri);
              args->put_Handled(TRUE);
              if (SameOrigin(target, trustedOrigin_)) {
                webView_->Navigate(target.c_str());
              } else {
                ShellExecuteW(window_, L"open", target.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
              }
              return S_OK;
            }).Get(), &newWindowToken_);

    webView_->add_PermissionRequested(
        Callback<ICoreWebView2PermissionRequestedEventHandler>(
            [this](ICoreWebView2*, ICoreWebView2PermissionRequestedEventArgs* args) -> HRESULT {
              COREWEBVIEW2_PERMISSION_KIND kind;
              LPWSTR uri = nullptr;
              if (FAILED(args->get_PermissionKind(&kind)) || FAILED(args->get_Uri(&uri))) return S_OK;
              const bool trusted = uri && SameOrigin(uri, trustedOrigin_);
              if (uri) CoTaskMemFree(uri);
              args->put_State(trusted && kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
                                  ? COREWEBVIEW2_PERMISSION_STATE_ALLOW
                                  : COREWEBVIEW2_PERMISSION_STATE_DEFAULT);
              return S_OK;
            }).Get(), &permissionToken_);

    webView_->add_WebMessageReceived(
        Callback<ICoreWebView2WebMessageReceivedEventHandler>(
            [this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
              LPWSTR message = nullptr;
              if (SUCCEEDED(args->TryGetWebMessageAsString(&message)) && message) {
                if (std::wstring(message) == L"retry") NavigateHome();
                CoTaskMemFree(message);
              }
              return S_OK;
            }).Get(), &messageToken_);

    ComPtr<ICoreWebView2_3> webView3;
    if (SUCCEEDED(webView_.As(&webView3))) {
      webView3->add_ProcessFailed(
          Callback<ICoreWebView2ProcessFailedEventHandler>(
              [this](ICoreWebView2*, ICoreWebView2ProcessFailedEventArgs*) -> HRESULT {
                SetTimer(window_, kReconnectTimer, 1500, nullptr);
                return S_OK;
              }).Get(), &processFailedToken_);
    }
  }

  void NavigateHome() {
    if (!webView_) return;
    showingOfflinePage_ = false;
    webView_->Navigate(adminUrl_.c_str());
  }

  void ShowOfflinePage() {
    if (!webView_) return;
    showingOfflinePage_ = true;
    const std::wstring html = LR"HTML(
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050914;color:#f3f6fb;font:14px "Segoe UI Variable","Segoe UI",sans-serif}.panel{width:min(520px,calc(100% - 40px));padding:32px;background:#0d1420;border:1px solid #233047;border-radius:8px;box-shadow:0 24px 70px #0008}.eyebrow{color:#4d8dff;font-size:11px;font-weight:750;text-transform:uppercase}.mark{width:44px;height:4px;margin:16px 0 24px;background:#f5c518}h1{margin:0 0 12px;font:760 28px Bahnschrift,"Segoe UI",sans-serif}p{margin:0;color:#9aa8bd;line-height:1.55}.server{margin:20px 0;padding:12px;background:#060a12;border-radius:7px;color:#9aa8bd;overflow-wrap:anywhere}button{min-height:42px;padding:0 16px;border:0;border-radius:7px;background:#f5c518;color:#060a12;font-weight:750;cursor:pointer}button:focus-visible{outline:2px solid #4d8dff;outline-offset:3px}</style></head>
<body><main class="panel"><span class="eyebrow">Painel Cine Cruzeiro</span><div class="mark"></div><h1>Não foi possível conectar</h1><p>Confira a internet e tente novamente. Sua sessão continuará salva neste computador.</p><div class="server">)HTML" + HtmlEscape(adminUrl_) + LR"HTML(</div><button onclick="chrome.webview.postMessage('retry')">Tentar novamente</button></main></body></html>)HTML";
    webView_->NavigateToString(html.c_str());
  }

  void ShowInitializationError(HRESULT result) {
    wchar_t message[420]{};
    swprintf_s(message, L"Não foi possível iniciar o painel (0x%08X).\n\nInstale ou atualize o Microsoft Edge WebView2 Runtime e tente novamente.", static_cast<unsigned int>(result));
    MessageBoxW(window_, message, kWindowTitle, MB_OK | MB_ICONERROR);
  }

  void CaptureScreenshot() {
    if (screenshotPath_.empty() || !webView_) return;
    ComPtr<IStream> stream;
    if (FAILED(SHCreateStreamOnFileEx(
            screenshotPath_.c_str(), STGM_CREATE | STGM_WRITE | STGM_SHARE_EXCLUSIVE,
            FILE_ATTRIBUTE_NORMAL, TRUE, nullptr, &stream))) {
      WriteLog(L"Não foi possível criar o arquivo de captura: " + screenshotPath_);
      return;
    }
    const std::wstring path = screenshotPath_;
    screenshotPath_.clear();
    webView_->CapturePreview(
        COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG, stream.Get(),
        Callback<ICoreWebView2CapturePreviewCompletedHandler>(
            [stream, path](HRESULT result) -> HRESULT {
              if (stream) stream->Commit(STGC_DEFAULT);
              WriteLog(L"Captura WebView2 concluída: resultado=" + std::to_wstring(result) + L" " + path);
              return S_OK;
            }).Get());
  }

  void ResizeWebView() {
    if (!controller_ || !window_) return;
    RECT bounds{};
    GetClientRect(window_, &bounds);
    controller_->put_Bounds(bounds);
  }

  HINSTANCE instance_ = nullptr;
  HWND window_ = nullptr;
  std::wstring adminUrl_;
  std::wstring trustedOrigin_;
  std::wstring screenshotPath_;
  bool showingOfflinePage_ = false;
  ComPtr<ICoreWebView2Environment> environment_;
  ComPtr<ICoreWebView2Controller> controller_;
  ComPtr<ICoreWebView2> webView_;
  EventRegistrationToken navigationStartingToken_{};
  EventRegistrationToken navigationCompletedToken_{};
  EventRegistrationToken newWindowToken_{};
  EventRegistrationToken permissionToken_{};
  EventRegistrationToken messageToken_{};
  EventRegistrationToken processFailedToken_{};
};

}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  SetCurrentProcessExplicitAppUserModelID(L"CineCruzeiro.PainelDesktop");
  if (FAILED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED))) return 1;

  HANDLE singleInstance = CreateMutexW(nullptr, TRUE, L"Local\\CineCruzeiroDesktopPanel");
  if (singleInstance && GetLastError() == ERROR_ALREADY_EXISTS) {
    HWND existing = FindWindowW(kWindowClass, nullptr);
    if (existing) {
      ShowWindow(existing, SW_RESTORE);
      SetForegroundWindow(existing);
    }
    CloseHandle(singleInstance);
    CoUninitialize();
    return 0;
  }

  DesktopWindow application(instance);
  if (!application.Create(showCommand)) {
    MessageBoxW(nullptr, L"Não foi possível criar a janela do painel.", kWindowTitle, MB_OK | MB_ICONERROR);
    if (singleInstance) CloseHandle(singleInstance);
    CoUninitialize();
    return 1;
  }

  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }

  if (singleInstance) CloseHandle(singleInstance);
  CoUninitialize();
  return static_cast<int>(message.wParam);
}
