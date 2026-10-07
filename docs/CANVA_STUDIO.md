# Cine Cruzeiro Studio (Canva)

**Guia completo para obter Client ID/Secret, configurar PostgreSQL, criar Brand Templates e conectar a conta:** [CANVA_STUDIO_CONFIGURACAO.md](CANVA_STUDIO_CONFIGURACAO.md).

## Antes de usar

O Studio oferece dois modos: **Criar com IA** via Canva MCP (sem Brand Template) e **Usar templates** via Canva REST/Autofill. Ambos criam designs editáveis no Canva. A geração real depende da conexão do app Canva do cinema; não há credenciais de exemplo.

### Criar com IA

1. Em Canva Developers, ative **Canva MCP** no mesmo app já usado para Canva REST. Cadastre também `https://lumixengine.com/projects/cinecruzeiro/api/admin/canva-studio/mcp/callback` em **Outside Canva → Redirect URLs**. A URL REST `/oauth/callback` permanece cadastrada.
2. No painel, abra **Studio → Integração Canva** e conecte **Canva REST** e **Canva IA**. A primeira conexão envia assets; a segunda gera candidatos via MCP. Não compartilhe o Client Secret.
3. Em **Studio → Criar → Criar com IA**, escolha **Filme**, **Programação**, **Bomboniere**, **Promoções** ou **Outras peças**. Para filme, escolha o título e, se for peça de sessão, a sessão; para bomboniere/promoções, selecione o item. Escolha a assinatura clara/escura ou deixe automática. A direção criativa é opcional, exceto em Outras peças.
4. O Studio envia ao Canva as imagens cadastradas e os fatos confirmados no catálogo. Para filme, exige pôster ou backdrop e inclui a assinatura oficial; para as outras categorias, usa imagens quando houver e dados existentes dos filmes, produtos ou promoções. Bomboniere e promoções podem partir só dos dados e da assinatura.
5. Revise as alternativas retornadas e clique **Usar esta opção**. Só então o design é salvo na sua conta para edição/exportação. O prompt complementa os dados, não os substitui; revise datas, preços, identidade e eventuais textos gerados antes de publicar.

As assinaturas oficiais são `/images/cine-cruzeiro-signature-light.png` e `/images/cine-cruzeiro-signature-dark.png`. A geração pode não aparecer em todas as contas/apps: o Studio verifica se a conexão MCP oferece a ferramenta de pôster com assets e interrompe sem criar design caso não ofereça. Uma resposta remota incerta nunca é reenviada automaticamente.

### Usar templates

