# Social Studio V2

O Social Studio V2 é o motor interno e determinístico de campanhas do cinema. Ele usa os dados já cadastrados no painel e gera peças próprias para Feed vertical (1080 x 1350), quadrado (1080 x 1080) e Story (1080 x 1920), sem Canva, Bannerbear ou cobrança por renderização.

O módulo de e-mail é independente e não participa deste fluxo.

## Fluxo do operador

1. O operador escolhe o tipo de divulgação.
2. Seleciona filme, combo ou plano já cadastrado.
3. O sistema preenche imagem, título, data, sessões, preço, CTA, logo, site e cores.
4. O gênero recomenda uma variação visual; o operador pode substituí-la.
5. O preview é atualizado com debounce de 300 ms, cancelamento de requisições superadas e cache local.
6. **Gerar arte** salva o formato atual. **Gerar campanha** cria os três formatos, cada um com composição própria.

O editor principal oferece personalização controlada: origem e enquadramento da imagem, texto, CTA, preço, estilo, alinhamento, overlay e escala tipográfica dentro de limites. Depois que a arte é gerada, **Editar detalhes** abre um editor visual opcional para ajustes finos de posição, tamanho, texto, cor, opacidade, imagem e ordem das camadas.

## Editor visual manual

O editor manual usa Konva e preserva a composição automática como versão original. Título, data, preço, CTA, site, logo, imagem e efeitos ficam em elementos serializáveis e independentes. O operador pode:

- selecionar no canvas ou painel de camadas;
- mover, redimensionar, girar, ocultar e bloquear elementos;
- ajustar texto, fonte local, tamanho, peso, cor, alinhamento, espaçamento e opacidade;
- substituir e reenquadrar imagens;
- alterar a ordem das camadas;
- usar encaixe no centro e bordas, margem segura e zoom;
- desfazer, refazer, duplicar e excluir elementos não obrigatórios;
- salvar rascunhos automaticamente, criar versões e exportar PNG/JPG;
- restaurar a composição automática original.

Logo, site e demais elementos institucionais obrigatórios são protegidos contra exclusão acidental. Cada formato mantém sua própria cena, portanto uma edição de Story não altera Feed ou quadrado.

## Engine V2

O pipeline é:

```text
dados existentes -> normalizador -> cena serializável -> Satori (SVG) -> Sharp (PNG/JPG)
```

- `backend/services/social-studio/engine/renderer.js`: coordena Satori, Sharp, fontes, assets, paleta e métricas.
- `backend/services/social-studio/engine/normalizer.js`: transforma entidades existentes em um rascunho de renderização.
- `backend/services/social-studio/engine/assets.js`: valida, carrega, enquadra e armazena imagens em cache.
- `backend/services/social-studio/engine/palette.js`: extrai cores dominantes e aplica fallback da marca.
- `backend/services/social-studio/engine/fonts.js`: carrega fontes locais uma única vez.
- `backend/services/social-studio/engine/typography.js`: auto-fit, datas, URLs e limites tipográficos.
- `backend/services/social-studio/components/index.js`: componentes visuais reutilizáveis.
- `backend/services/social-studio/templates/registry.js`: registro estruturado de templates e requisitos.
- `backend/services/social-studio/services/campaignService.js`: API interna desacoplada da interface.
- `backend/services/social-studio/scene`: schema, fábrica e renderização segura das cenas editáveis.
- `backend/services/socialStudioEngineService.js`: fachada de compatibilidade entre V2 e funções legadas.
- `src/components/social-editor`: canvas Konva, histórico, camadas, propriedades e barra de ferramentas.

O renderer legado continua disponível para leitura e download de artes antigas. Novos registros recebem `rendererVersion: "v2"`; registros antigos não são regenerados.

## Templates V2

- `movie-premiere`: estreia com data, cinema, sessões, CTA, site e logo.
- `movie-highlight`: destaque de filme e programação.
- `movie-price`: comunicação de preço com estado específico quando o valor não existe.
- `movie-presale`: pré-venda.
- `concession-combo`: produto ou combo da bomboniere.
- `club-plan`: plano, benefícios e preço do Clube.
- `online-ticket`: campanha institucional da bilheteria digital.

Cada template declara id, nome, categoria, formatos, estilos, campos, requisitos e função de renderização. Os estilos `cinematic`, `impact`, `clean` e `minimal` consomem o mesmo rascunho. Os layouts de Feed, quadrado e Story são independentes, não redimensionamentos.

## Recomendação e composição

- Terror e suspense recomendam `cinematic`.
- Animação e família recomendam `impact`.
- Ação e aventura recomendam `impact`.
- Romance recomenda `clean`.
- Drama recomenda `cinematic`.
- O operador sempre pode escolher outro estilo.

A paleta deriva cor dominante, secundária e de acento do material do filme. Logo, CTA e elementos institucionais preservam as cores oficiais. Sem imagem ou sem paleta válida, o renderer usa os valores de branding do cinema.

