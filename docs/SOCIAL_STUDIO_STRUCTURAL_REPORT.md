# Social Studio V2: entrega incremental

Data: 2026-09-22. Escopo: Cine Cruzeiro. A auditoria anterior a implementacao esta
em `SOCIAL_STUDIO_STRUCTURAL_AUDIT.md`. Esta entrega nao encerra todos os itens
da revisao ampla: as limitacoes remanescentes estao explicitadas abaixo.

## Arquitetura e contratos

- Mantidos renderer V2, Sharp/Satori, Composition Engine, editor Konva,
  scenes, historico/versionamento, formatos e wrapper Legacy/V2.
- Novos contratos em `backend/services/social-studio/contracts/`: campaign,
  content, formats e motion. Tipos ampliados em `types/index.d.ts`.
- `visualStyle`, `layoutId` e `look` sao independentes; `style` permanece como
  adaptador de compatibilidade para geometrias antigas. Migracao na leitura,
  sem regravar campanhas existentes ou cenas editadas.
- `CampaignContent` separa estreia, abertura da pre-venda e sessao, contem
  dados reais de sessoes, preco, compra disponivel, acao/destino e programMovies.
- `validateCampaignContent` bloqueia geracao antes de carregar imagens: sem
  horarios, hoje incorreto, preco inexistente, destino invalido, selecao curta
  e pre-venda nao confirmada. Erros indicam o campo e a correcao necessaria.
- `validateSceneSemantics` verifica representacao de acao/destino/filmes.
  Ainda ha verificacoes geometricas de proximidade no score visual.
- ActionGroup e DateGroup usam o group nativo; MovieGroup associa artwork,
  titulo e sessoes. Score e motion percorrem grupos pelo helper compartilhado.
- Cenas originais e editadas continuam distintas; restauracao nao altera
  templates globais. Campanhas antigas incompletas podem abrir suas cenas
  salvas, mas novas geracoes exigem os dados agora obrigatorios.

## Interface e copy

- Sidebar usa diretamente posterUrl/imageUrl da entidade, loading lazy,
  decoding async e fallback local de texto. Nao usa renderer, Sharp ou APIs
  de geracao. Alteracoes visuais nao substituem os elementos img existentes.
- Previa central: debounce 300 ms, AbortController e cache existente.
- Controles separados de estilo, layout, significado da data e destino.
- RuleBasedCopyProvider local, sem dependencia de IA, produz oito candidatos.
  Score penaliza comprimento, repeticao recente e chamadas comerciais invalidas.
- Pools por campanha e genero; tom automatico/cinematografico/comercial/
  divertido/elegante/direto; densidades curta/media/longa.
- Sugestao por campo para titulo, chamada, apoio, CTA e legenda; checkbox
  Manter texto preserva campos escolhidos. Respostas obsoletas nao sobrescrevem
  uma edicao posterior nem outro filme selecionado.
- Historico existente fornece contexto de repeticao; beneficios e produtos
  nao recebem caracteristicas inventadas. SocialHook pode ser reaproveitado;
  sinopse pode aparecer na legenda longa, sem inventar narrativa.

## Direcao de arte e programacao

- Politicas de polish preservam assinaturas compacta, editorial, minima,
  discreta ou flutuante, em vez de sempre impor o mesmo divisor/rodape.
- Builders dedicados: buildTodaySessionsScene, buildWeekSessionsScene,
  buildMultiMovieScene. Reutilizam layers/effects do Composition Engine.
- Familias de agenda diaria e semanal, destaque/apoio, dupla, mosaico, grade,
  faixa, panorama, camadas, colagem e lineup. Algumas variantes ainda compartilham
  boa parte da geometria; nao sao todas direcoes autorais finalizadas.
- Destaque deterministico: escolha manual, estreia, prioridade, numero e
  proximidade de sessoes. Mood deriva do conjunto de generos.
- Programacao tem score adicional: legibilidade, clareza dos horarios,
  separacao, equilibrio de posters e destaque. Texto e sessao mantem IDs
  associados ao filme; dias excedentes apontam para o site.
- Variacoes de programacao usam suas proprias familias. Similar preserva
  familia/estilo/look e varia parametros controlados; curadoria mostra ate
  quatro aprovadas, sem completar quantidade com propostas rejeitadas.

## Movimento e performance

- MotionSpec compartilhado por previa e exportacao FFmpeg. A UI deixou de usar
  uma animacao CSS divergente: reproduz o video gerado pelo mesmo pipeline.
- Presets de entrada/cascata e ciclos de filmes com resumo final. Textos ficam
  estaveis; duracao pode aumentar ate 30 segundos para leitura.
- MP4, WebM e GIF; previa em 540px (GIF 360), final 1080px. FFprobe confirmou
  H.264 1080x1920 no arquivo final de teste.
