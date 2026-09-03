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
- Tela cheia pelo botão do aplicativo ou pela tecla `F11`; `Esc` restaura a janela.
- Identificação local de impressoras, impressora padrão, câmeras/leitores, portas COM/PDV, monitores e WebView2.
- Atualização automática em segundo plano, com validação SHA-256 e confirmação antes de reiniciar.

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
- `--fullscreen`: inicia diretamente em tela cheia.

Os dados do perfil ficam em `%LOCALAPPDATA%\Cine Cruzeiro\Painel Desktop\WebView2`. Senhas não são armazenadas pelo código C++; a autenticação continua sendo feita pelo backend usando o cookie seguro existente.

O diagnóstico técnico de inicialização e conexão fica em `%LOCALAPPDATA%\Cine Cruzeiro\Painel Desktop\desktop.log`. O arquivo não registra conteúdo de páginas, formulários, senhas ou cookies.

## Atualizações

O aplicativo consulta `/api/desktop/update/latest.ini` ao iniciar e a cada seis horas. Quando existe uma versão mais recente, baixa o executável e o `WebView2Loader.dll` para o perfil local, confere os hashes SHA-256 do manifesto e avisa o operador. A instalação só começa após confirmação; o aplicativo fecha, troca os dois arquivos e reabre na nova versão.

Para compilar e publicar os arquivos de uma versão no diretório público do backend:

```powershell
.\publish-update.ps1 -Version "1.1.0" -Notes "Resumo das alterações para o operador."
```

O script gera `backend/public/downloads/desktop/<versão>` e atualiza o manifesto `latest.ini`. Esses arquivos precisam seguir no mesmo deploy do backend. A origem exige HTTPS e os hashes impedem que um download incompleto ou diferente do manifesto seja instalado.

## Dispositivos locais

O botão **Dispositivos** abre um inventário atualizado do computador. A descoberta usa as APIs de impressão e SetupAPI do Windows e exibe somente nomes amigáveis; números de série e dados de páginas não são coletados. Impressoras instaladas ficam disponíveis ao fluxo de impressão do WebView2. Portas COM são listadas para diagnóstico de equipamentos PDV conectados, sem assumir compatibilidade com um protocolo específico.

## Arquitetura

O executável não replica regras de negócio. O painel, as validações, as permissões e os dados continuam pertencendo ao backend. Alterações apenas na interface web chegam automaticamente; mudanças no código nativo são distribuídas pelo atualizador versionado.
