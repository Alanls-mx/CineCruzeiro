# Configuração completa do Cine Cruzeiro Studio com Canva

O Studio usa **Canva REST** para enviar assets e criar designs a partir de Brand Templates, e **Canva MCP** para o modo Criar com IA sem templates. Você configura **Client ID e Client Secret** do app Canva, não um token manual. O painel conduz os dois fluxos OAuth e guarda os tokens criptografados no backend.

## 1. Banco de dados

O Studio requer PostgreSQL para conexão OAuth, templates, cache de assets e campanhas. O restante do painel pode abrir em modo JSON, mas esse modo não oferece persistência adequada para o Studio.

### Computador local (Windows + Docker Desktop)

1. Inicie o Docker Desktop e espere `docker version` mostrar **Client** e **Server**.
2. Na pasta do projeto, execute `npm run studio:db:local`.
3. O comando cria `cine-cruzeiro-studio-postgres` com volume persistente próprio, exposto apenas em `127.0.0.1:55432`; gera senha aleatória em `.env.local` (ignorado pelo Git); aplica migrations até `044_canva_studio_mcp.sql`; e importa **uma única vez** os dados de `backend/data/db.json`. O JSON original permanece intacto.
4. Reinicie o backend, pois ele lê `.env.local` ao iniciar. Abra `http://127.0.0.1:4000/admin` e confira `http://127.0.0.1:4000/api/health/ready`.

O comando pode ser repetido para aplicar migrations pendentes sem reimportar o JSON. Não apague o volume ou rode `db:import-json` novamente depois de começar a trabalhar no PostgreSQL. Se já existir `DATABASE_URL`/`POSTGRES_URL` para outro banco, o bootstrap se recusa a substituí-la.

### VPS com PostgreSQL existente

**Não** rode o bootstrap Docker local. Faça backup, confirme a URL do banco daquela instalação, execute `npm run db:migrate` com o ambiente do serviço carregado e reinicie o backend. Verifique que `044_canva_studio_mcp.sql` consta em `schema_migrations`. Nunca importe o JSON por cima de um banco de produção.

## 2. Pré-requisitos da conta Canva