- Fila em memoria configuravel: SOCIAL_STUDIO_ANIMATION_WORKERS (1-2),
  SOCIAL_STUDIO_ANIMATION_QUEUE (1-20, padrao 8). Fila cheia retorna 429;
  cancelamento remove espera e libera o worker. Jobs nao sobrevivem a restart.
- Cache procedural independente de artwork, limitado a 32 MiB/48 entradas,
  TTL 20 minutos. Reutiliza buffers de masks, vignette, grain e overlays.
  Cache de artwork existente permanece separado e limitado a 64 MiB.

## Verificacao

- 90 testes passaram: contratos, conteudo, copy (dez campanhas/seis generos),
  renderer, composicao, direcao, editor/serializer, historico, fila e encoder.
- TypeScript e build Next passaram; verificacao sintatica do backend e UI.
- Playwright: desktop 1440x1000 e mobile 390x844, sem erros JS ou overflow
  horizontal. Editar titulo: uma geracao central e zero geracoes de sidebar.
  Antes: o codigo podia disparar ate nove resolve+preview adicionais por mudanca
  (18 requests); esse numero anterior e derivado do codigo, nao captura de rede.
- Inspecao visual de estreia, dia, semana, multi/featured, story/mosaico e duo
  quadrado. Corrigidos deslocamento de poster no mosaico, espaco excessivo de
  horarios semanais e largura dos posters de apoio.
- Testes de grupos cobrem movimento, resize, IDs, bloqueio e undo. Nao houve
  uma nova sessao manual completa no Konva em producao nesta entrega.
- Evidencias locais: `scratch/studio-structural-qa/` (nao versionadas): gallery,
  cenas JSON, screenshots desktop/mobile, relatorios e videos preview/final.

### Medicoes locais

Node/Windows, assets locais, duas execucoes por render; nao sao SLA da VPS.
Primeira execucao pode compartilhar caches de etapas anteriores do processo.

| Operacao | Primeira (ms) | Aquecida (ms) | Media (ms) |
| --- | ---: | ---: | ---: |
| Render simples | 406 | 281 | 343,5 |
| Render com efeitos | 1571 | 984 | 1277,5 |
| Multi-filmes | 1425 | 1070 | 1247,5 |
| Tres formatos, sequencial | 4203 | 3099 | 3651 |
| Variacoes | 6933 | 6204 | 6568,5 |

Video Story MP4: preview 3934 ms / 86.670 bytes; final 8127 ms / 788.882 bytes
(uma execucao cada). Cache artwork: 384 hits/112 processamentos ao final;
procedural: 51 hits/40 misses, memoria 33.543.772 bytes.
Mascara 1080x1350 antes: media 16,93 ms (seis calculos). Depois: primeiro
21,35 ms; reutilizacoes 0,004-0,034 ms (cinco hits).

## Pendencias da revisao ampla

1. Extrair brand/history do Legacy; formats/campaign/content/motion ja extraidos.
2. Expandir policies de typography fit para experimentar copy menor antes de
   reduzir fonte; hoje o fit existente permanece e o usuario solicita outra copy.
3. Aprofundar diferencas autorais entre editorial-week/cinema-board/timeline e
   entre spotlight/crossfade; nao apresentar presets proximos como direcoes unicas.
4. Completar matriz visual de todos os layouts, seis generos, 1-6 filmes, semanas
   lotadas e todas as combinacoes de formato/animacao; testes atuais nao cobrem
   visualmente todo esse produto cartesiano.
5. Validar interacao real de grupos no Konva em producao e exportacao animada
   de uma cena editada. O endpoint atual de video gera a partir do draft.
6. Persistencia/status de jobs, caso necessario: fila atual e limitada e cancelavel,
   mas nao e um sistema distribuido nem retorna ID consultavel de job.
7. A analise visual continua heuristica; nao reconhece semanticamente rosto,
   personagem ou logo. Nao existe garantia automatica absoluta de protecao deles.
8. Refinar truncamento de agendas densas e sinalizar todos os horarios/dias
   omitidos por cada builder, sem associar sessoes a outro filme.

## Confirmacoes

- O modulo de e-mail nao foi alterado.
- Nao houve propagacao de codigo para os outros cinemas.
- Campanhas antigas preservam seus registros/cenas; nova geracao passa por
  validacao mais rigorosa, podendo exigir completar dados antes ausentes.
- Konva foi preservado; regressao automatizada passou, com validacao manual
  completa em producao ainda pendente conforme item 5.
- Sidebar nao renderiza campanhas completas.
- Dia, semana e multi tem builders/direcao proprios, ainda com refinamentos
  visuais pendentes entre algumas variantes.
- Preview e exportacao animada utilizam o mesmo MotionSpec e encoder.
