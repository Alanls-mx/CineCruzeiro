# Social Studio: auditoria estrutural e plano incremental

Data: 2026-09-22. Base: c3b7803. Escopo exclusivo do Cine Cruzeiro; e-mails fora do escopo.

## Fluxo encontrado

`backend/public/social-studio.js` -> rotas autenticadas em `server.js` ->
`socialStudioEngineService` (wrapper Legacy/V2) -> normalizer -> assets/analysis ->
scene factory ou content-layout -> polish -> contrast -> score -> scene renderer ->
Satori/Sharp. Persistencia usa createHistoryRecord; o editor Konva le e salva cenas
normalizadas, mantendo originalScene/editedScene/sceneVersions/activeVersion.
FFmpeg exporta planos da mesma cena, mas a previa CSS possui temporalidade propria.

## Classificacao

| Componente | Decisao | Dependencias e motivo |
| --- | --- | --- |
| Registry/templates | Refinar | Preservar IDs; separar familia visual de geometria. |
| Renderer V2 | Manter/refinar | Ponto unico de validacao anterior a assets e render. |
| Normalizer | Migrar | Legacy fornece defaults; style mistura look, geometria e estilo. |
| Scene factory | Reaproveitar | Composicao individual, IDs editaveis e efeitos existentes. |
| Scene renderer | Manter | Satori/Sharp ja suportam groups recursivos. |
| Composition Engine | Reaproveitar | Crops, masks, luz, contraste, analise visual e cache. |
| Score | Refinar | Hoje mistura dados faltantes com problemas de geometria. |
| Polish | Refinar | Rodape padrao atualmente desfaz parte da direcao escolhida. |
| Variations | Refinar | Similar multi ignora modo; curadoria individual ja aproveitavel. |
| Animation | Refinar | Mesmo encoder FFmpeg; lock global e 720px limitam uso. |
| Motion preview | Migrar | Consolidar timing em contrato compartilhado com export. |
| Konva/serializer | Manter | Groups, transformacao recursiva, historico e reset existentes. |
| History | Manter/migrar | Payload com campos explicitos precisa receber novos contratos. |
| Sidebar | Substituir | Resolve + render para cada card custa ate 18 requests extras. |
| Copy/defaultCopy | Migrar | Defaults legados como fallback; provider factual independente. |
| Content-layout | Migrar | Regras de dados e deslocamentos ad hoc devem dar lugar a grupos. |
| Legacy integration | Remover futuramente | Nao apagar wrapper; extrair contratos compartilhados gradualmente. |
| Catalogo editorial | Manter isolado | socialStudioEditorialCatalog ja separado do core de composicao. |

## Riscos confirmados na leitura

- Validacao existente bloqueia apenas selecao de filmes, website e data. Previews
  ainda carregam imagens antes de verificar coerencia de sessoes/pre-venda/preco.
- Groups sao suportados pelo renderer/Konva, mas score e animation inspecionam
  apenas elementos top-level. Introduzir groups requer travessia compartilhada.
- Datas usam um campo generico; a funcao da data nao acompanha o valor.
- Sessao futura com texto 'hoje' pode sobreviver a uma edicao manual.
- Programacao tem construtor proprio, porem fundo plano e cinco geometrias basicas.
- Efeitos procedurais sao cacheados junto com o artwork; mudar imagem recalcula
  a mesma mascara. Os loops JS de RGBA/masks merecem cache independente limitado.
- animation rejeita a segunda requisicao por lock global; export/preview nao
  distinguem qualidade final e a previa CSS nao equivale ao video codificado.
- Types conhecem somente quatro valores de style, enquanto runtime aceita layouts.

## Fases e portas de verificacao

1. Contratos visualStyle/layoutId/look, CampaignContent, validacao, ActionGroup.
2. Sidebar com imagens das entidades, debounce e cancelamento central.
3. Copy provider local, candidatos, score, locks, tons e historico recente.
4. Politicas de polish por layout.
5. Scene builders de dia e semana.
6. Composicoes multi, selecao de destaque, mood e MovieGroup.
7. Score de programacao separado da validacao semantica.
8. MotionSpec compartilhado e presets por grupo.
9. Export final 1080 e fila limitada/cancelavel.
10. Cache procedural e medicoes com cold/warm separados.
11. Types e contratos compartilhados.
12. Revisao do wrapper, regressao de cenas/historico/Konva e deploy isolado.

Cada fase deve ser um commit delimitado. Nenhum template antigo sera regravado
em massa: fallback acontece na leitura. Validacao estrita se aplica a novas
geracoes; uma cena salva continua abrindo/exportando sem recalcular seu conteudo.
Resultados, limites e pendencias devem ser registrados no relatorio de entrega,
sem tratar build ou arquivo gerado como prova de qualidade visual.
