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

## Arquitetura

- `backend/services/socialStudioService.js`: catálogo de formatos e templates, normalização dos dados, textos padrão, legenda e renderer Sharp/SVG.
- `backend/public/social-studio.js`: editor, preview, upload, histórico, duplicação, download e exclusão.
- `backend/public/social-studio.css`: layout responsivo próprio, integrado aos tokens do painel.
- `backend/server.js`: contexto de dados, validação de imagens, preview, exportação e persistência do histórico.
- `backend/services/adminPermissionService.js`: permissões `social_studio.view`, `social_studio.create` e `social_studio.delete`.
- `tests/social-studio.test.mjs`: contratos dos formatos, templates, renderer, dados e isolamento do e-mail.

O histórico fica em `settings.socialStudioPosts`. Os arquivos finais usam o armazenamento de imagens existente, na pasta lógica `social-studio`. Isso evita novas entidades de filmes, sessões, preços, produtos ou planos.

## Fluxo dos dados

1. `GET /api/admin/social-studio/context` monta um catálogo de leitura a partir dos dados atuais.
2. `POST /api/admin/social-studio/resolve` combina template, entidade selecionada e identidade para preencher o rascunho.
3. `POST /api/admin/social-studio/preview` renderiza uma imagem temporária sem persistência.
4. `POST /api/admin/social-studio/posts` renderiza, salva o arquivo e adiciona o registro ao histórico.
5. O histórico permite visualizar, baixar, duplicar e excluir conforme as permissões do usuário.

As imagens locais são resolvidas somente nas áreas públicas de imagens e uploads. Imagens remotas exigem HTTPS e host permitido, sem redirecionamentos, com limite de 8 MB e 40 megapixels. Uploads do editor aceitam JPG, PNG ou WebP de até 5 MB.

## Renderer e exportação

O renderer usa `sharp`, dependência já instalada no projeto. Cada composição é construída em SVG com margens seguras, quebra de linha, redução tipográfica e limites de linhas. Pôsteres, backdrops e logos usam `contain` ou `cover` de acordo com seu papel e nunca são distorcidos.

Formatos atuais:

- Feed vertical: 1080 x 1350.
- Quadrado: 1080 x 1080.
- Story: 1080 x 1920.

Saídas atuais: PNG com compressão sem perda e JPG progressivo em alta qualidade.

## Templates atuais

- `movie-price`: ingresso a partir de um valor real; sem preço, usa “CONSULTE OS VALORES”.
- `movie-highlight`: destaque com data, sessões e chamada.
- `movie-premiere`: estreia ou lançamento recomendado pelo catálogo.
- `online-ticket`: divulgação institucional da compra digital.
- `concession-combo`: produto ou combo da bomboniere.
- `cinema-club`: plano e benefícios do Clube.

## Como adicionar um template

1. Adicione a definição em `SOCIAL_TEMPLATES`, com `id`, `name`, `type`, `requiredData` e formatos permitidos.
2. Acrescente os textos determinísticos em `defaultCopy`.
3. Defina a fonte de imagem em `sourceImageForDraft`, quando necessário.
4. Adicione a composição ao `templateSvg`, preservando margens e limites tipográficos.
5. Inclua a legenda em `captionForDraft`.
6. Registre o ícone e o tipo de entidade no cliente do editor.
7. Cubra o template no teste do renderer, incluindo os formatos compatíveis e estados sem dados.

A separação entre catálogo, rascunho normalizado e renderer permite adicionar geração em lote ou tarefas agendadas no futuro sem depender do editor e sem tornar IA obrigatória.

## Limite de responsabilidade

O Social Studio gera, revisa e organiza arquivos. Publicação automática, agendamento em redes e geração de texto por IA não fazem parte desta primeira versão.

**O módulo de e-mail existente não foi alterado.**