No modo automático, a origem da arte considera formato e disponibilidade de pôster/backdrop. Posição X/Y, zoom e presets `auto`, `center`, `top`, `bottom`, `left` e `right` são aplicados antes do render final.

Gradientes e vinhetas protegem apenas as regiões de conteúdo. Títulos, datas, preços, URLs e CTA usam auto-fit com tamanho mínimo. Ausência de preço troca a hierarquia para sessões disponíveis, sem exibir “Consulte os valores” como se fosse um preço.

## Dados reaproveitados

- Filmes, pôsteres, backdrops, gêneros, datas, sessões e tipos de ingresso.
- Produtos e combos da bomboniere.
- Planos e benefícios do Clube.
- Branding, logo, site e cores.
- Sessão administrativa, autenticação e permissões.
- Upload e armazenamento já existentes.
- Histórico em `settings.socialStudioPosts`.
- Legendas e catálogo editorial de posts prontos.

Nenhuma entidade paralela de filme, produto, sessão ou plano foi criada.

## API e armazenamento

- `GET /api/admin/social-studio/context`: catálogo, branding, templates e versão da engine.
- `POST /api/admin/social-studio/resolve`: resolve os defaults do rascunho.
- `POST /api/admin/social-studio/preview`: render temporário sem persistência.
- `POST /api/admin/social-studio/posts`: render e persistência de uma arte.
- `POST /api/admin/social-studio/campaigns`: Feed, quadrado e Story em uma operação.
- `GET /api/admin/social-studio/posts/:id/scene`: cena original, rascunho e versão ativa.
- `PUT /api/admin/social-studio/posts/:id/scene-draft`: autosave sem renderização final.
- `POST /api/admin/social-studio/posts/:id/scene-versions`: render e persistência de uma nova versão manual.
- `POST /api/admin/social-studio/posts/:id/scene-export`: exportação server-side sem alterar o histórico.
- `POST /api/admin/social-studio/posts/:id/scene-reset`: restauração da arte automática.
- `GET /api/admin/social-studio/assets`: proxy autenticado e validado de imagens do canvas.

A API interna `generateSocialCampaign({ template, subject, formats, cinema }, context, options)` permite automações futuras sem depender do painel.

Os arquivos usam o storage existente nas pastas lógicas `social-studio` e `social-studio-campaigns`. Se uma campanha falha parcialmente, os arquivos criados naquela operação são removidos e o histórico não fica incompleto.

## Cache, fontes e segurança

- Fontes Barlow Condensed locais são carregadas uma vez e compartilhadas pelo Satori.
- Pôster, backdrop e logo usam caches LRU com TTL.
- Transformações de enquadramento também são reutilizadas.
- Paletas são indexadas pelo hash da imagem.
- O cliente mantém as oito prévias recentes.

O renderer não aceita requests arbitrários. URLs passam pelo carregador já validado do servidor, com HTTPS, allowlist, bloqueio de redirecionamento, limite de bytes e dimensões. Uploads aceitam apenas os formatos e tamanhos previstos pelo módulo existente. A cena recebida do navegador passa por schema de tipos, cores, dimensões, profundidade e quantidade antes de qualquer renderização.

## Histórico e permissões

O histórico mostra miniatura, campanha, template, formato, data, autor, versão do renderer e estado automático/editado. As ações de visualizar, editar, duplicar, baixar e excluir continuam disponíveis conforme `social_studio.view`, `social_studio.create` e `social_studio.delete`.

Duplicar preserva template, variação, formato, textos e ajustes; o operador pode trocar apenas a entidade.

## Qualidade

Os testes cobrem:

- os sete templates registrados;
- Feed, quadrado e Story nas dimensões exatas;
- PNG e JPG;
- Terror, Animação, Ação, Drama e Romance;
- títulos longos;
- pôster/backdrop ausentes;
- preço ausente;
- logos claras, escuras, horizontais e quadradas;
- bomboniere, Clube, institucional e pré-venda;
- geração de campanha e métricas;
- histórico V2 e autoria;
- compatibilidade do contrato legado.
- normalização e segurança da cena editável;
- preservação da versão automática;
- renderização server-side de cenas manuais;
- contratos do autosave, versionamento, exportação e restauração.

Fixtures reais também são renderizadas para inspeção visual de hierarquia, enquadramento, contraste, assinatura e legibilidade.

Medição local de referência em fixture controlada: primeiro post em 359,5 ms, repetição com caches aquecidos em 208,8 ms e campanha paralela com três formatos em 397,5 ms de tempo total. Esses números variam conforme tamanho dos assets, CPU e storage da instalação.

## Isolamento do e-mail

**O módulo de e-mail existente não foi alterado.** Nenhum template, endpoint, serviço ou comportamento de e-mail foi modificado ou acoplado ao Social Studio V2.
