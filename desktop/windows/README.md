# Painel Desktop Cine Cruzeiro

Aplicativo Windows escrito em C++20/Win32. Ele usa o Microsoft Edge WebView2 para executar a interface administrativa oficial dentro de uma janela nativa, conectada diretamente ao backend do Cine Cruzeiro.

## Recursos

- Mesma interface, permissões, login e 2FA do painel web.
- Sessão persistente e isolada no perfil local do aplicativo.
- WebSockets para atualização das poltronas em tempo real.
- Acesso à câmera para validação de QR Code.
- Uploads, downloads, relatórios e impressão.
- Bloqueio de navegação interna para o domínio configurado; links externos abrem no navegador padrão.
- Tela de reconexão e recuperação após falha do processo WebView2.
- Instância única para evitar duas operações concorrentes no mesmo terminal.

## Requisitos de compilação

- Windows 10 ou Windows 11 x64.
- Visual Studio 2022 com **Desenvolvimento para desktop com C++**.
- Windows 10/11 SDK.
- Microsoft Edge WebView2 Runtime.

O script restaura automaticamente o pacote `Microsoft.Web.WebView2` pelo NuGet.

```powershell
cd desktop\windows
.\build.ps1
```

O executável e `WebView2Loader.dll` serão gerados em `desktop\windows\build\Release`.

Para gerar o pacote portátil completo:

```powershell
.\package.ps1
```

O arquivo será criado em `artifacts\desktop\Painel-Cine-Cruzeiro-Windows-x64.zip`.

## Servidor

Por padrão, o aplicativo abre:

```text
https://lumixengine.com/projects/cinecruzeiro/admin
```

Para desenvolvimento local:

```powershell
.\CineCruzeiroDesktop.exe --server=http://127.0.0.1:4100
```

Também é possível definir `CINE_CRUZEIRO_ADMIN_URL`. O sufixo `/admin` é acrescentado automaticamente.

## Opções

- `--server=URL`: altera o servidor do painel.
- `--reset-session`: apaga cookies e a sessão local antes de abrir.
- `--devtools`: habilita as ferramentas de desenvolvimento do WebView2.
- `--screenshot=ARQUIVO.png`: salva uma captura diagnóstica da primeira página carregada.

Os dados do perfil ficam em `%LOCALAPPDATA%\Cine Cruzeiro\Painel Desktop\WebView2`. Senhas não são armazenadas pelo código C++; a autenticação continua sendo feita pelo backend usando o cookie seguro existente.

O diagnóstico técnico de inicialização e conexão fica em `%LOCALAPPDATA%\Cine Cruzeiro\Painel Desktop\desktop.log`. O arquivo não registra conteúdo de páginas, formulários, senhas ou cookies.

## Arquitetura

O executável não replica regras de negócio. O painel, as validações, as permissões e os dados continuam pertencendo ao backend. Isso evita divergência entre a operação no navegador e no desktop e faz com que atualizações publicadas no painel sejam recebidas automaticamente pelo aplicativo.
