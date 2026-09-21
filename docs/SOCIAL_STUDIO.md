# Social Studio

O Social Studio é um módulo independente do painel administrativo para criar artes determinísticas a partir dos dados já cadastrados no cinema. Ele não publica em redes sociais e não altera o módulo de campanhas por e-mail.

## O que é reutilizado

- Filmes, pôsteres, backdrops, sessões e tipos de ingresso do catálogo atual.
- Produtos e combos da bomboniere.
- Planos e benefícios do Clube.
- Nome, logo, site e cores configurados para o cinema.
- Sessão administrativa, armazenamento de uploads, auditoria e permissões já existentes.
- Componentes visuais básicos do painel, como superfícies, botões, abas e estados de carregamento.

O módulo de e-mail é apenas uma referência de padrões de uso. Nenhum arquivo, template, endpoint, serviço ou comportamento do módulo de e-mail é chamado ou alterado pelo Social Studio.

## Experiência do editor

O editor funciona como um pequeno estúdio, organizado em três áreas:

- Biblioteca visual à esquerda, com modelos agrupados em Filmes, Vendas, Bomboniere e Clube.
- Preview central dominante, com proporção real, zoom e área segura de Story.
- Propriedades à direita, com campos condicionais, seções recolhíveis e abas separadas para Arte e Legenda.

O caminho principal é selecionar o que divulgar, escolher o conteúdo e gerar. Ajustes de imagem e composição ficam disponíveis sem transformar a ferramenta em um editor livre.

Acima do editor existe a coleção **Posts prontos para publicar**. Ela separa filmes cadastrados de próximos lançamentos editoriais e permite abrir a composição para revisão ou gerar a arte final em um clique. Cada item já inclui texto da arte, enquadramento, assinatura, legenda e imagem.

## Arquitetura

- `backend/services/socialStudioService.js`: catálogo de formatos e templates, normalização dos dados, textos padrão, legenda e renderer Sharp/SVG.
- `backend/services/socialStudioEditorialCatalog.js`: lançamentos futuros ainda fora do catálogo, com fonte, previsão, texto e material visual local.
- `backend/public/social-studio.js`: biblioteca visual, editor condicional, preview automático, rascunho local, campanha, upload, histórico, duplicação, download e exclusão.
- `backend/public/social-studio.css`: layout responsivo próprio, integrado aos tokens do painel.
- `backend/server.js`: contexto de dados, validação de imagens, preview, exportação e persistência do histórico.
- `backend/services/adminPermissionService.js`: permissões `social_studio.view`, `social_studio.create` e `social_studio.delete`.
- `tests/social-studio.test.mjs`: contratos dos formatos, templates, renderer, dados e isolamento do e-mail.

O histórico fica em `settings.socialStudioPosts`. Os arquivos finais usam o armazenamento de imagens existente, na pasta lógica `social-studio`. Isso evita novas entidades de filmes, sessões, preços, produtos ou planos.

## Posts prontos e calendário editorial

- Todo filme publicado no catálogo recebe automaticamente uma sugestão pronta usando título, imagem, gênero, classificação, data, sessões e preço disponíveis no painel.
- Os textos variam entre os filmes e nunca inventam sessão ou valor. Sem venda aberta, a chamada muda para consulta da programação.
- Lançamentos futuros ficam marcados como **Ainda não cadastrado** e não entram no catálogo público nem na venda de ingressos.
- Datas futuras são apresentadas como previsão internacional, acompanhadas da fonte consultada e do aviso de que a exibição no Cine Cruzeiro não está confirmada.
- Os pôsteres editoriais ficam locais em `public/images/social-studio/editorial`, evitando dependência de URLs remotas durante a renderização.
- A lista editorial deve ser revisada quando estúdios alterarem calendários ou o filme for cadastrado oficialmente. Títulos já presentes no catálogo deixam de aparecer na coleção editorial para evitar duplicidade.

## Fluxo dos dados

1. `GET /api/admin/social-studio/context` monta um catálogo de leitura a partir dos dados atuais.
2. `POST /api/admin/social-studio/resolve` combina template, entidade selecionada e identidade para preencher o rascunho.
3. `POST /api/admin/social-studio/preview` renderiza uma imagem temporária sem persistência.
4. `POST /api/admin/social-studio/posts` renderiza, salva o arquivo e adiciona o registro ao histórico.
5. `POST /api/admin/social-studio/campaigns` adapta e salva Feed, quadrado e Story em uma única operação transacional.
6. O histórico permite visualizar, baixar, duplicar e excluir conforme as permissões do usuário.

