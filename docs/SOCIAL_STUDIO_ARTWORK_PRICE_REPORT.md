# Social Studio V2: assinatura, precos e direcao de arte

Data: 23/09/2026. Escopo: somente Cine Cruzeiro. O Studio existente, seu editor Konva, os grupos e o historico foram preservados. Nenhum template ou servico de e-mail foi alterado.

## Causas e correcoes

### Assinatura

O controle chegava ao draft, mas a montagem dirigida usava dimensoes fixas da logo. O acabamento e os layouts de programacao tambem redefiniam essas dimensoes. Portanto, o problema principal nao era `withoutEnlargement`: essa protecao pertence a preparacao raster legada, nao ao dimensionamento visual da cena V2.

`scene/branding.js` agora calcula os bounds uma unica vez, depois do layout/acabamento. Le a proporcao real do arquivo, reserva espaco para o limite de 135%, procura intervalos livres de texto e do hero e aplica a escala. A escala explicita vence a proeminencia automatica. A cena resultante e a fonte de verdade para preview, Konva, PNG/JPG e motion. O arquivo original nao e reamostrado apenas para aumentar o tamanho visual.

Foi preservado o intervalo 70-135. Exemplo medido com a logo 3D real, layout lateral:

| Escala | Largura | Altura | Proporcao |
| --- | ---: | ---: | ---: |
| 70% | 88,06 | 50,30 | 1,75084 |
| 100% | 125,80 | 71,85 | 1,75084 |
| 120% | 150,96 | 86,22 | 1,75084 |
| 135% | 169,83 | 97,00 | 1,75084 |

Esses tamanhos variam conforme o espaco disponivel no layout; os fatores relativos permanecem os mesmos. Nao ha deformacao. Se nao houver espaco utilizavel, a exportacao informa o problema em vez de sobrepor silenciosamente o conteudo.

### Preco

O fluxo antigo percorria os valores das sessoes e tomava o menor, normalmente a meia-entrada. Esse minimo era usado como se fosse a decisao editorial do operador.

O novo contrato `priceSelection` separa `ticket-type`, `minimum`, `manual` e `legacy`. Guarda `ticketTypeId`, `sessionId` e, no modo manual, `value`. O resultado semantico `priceInfo`/`content.price` inclui valor, rotulo, tipo, variacao e exibicao. O historico guarda a selecao e o valor formatado da arte; a cena salva conserva o resultado usado na exportacao.

Novas campanhas pedem uma escolha. Inteira nao vira Meia ao normalizar, trocar o formato ou recarregar. Menor preco e opcao explicita. Se o mesmo tipo custa 25 e 30 em sessoes diferentes, todas as sessoes mostram "a partir de 25"; a sessao de 30 mostra exatamente 30. Sessoes encerradas, indisponiveis e canceladas nao fornecem ofertas.

A interface mostra os tipos reais do cadastro, a sessao e o valor utilizado apenas em Ingresso + preco. A legenda acompanha a escolha, respeitando o bloqueio manual de texto. Campanhas antigas com apenas `price` mantem o snapshot legado, sem exigir migracao destrutiva.

## Direcao de arte

- `artworkMetadata`: titulo, logo oficial, data, creditos, protagonista, bounds de conteudo e verificacao da data. Overrides ficam associados ao asset; trocar filme/upload limpa as informacoes anteriores.
- `artworkStrategy`: FULL_POSTER, CROPPED_POSTER, BACKDROP_HERO, LOGO_DOMINANT, SYMBOL_DOMINANT, CHARACTER_DOMINANT, POSTER_BLEND e FULL_BLEED, alem da selecao automatica.
- Logo/simbolo podem ocupar mais espaco, com recorte orientado pela densidade de bordas. O recorte manual continua tendo prioridade.
- Titulo incorporado pode ser ocultado ou reduzido a apoio. A data so e delegada ao poster quando um operador confirma a mesma data e o mesmo contexto internacional; nao se confunde com estreia local.
- `primaryElement` identifica o protagonista e aparece na lista de camadas do Konva. A marca tem proeminencia subtle/normal/strong, com prioridade da escala manual.
- Novo preset de comedia e looks de atmosfera fria e movimento complementam os generos existentes, sem condicionais por nome de filme.
- Copy editorial nao promete estreia local nem compra. Tambem foi retirada a chamada implicita "Confira as sessoes" dos destaques editoriais sem programacao confirmada.

## Curadoria

Pesos de campanhas individuais: contraste 9%, hierarquia 10%, leitura 13%, equilibrio 5%, marca 5%, clareza comercial 11%, safe area 10%, coerencia 10%, redundancia 5%, densidade 5%, continuidade 4%, aproveitamento da arte 5%, protagonista 4%, genero 4%.