1. Entre na conta que vai possuir/usar os Brand Templates e ative a autenticação multifator (MFA).
2. Confirme que o plano permite **Brand Templates e Autofill**. A [documentação atual](https://www.canva.dev/docs/apps/rest-apis/autofill-guide/) cita Canva Pro, Canva Teams e Canva Enterprise, entre outros elegíveis.
3. A conta autorizada no Studio precisa ter acesso aos templates publicados. Caso contrário, a API pode devolver 403 mesmo com escopos corretos.

## 3. Criar o app e obter Client ID/Secret

Escolha **Outside Canva**. O mesmo app pode habilitar Canva REST e Canva MCP.

1. Acesse [Canva Developers](https://www.canva.com/developers/) → **Your apps** → **Create an app**.
2. Dê um nome curto, como `Cine Cruzeiro Studio`. Para uma conta comum, escolha **Public**. A opção **Private** só existe para equipes Enterprise; essa escolha não muda após criar o app. Aceite os termos e conclua.
3. Abra **Outside Canva → Start integrating**. Em **Outside Canva → Configuration → Integration methods**, habilite **Canva REST APIs** e **Canva MCP**.
4. Em **Credentials**, copie o **Client ID**. Clique em **Generate secret** para criar o **Client Secret** e guarde-o imediatamente; o portal pode não exibi-lo outra vez. Se perder, gere outro segredo e atualize Integrações.
5. Em **Scopes**, ative as permissões utilizadas pelo Studio:

   | Área | Permissão exata |
   | --- | --- |
   | Assets | `asset:write` |
   | Brand templates | `brandtemplate:content:read` |
   | Designs | `design:content:read`, `design:content:write`, `design:meta:read` |

   Se a interface agrupar por área, marque as opções Read/Write equivalentes. O código atual envia assets, mas não consulta seus metadados; `asset:read` não é exigido. Ele também não lista Brand Templates pelo Canva, então `brandtemplate:meta:read` não é exigido. Se alterar os scopes depois de conectar, reconecte a conta no Studio.

6. Em **Outside Canva → Redirect URLs**, adicione a URL de retorno **exata**:

   - Ambiente local, abrindo também o painel nesse host: `http://127.0.0.1:4000/api/admin/canva-studio/oauth/callback`
   - Instalação atual sob o prefixo do projeto: `https://lumixengine.com/projects/cinecruzeiro/api/admin/canva-studio/oauth/callback`
   - Para **Criar com IA**, cadastre também `https://lumixengine.com/projects/cinecruzeiro/api/admin/canva-studio/mcp/callback` (no local, troque o host/prefixo mantendo `/mcp/callback`).

   Se o site público estiver em outro domínio/prefixo, use a URL real. `localhost` e `127.0.0.1` não são intercambiáveis para cookies e OAuth; use o **mesmo host** no navegador, no portal e no painel. Fora do desenvolvimento local, use HTTPS. Não adicione barra final, parâmetros ou fragmentos. É possível cadastrar várias Redirect URLs no portal, mas cada instalação usa sua própria URL no painel.

7. Salve no portal. Se a interface mudar, consulte a [Quickstart oficial](https://www.canva.dev/docs/apps/quickstart/) e o [guia OAuth/PKCE](https://www.canva.dev/docs/apps/rest-apis/authentication/).

**Não compartilhe o Client Secret** por chat, e-mail, captura de tela ou Git. Não o coloque em código JavaScript. Ele só deve ser inserido no campo protegido do painel.

## 4. Configurar a integração no Cine Cruzeiro

1. Entre como proprietário ou administrador com permissão para gerenciar integrações.
2. Abra **Integrações → Canva Studio**.
3. Cole o **Client ID** e o **Client Secret** do mesmo app.
4. Cole a URL cadastrada em **Redirect URLs** no campo **URL de retorno OAuth**.
5. Ative a integração e clique em **Salvar configuração**.
6. Abra **Studio → Integração Canva**. Use **Conectar REST** para enviar imagens/usar templates e **Conectar Canva IA** para gerar sem template. Autorize a mesma conta Canva nos dois fluxos.
7. Em Integrações, **Testar conexão** valida a conexão REST; ele não substitui **Conectar REST** nem **Conectar Canva IA**.

O backend deve manter a chave de criptografia estável. Em produção, configure `INTEGRATION_SECRET_KEY` ou `JWT_SECRET` no serviço. Em desenvolvimento local, o projeto usa `backend/data/.local-secret` se essas variáveis não existirem. Perder/trocar a chave impede a leitura dos secrets/tokens antigos. Você **não** precisa gerar access token, refresh token nem PKCE manualmente.

## 5. Criar com IA, sem template

1. Confirme que **Canva REST** e **Canva IA** aparecem como conectados no Studio. O OAuth MCP usa `https://mcp.canva.com/authorize` e `https://mcp.canva.com/token`; não cole tokens manualmente.
2. Em **Studio → Criar**, deixe **Criar com IA** selecionado. Escolha Filme, Programação, Bomboniere, Promoções ou Outras peças. Para Filme, selecione o título; Sessão exige uma sessão existente. Para Bomboniere ou Promoções, escolha o item/oferta do catálogo. Em Outras peças, descreva a finalidade e o texto desejado.
3. Para filme, cadastre pôster ou backdrop. Para programação, cadastre sessões; para bomboniere e promoções, cadastre os itens/ofertas. O Studio usa as imagens disponíveis e acrescenta automaticamente a assinatura Cine Cruzeiro fornecida, clara ou escura. O campo **Direção adicional** é opcional; descreva o clima e a hierarquia que deseja, sem repetir os dados do catálogo.
4. Clique **Criar com IA**, aguarde as alternativas e revise-as. Use **Usar esta opção** para transformar somente a alternativa escolhida em design editável. Depois abra o Canva ou exporte PNG/JPG.
5. Confira qualquer texto gerado pelo Canva antes de divulgar. Se o app MCP não expuser geração de pôster com imagens, o Studio informa a limitação; isso não é resolvido por criar Brand Templates.

O modo IA não cria arte de filme inexistente nem promete preservar automaticamente uma tipografia embutida na foto. A instrução enviada pede ao Canva que preserve a identidade e o título já presentes, mas a revisão humana continua necessária.

## 6. Criar e publicar Brand Templates (modo opcional)

As credenciais do app não criam layouts. Para gerar alternativas reais, publique pelo menos **dois Brand Templates** compatíveis com o tipo de campanha escolhido.

1. No Canva, crie um design na dimensão desejada e insira artwork, textos e marca oficiais.
2. No recurso **Canva Data Autofill**, marque os elementos substituíveis. Use os nomes abaixo **exatamente** (inclusive maiúsculas/minúsculas):

   | Campos de imagem | Campos de texto |
   | --- | --- |
   | `artwork`, `poster`, `backdrop` | `title`, `tagline`, `status` |
   | `titleLockup`, `cinemaLogo` | `date`, `weekday`, `time`, `session`, `cta`, `website` |

3. Inclua ao menos uma imagem principal (`artwork`, `poster` ou `backdrop`) e `title` ou `titleLockup`. Para **Sessão**, inclua `session` ou data/hora; para **Programação**, inclua `session`. Não exija `titleLockup` de filmes que não possuem esse arquivo oficial.
4. Publique como **Brand Template** na conta/equipe autorizada. Copie o ID ao final da URL: em `https://www.canva.com/brand/brand-templates/AEN3TrQftXo`, o ID é `AEN3TrQftXo`.
5. No Cine Cruzeiro, abra **Studio → Templates → Novo template**. Informe ID, nome, família, orientação, perfis e tipos de campanha. Salve, clique em **Validar**, corrija eventuais diferenças do dataset e ative o template.
6. Use **Testar com filme** para verificar compatibilidade antes de uma campanha oficial. Repita com um segundo template visualmente distinto.

O `titleLockup` é opcional e deve ser um asset aprovado em `movie.metadata.titleLockupUrl`; o Studio não extrai tipografia da arte automaticamente. O logo oficial vem de `/images/logo-display.webp`. Pôsteres e backdrops vêm do cadastro de filmes. Uploads idênticos são reutilizados por hash SHA-256 e conta Canva.

## 7. Primeira campanha com template e exportação

1. Em **Studio → Criar → Usar templates**, selecione o filme e **Teaser**, **Campanha**, **Sessão** ou **Programação**. Se escolher Sessão, selecione uma sessão cadastrada.
2. Clique em **Criar com template**. O Content Reducer elimina dados redundantes; o Campaign Director define a direção; o Template Selector ranqueia templates ativos e diversifica famílias. Não há seleção hardcoded por nome do filme.
3. O backend prepara/reutiliza assets e acompanha os jobs assíncronos de upload e Autofill. Abra a campanha para atualizar as prévias temporárias.
4. Compare as opções. **Editar no Canva** abre aquele design no editor. **PNG/JPG** solicita exportação assíncrona e abre o link temporário. O histórico guarda campanha e IDs de design; você pode duplicar uma campanha para outra sessão.

## 8. Solução de problemas

| Sintoma | Ação |
| --- | --- |
| Painel local em modo JSON | Inicie Docker Desktop, execute `npm run studio:db:local`, reinicie o backend. Credenciais Canva não substituem PostgreSQL. |
| Migration 044 pendente | Confirme o banco da instalação e rode `npm run db:migrate`; não importe JSON para produção. |
| Canva não conectado | Ative a integração e use **Studio → Integração Canva → Conectar REST**. Para o modo IA, conecte também **Canva IA**. |
| Redirect URI inválida | Compare URL do portal e do painel caractere por caractere; abra o painel no mesmo host. |
| `invalid_scope` no retorno OAuth | Em **Outside Canva → Configuration → Scopes**, habilite os cinco escopos da seção 3, salve e clique **Conectar Canva** novamente. O Client ID do painel deve ser do mesmo app configurado no portal. |
| 401/token revogado | Reconecte Canva. O Studio remove a autorização local inválida. |
| 403 | Confira scopes, plano e acesso da conta conectada ao Brand Template. |
| Template inválido | Confira grafia/tipo dos campos no Canva, publique e clique em **Validar**. O Canva pode ignorar campos inexistentes. |
| Sem alternativas | Tenha ao menos dois templates válidos e ativos para esse objetivo/filme. |
| 429 | Aguarde o limite temporário da API. Não repita automaticamente uma criação de resultado incerto. |
| Thumbnail/exportação expirada | Reabra a campanha para atualizar a thumbnail ou solicite nova exportação. |

Quando uma chamada de criação remota é enviada, mas a resposta se perde, o resultado pode ser incerto. Confira a conta Canva antes de repetir para evitar designs duplicados. O Studio não simula uma prévia nem renderiza localmente o layout.

## 8. Referências oficiais e limites da V1

- [Quickstart Canva REST APIs](https://www.canva.dev/docs/apps/quickstart/)
- [Autenticação OAuth/PKCE](https://www.canva.dev/docs/apps/rest-apis/authentication/)
- [Scopes](https://www.canva.dev/docs/apps/rest-apis/scopes/)
- [Guia de Autofill/Brand Templates](https://www.canva.dev/docs/apps/rest-apis/autofill-guide/)
- [Dataset de Brand Template](https://www.canva.dev/docs/apps/rest-apis/reference/brand-templates/get-brand-template-dataset/)
- [Job de Autofill](https://www.canva.dev/docs/apps/rest-apis/reference/autofills/create-design-autofill-job/)
- [Upload de asset](https://www.canva.dev/docs/apps/rest-apis/reference/assets/create-asset-upload-job/)
- [Design, thumbnail e edição](https://www.canva.dev/docs/apps/rest-apis/reference/designs/get-design/)
- [Exportação](https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/)

A V1 não gera fundos por IA, não extrai title lockup e não inclui editor próprio. Os testes mockados rodam com `npm run test:canva-studio`; testes reais exigem app, conta e Brand Templates configurados e não são executados automaticamente em produção.
