# Revisao do gerador de artes

Data: 24/09/2026. Escopo: Cine Cruzeiro, sem replicacao aos demais cinemas.

## Arquitetura preservada

O fluxo existente permanece: normalizador -> conteudo comercial -> composicao em camadas -> renderer Satori/Sharp -> editor Konva e exportacao Remotion. As novas familias sao builders desse mesmo scene graph, nao um segundo gerador. Nenhuma tabela, autenticacao, rota comercial, produto, plano ou sessao foi alterado.

## Causas encontradas

- Layouts legados definiam assinatura no centro inferior; `scene/branding.js` procurava intervalos livres e ampliava o logo sem uma zona editorial fixa.
- Posicionamento de data, polimento, politica do artwork e geometria da marca eram aplicados sequencialmente, podendo disputar o mesmo espaco.
- A customizacao de catalogo dividia o background em ate tres colunas. Filmes, programacao e produtos agora usam uma superficie continua; compra online mantem seu comportamento explicito anterior.
- A bomboniere reutilizava hierarquias e tratamentos de filmes. Isso podia diminuir embalagens e produzir texto escuro sobre fundo escuro.
- A avaliacao anterior era majoritariamente geometrica e indicativa. Nao impedia toda exportacao com contraste insuficiente depois de editar manualmente.

## Familias principais

Filmes: Poster lateral, Poster e rodape editorial, Cinematic blend e Story cinematografico. A selecao automatica prioriza lateral no quadrado, editorial no feed e Story no vertical. Blend requer backdrop distinto; sem ele, usa lateral ou Story. O poster principal permanece inteiro, nitido e separado do fundo.

Bomboniere: Produto + preco, Produto lateral e Hero product. Os quatro tratamentos de cor/material continuam disponiveis separadamente. A categoria e o objetivo orientam tratamento, texto e escala; limites alfa eliminam margens transparentes do produto sem remover embalagem.

Nenhum template salvo foi apagado. As familias experimentais de filmes sairam da selecao automatica e do conjunto principal de variacoes. Escolhas legadas salvas permanecem reconhecidas e passam pela mesma revisao; podem sofrer recomposicao quando reprovadas. Clube, oferta de ingresso e compra online continuam com seus motores atuais.

## Marca e imagem

- Logo nos cantos inferiores ou superior esquerdo quando houver espaco, nunca sobre texto ou imagem principal.
- Filmes: largura de referencia de 14% do canvas, escala manual limitada a 19%; bomboniere: ate 19%, ou 16% quando a embalagem ja apresenta a marca.
- Bounding box reservado, proporcao real, margem minima e teste de colisao. A exportacao manual rejeita logo central ou dominante.
- Hero de filme usa `contain`, sem recortar rostos ou titulo incorporado. Fundo pode receber crop e blur independentes.
- A paleta e extraida da imagem. O fundo editorial escurece essa paleta, sem impor azul institucional aos filmes.
- Ausencia de logo remove a imagem e permite assinatura textual. Produto sem imagem valida exige correcao; nao e substituido por poster do filme vinculado.

## Conteudo

- CTAs padrao: ESCOLHA SUA SESSAO; COMPRE SEU INGRESSO para venda direta disponivel; VEJA A PROGRAMACAO; EM BREVE quando nao ha compra disponivel. Texto explicitamente travado permanece manual.
- Datas absolutas no horario de Sao Paulo: `QUI • 24/09 • 13H00 / 19H30`. Campos de sessao continuam estruturados; somente apresentacao muda.
- Copy generica deixa de ocupar obrigatoriamente o poster editorial. Prioridade para titulo, data/sessao e acao.
- Produto usa nome/preco do cadastro, com moeda e valor juntos. Legenda considera categoria, objetivo, briefing e filme vinculado, sem inventar descontos, quantidades ou disponibilidade.
- Oferta sem preco real continua bloqueada pela validacao comercial ja existente. Nenhum preco substituto foi criado.

## Validacao e fallback

`validateArtworkLayout` e a revisao de bomboniere verificam area segura, tamanho minimo, overflow, colisao, texto encoberto, logo, preservacao do poster e agrupamento CTA/destino. Grupos essenciais transparentes ou rotacionados exigem ajuste individual.