Densidade usa ocupacao aproximada e metas diferentes para minimalista, impacto e editorial. Aproveitamento considera o tamanho realmente ocupado pelo asset em contain, inclusive recorte. Continuidade considera fundo derivado, mistura e sombras. Uma composicao automatica classificada como seca tenta uma alternativa limitada a uma tentativa. Programacao conserva sua avaliacao especializada.

Pontuacao nao e garantia estetica: na comparacao local algumas artes antigas tiveram notas maiores apesar de duplicarem titulo ou sugerirem sessoes inexistentes. A revisao visual e a coerencia dos dados continuam necessarias; nao aumentamos notas artificialmente para aparentar melhoria.

## Verificacao

- Suite completa: 97 testes passaram; depois foi acrescentado mais um teste de escala sem direcao automatica nos tres formatos. Suite especifica final: 8/8.
- Fixtures: Inteira 28, Meia 14, Promocional 20, minimo explicito 14, manual e precos variaveis 25/30; selecao/historico/normalizacao.
- Assinatura: 70/100/120/135, bounds e pixels PNG, proporcao JPG, planos de animacao, acabamento ligado/desligado e tres formatos.
- Playwright: desktop 1440x1000 e mobile 390x844, trocas de ingresso, legenda, minimo explicito, recarga e campos condicionais, sem erros JS ou overflow horizontal.
- Konva real: redimensionamento proporcional, salvar versao, reabrir, exportar PNG; metadados e preco preservados.
- Arquivos MP4 e WebM gerados da cena editada. Suite de codificacao tambem verificou GIF, fila e cancelamento.
- `npm run lint`, `npm run build` e `git diff --check` executados.
- Comparacoes com assets de logo forte, simbolo, titulo embutido, personagens, poster tradicional e espaco vazio; a suite tambem cobre data incorporada e full bleed com backdrop horizontal.

As imagens e datas da galeria sao fixtures de teste, nao anuncios de sessoes confirmadas. Arquivos locais em `artifacts/social-studio-artwork-price/`: `comparison.png` (antes a esquerda, depois a direita em cada par), `signature-scales.png`, `price-desktop.png`, `price-mobile.png`, `editor-desktop.png`, `editor-export.png`, `price-animation.mp4`, `price-animation.webm`, `report.json`, `browser.json` e `editor-report.json`.

Medicao local em seis pares: media anterior 1.611 ms; nova 1.729 ms, aproximadamente +7,4%. Nao e benchmark isolado nem p95 da VPS: houve outros processos de teste concorrentes. A analise usa raster 96x96 e cache; nao adiciona OCR nem chamadas externas a cada render.

## Arquivos

Novos: `contracts/price.js`, `scene/branding.js`, `composition-engine/artwork-policy.js`, `composition-engine/artwork-score.js`, `tests/social-studio-artwork-price.test.mjs`, `scripts/verify-social-studio-artwork.mjs` e este relatorio.

Alterados dentro de `backend/services/social-studio/`: `composition-engine/config.js`, `direction.js`, `score.js`; `contracts/campaign.js`, `content.js`; `copy-engine/index.js`; `engine/content-rules.js`, `normalizer.js`, `renderer.js`; `scene/factory.js`; `types/index.d.ts`.

Outros: `backend/services/socialStudioService.js` (persistencia), `socialStudioEngineService.js` (legendas), `backend/server.js` (metadata do catalogo), `backend/public/social-studio.js` (controles), `backend/public/admin.html` (cache), `src/components/social-editor/LayersPanel.tsx` e `tests/social-studio-v2.test.mjs`.

## Limites e reproducao

- Nao ha reconhecimento semantico de rosto/logo/texto. Campos nao informados permanecem desconhecidos; a analise de bordas nao pretende substituir uma conferencia humana.
- Full bleed depende de backdrop horizontal suficiente. Sem esse asset, o fallback preserva o poster integrado.
- Datas internacionais impressas devem ser conferidas manualmente. O sistema nao traduz nem autentica datas por OCR.
- A galeria nao publica campanhas nas redes sociais nem modifica campanhas salvas de clientes.
- Para reproduzir antes/depois, extraia os servicos e assets da revisao `ea04baf` para `scratch/studio-before` e execute `node scripts/verify-social-studio-artwork.mjs`. `STUDIO_BASELINE` aceita caminho alternativo para o servico da revisao anterior.
- Publicacao prevista pelo fluxo habitual, com `--only cinecruzeiro`, sem atualizar os demais cinemas. A confirmacao do commit e saude da VPS acompanha a entrega.