As imagens locais são resolvidas somente nas áreas públicas de imagens e uploads. Imagens remotas exigem HTTPS e host permitido, sem redirecionamentos, com limite de 8 MB e 40 megapixels. Uploads do editor aceitam JPG, PNG ou WebP de até 5 MB.

## Renderer e exportação

O renderer usa `sharp`, dependência já instalada no projeto. Cada composição é construída em SVG com margens seguras, quebra de linha, redução tipográfica e limites de linhas. Pôsteres, backdrops e logos usam `contain` ou `cover` de acordo com seu papel e nunca são distorcidos.

Quando a origem escolhida é um pôster, a composição reserva uma área exclusiva para a imagem e outra para título, data, descrição e CTA. O pôster sempre usa `contain`, sem corte nem texto sobre a arte. O domínio do sistema não é impresso nas imagens; permanece apenas nas legendas quando configurado.

Os templates de filme possuem quatro estilos que consomem o mesmo rascunho: Cinematográfico, Impacto, Clean e Minimalista. A paleta dinâmica deriva uma base segura da imagem do filme e mantém logo, CTA e elementos institucionais com as cores oficiais do cinema.

O enquadramento armazena origem da imagem, preset, posição horizontal/vertical e escala. Overlay, escurecimento, blur, posição do conteúdo, alinhamento e escala do título também pertencem ao rascunho e são preservados ao duplicar.

Formatos atuais:

- Feed vertical: 1080 x 1350.
- Quadrado: 1080 x 1080.
- Story: 1080 x 1920.

Saídas atuais: PNG com compressão sem perda e JPG progressivo em alta qualidade.

## Templates atuais

- `movie-price`: ingresso a partir de um valor real; sem preço, muda a hierarquia para “Confira as sessões e garanta seu lugar”, sem simular um preço.
- `movie-highlight`: destaque com data, sessões e chamada.
- `movie-premiere`: estreia ou lançamento recomendado pelo catálogo.
- `online-ticket`: divulgação institucional da compra digital.
- `concession-combo`: produto ou combo da bomboniere.
- `cinema-club`: plano e benefícios do Clube.

## Preview e rascunho

- Alterações de texto, conteúdo, imagem, formato e estilo disparam preview automático com debounce de 460 ms.
- Requisições superadas são canceladas e as oito prévias mais recentes ficam em cache na sessão.
- O botão de atualização permanece como fallback explícito.
- O rascunho é salvo no navegador sem criar registros no histórico e restaurado ao reabrir o módulo.
- Avisos explicam fallback de pôster, ausência de imagem e ausência de preço.

## Geração de campanha

“Gerar arte” salva somente o formato selecionado. “Gerar campanha” renderiza composições independentes para 1080 × 1350, 1080 × 1080 e 1080 × 1920. Cada formato passa pelo renderer com suas próprias posições e margens; não é apenas redimensionamento do mesmo arquivo.

Se qualquer etapa da campanha falhar, os arquivos já enviados naquela operação são removidos e o histórico não é alterado parcialmente.

## Como adicionar um template

1. Adicione a definição em `SOCIAL_TEMPLATES`, com `id`, `name`, `type`, `category`, `fields`, `styles`, `requiredData` e formatos permitidos.
2. Acrescente os textos determinísticos em `defaultCopy`.
3. Defina a fonte de imagem em `sourceImageForDraft`, quando necessário.
4. Adicione a composição ao `templateSvg`, preservando margens e limites tipográficos.
5. Inclua a legenda em `captionForDraft`.
6. Registre a miniatura visual e a categoria no cliente do editor.
7. Cubra o template no teste do renderer, incluindo os formatos compatíveis e estados sem dados.

A separação entre catálogo, rascunho normalizado e renderer permite adicionar geração em lote ou tarefas agendadas no futuro sem depender do editor e sem tornar IA obrigatória.

## Limite de responsabilidade

O Social Studio gera, revisa e organiza arquivos. Publicação automática, agendamento em redes e geração de texto por IA não fazem parte desta primeira versão.

**O módulo de e-mail existente não foi alterado.**