Contraste e calculado numa rasterizacao reduzida da pilha real de imagens/gradientes/fundos personalizados. Limiar 4,5:1 na amostra conservadora de cada area textual. O reparo troca a cor ou aplica gradiente local. Essa rasterizacao e cacheada por conteudo e nao achata a cena editavel.

Se a composicao falhar: reposiciona assinatura, corrige contraste e tenta uma lista limitada de familias seguras. A previa informa quando houve recomposicao. Persistindo o problema, resposta 422 com motivos; nao entrega silenciosamente a arte reprovada. PNG/JPG e Remotion repetem a validacao depois da edicao manual. Variacoes reprovadas ficam fora da selecao.

O score combina medidas de leitura/contraste e destaque do produto. Nao e uma avaliacao humana nem garantia estetica universal.

## Arquivos principais

- `contracts/artwork-layout.js`: familias, safe areas, datas, horarios e CTA.
- `contracts/concession-campaign.js`: categoria, objetivo, tratamento e copy de produtos.
- `scene/movie-editorial.js` e `scene/concession.js`: composicoes por formato.
- `composition-engine/artwork-quality.js` e `concession-quality.js`: revisao e contraste raster.
- `engine/renderer.js`, `normalizer.js`, `content-rules.js`: integracao, dados, fallback.
- `scene/renderer.js`, `scene/customization.js`, `scene/factory.js`: exportacao e backgrounds.
- `composition-engine/variations.js`, `programming/builders.js`, `copy-engine/index.js`: curadoria, horarios e chamadas.
- `contracts/campaign.js`, `templates/registry.js`: compatibilidade e registro.
- `remotion/renderer.js`: validacao dos videos.
- `backend/public/social-studio.js`, `.css`, `backend/server.js`: controles, miniaturas e aviso da revisao.
- Testes `social-studio-*.test.mjs` e scripts `verify-social-studio-*`: regressao e evidencias.

## Evidencias reproduziveis

- `node --test --test-isolation=none tests/social-studio*.test.mjs`: suite do modulo, incluindo exportacao de video, editor, dados comerciais e novos testes negativos.
- `node scripts/verify-social-studio-artwork-quality.mjs`: 105 artes reais, cinco filmes e cinco produtos em tres formatos; PNG, scene JSON e grades em `artifacts/studio-artwork-review`.
- Filmes: Gladiador 2, Resident Evil, Toy Story 5, Coyote vs. ACME e Harry Potter e a Pedra Filosofal (Relancamento), incluindo titulo longo e posters claros/escuros.
- Produtos: chocolate, refrigerante, pipoca, Combo Classico e Combo Familia.
- `node scripts/verify-social-studio-concessions.mjs`: matriz adicional dos quatro tratamentos, 60 artes locais.
- `node scripts/verify-social-studio-customization.mjs`: oito campanhas de customizacao/programacao e dois videos Remotion; compara o ultimo frame com a arte estatica.
- `node scripts/verify-social-studio-workspace.mjs`: desktop, tablet e celular com API simulada; navegacao, controles, progresso, erro, retry e exportacao.

Os scripts de QA nao publicam posts e nao alteram o catalogo. Dados reais representam o cadastro no momento da geracao, nao uma nova confirmacao editorial de estreias. Dados sinteticos de testes estao explicitamente limitados aos testes.

Resultado desta revisao: 150/150 testes do modulo; 105/105 artes da matriz real aprovadas e inspecionadas nas dez grades; oito campanhas de customizacao e dois videos Remotion exportados, com ultimo frame comparado a arte estatica; interface aprovada nos tres viewports; `npm run lint` sem erros. Apos o ultimo ajuste do seletor automatico, os 19 testes relacionados foram executados novamente e passaram.

## Limitacoes

- Nao ha reconhecimento facial/OCR. A protecao usa o poster completo ou uma regiao central conservadora nos layouts legados. Nao detecta automaticamente rostos dentro de um background personalizado.
- Medicao de texto e contraste usa heuristicas e raster reduzido; revisao humana da arte continua recomendada.
- Deteccao de marca na embalagem e explicita, por checkbox/metadado, nao por visao computacional.
- Composicoes com pouco conteudo ficam deliberadamente mais simples. Blend e Story podem convergir para a mesma familia segura se o material/formato nao comportar a proposta original.
- Arquivos antigos ja exportados nao sao reprocessados. Ao reeditar, as novas barreiras podem pedir ajustes antes de exportar novamente.