1. Crie uma integração em [Canva Developers](https://www.canva.dev/docs/apps/rest-apis/authentication/). Registre como URL de retorno a URL HTTPS exata do cinema seguida de `/api/admin/canva-studio/oauth/callback`. Na instalação sob `/projects/cinecruzeiro`, preserve esse prefixo: `https://seu-dominio/projects/cinecruzeiro/api/admin/canva-studio/oauth/callback`.
2. Habilite os escopos `asset:write`, `brandtemplate:content:read`, `design:content:read`, `design:content:write` e `design:meta:read`. O Studio não lista metadados dos Brand Templates nesta versão; o endpoint de usuário atual não exige um escopo adicional.
3. No painel, abra **Integrações → Canva Studio**, salve Client ID, Client Secret e URL de retorno e ative a integração. O segredo fica criptografado no backend. É necessário configurar `INTEGRATION_SECRET_KEY` (ou o segredo de runtime já usado pelo cinema).
4. Abra **Studio → Integração Canva → Conectar Canva** e autorize a conta que terá acesso aos Brand Templates. A autorização usa OAuth com PKCE, estado de uso único, tokens criptografados e rotação do refresh token.
5. Crie e publique no Canva ao menos dois [Brand Templates com Autofill](https://www.canva.dev/docs/apps/rest-apis/autofill-guide/) compatíveis com cada tipo de campanha desejado. Brand Templates e acesso a Autofill dependem das permissões e do plano da conta Canva; confira-os na conta conectada.
6. Em **Studio → Templates**, registre o ID de cada Brand Template, família visual, direção compatível e tipos de campanha. Clique em **Validar** para ler o dataset diretamente do Canva; só templates válidos podem ser ativados.
7. Em **Studio → Criar campanha**, escolha filme e objetivo. Para o modo Sessão, escolha uma sessão. A campanha gera até três alternativas via Autofill. Cada alternativa pode ser aberta para edição no Canva ou exportada em PNG/JPG.

Em uma instalação com PostgreSQL, aplique `npm run db:migrate` antes de usar o Studio. As migrations são `043_canva_studio.sql` e `044_canva_studio_mcp.sql`. O backend retorna um erro explícito quando roda somente com JSON.

## Convenção dos templates

Campos de imagem: `artwork`, `poster`, `backdrop`, `titleLockup`, `cinemaLogo`. Campos de texto: `title`, `tagline`, `status`, `date`, `weekday`, `time`, `session`, `cta`, `website`. O dataset precisa ter imagem principal e `title` ou `titleLockup`. O Canva pode ignorar campos enviados com nomes não existentes, por isso a validação é obrigatória antes da ativação.

`titleLockup` é um asset oficial opcional. Quando já houver um arquivo aprovado, registre sua URL local em `movie.metadata.titleLockupUrl`; não há OCR ou recriação de tipografia nesta versão. O logo institucional é carregado de `/images/logo-display.webp`. Os assets de pôster/backdrop vêm do cadastro do filme. O cache usa SHA-256 do arquivo e ID da conta Canva; uploads repetidos são evitados.

Os templates ficam no Canva e podem representar Hero, Editorial, Monumental, Clean, Dark, Event e Teaser. O Studio guarda somente IDs, dataset e metadata. A seleção ranqueia compatibilidade com objetivo, gênero, orientação, posição declarada do assunto, comprimento do título, densidade e lockup; diversifica famílias quando scores próximos. Não há vínculo hardcoded entre filme e template.

## Operação e falhas

- Cada campanha é salva antes de qualquer chamada remota, com chave de idempotência. O worker no servidor continua os jobs de upload/Autofill após fechar o navegador. A interface também pode avançar e consultar a campanha.
- URLs de thumbnail e edição do Canva são temporárias; ao abrir uma campanha, o Studio consulta novamente o design. Links de exportação também expiram; solicite nova exportação para obter outro link.
- Acesso revogado ou refresh token inválido exige **Reconectar Canva**. Falhas 403 podem indicar escopo, plano ou falta de acesso ao template; 429 indica limite temporário da API. O Studio não faz fallback para arte fictícia.
- Em falha de comunicação exatamente após criar um job remoto e antes de receber seu ID, a API não garante idempotência do lado do Canva. Confira a conta Canva antes de repetir a campanha para evitar um design órfão.
- Testes unitários e de contrato mockado: `npm run test:canva-studio`. Um teste real separado só deve ser executado depois de configurar um app e templates de desenvolvimento. A suíte padrão nunca chama a API real.

## Referências oficiais

- [Autenticação OAuth/PKCE](https://www.canva.dev/docs/apps/rest-apis/authentication/)
- [Brand Template dataset](https://www.canva.dev/docs/apps/rest-apis/reference/brand-templates/get-brand-template-dataset/)
- [Autofill assíncrono](https://www.canva.dev/docs/apps/rest-apis/reference/autofills/create-design-autofill-job/)
- [Upload binário de assets](https://www.canva.dev/docs/apps/rest-apis/reference/assets/create-asset-upload-job/)
- [Design e thumbnail](https://www.canva.dev/docs/apps/rest-apis/reference/designs/get-design/)
- [Exportação](https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/)
- [Canva MCP e configuração OAuth](https://www.canva.dev/docs/apps/quickstart/)
- [Geração de candidatos](https://www.canva.dev/docs/apps/mcp/tools/generate-design/)
