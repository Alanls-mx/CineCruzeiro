# Social Studio: composição e direção de arte

## Escopo

Evolução incremental do Studio V2, com editor Konva e exportação Satori/Sharp existentes. Não altera e-mails nem replicas de outros cinemas. Artes já salvas mantêm suas cenas e imagens; novas composições usam os novos controles.

## Operação

- **Direção automática** seleciona uma composição com base no gênero, no filme e na análise visual. Um layout escolhido manualmente tem precedência.
- **Gerar variações** apresenta até quatro propostas geometricamente diferentes. Não cria posts no histórico nem publica em redes sociais. Escolher uma proposta aplica seus parâmetros; **Gerar arte** salva a campanha.
- **Filme dominante / Data ou preço dominante** troca a hierarquia. Os layouts incluem Hero Left/Right/Center, Full Bleed, Diagonal, Split, Editorial, Poster Dominant e Typography Dominant, além dos estilos anteriores.
- Fundo e hero possuem enquadramentos independentes: posição, escala e recortes percentuais por borda. Campos vazios usam o enquadramento automático.
- Modos do hero: retangular, retângulo suave, bordas dissolvidas, integração completa e flutuante.
- Os ajustes avançados permitem atmosfera, primeiro plano, imagem secundária, sombra, iluminação, vinheta, textura e máscaras.
- No Konva, desbloqueie a camada para ajustar efeitos, enquadramento ou posição. As imagens processadas são as mesmas usadas na exportação.
- A reprodução animada é uma prévia de movimento. O download continua sendo PNG/JPG, não MP4/WebM.

## Pipeline

`normalizer -> análise -> direção -> cena -> contraste -> avaliação -> render`

Arquivos em `backend/services/social-studio/composition-engine/`:

- `config.js`: limites, presets por gênero, looks e normalização dos parâmetros.
- `direction.js`: zonas protegidas dos layouts, grids, enquadramento independente e variação determinística por filme/seed.
- `masks.js`: máscaras alfa reutilizáveis; mantém o centro nítido e suaviza as bordas.
- `pipeline.js`: processamento Sharp, recorte orientado, luz local, sombras, atmosfera e cache.
- `contrast.js`: amostragem da composição, escolha entre texto claro/escuro e proteção localizada.
- `score.js`: heurística de geometria, contraste, dimensões e visibilidade.
- `variations.js`: gera propostas diferentes e descarta as que não passam nos critérios mínimos.
- `motion.js`: planos transparentes e descritor de movimento reutilizáveis por um futuro encoder de vídeo.

Ordem: fundo, banho de cor, atmosfera, arte secundária opcional, sombras, luz local, hero, primeiro plano, vinheta, contraste localizado, tipografia e marca. Nem todos os presets usam todas as camadas.

O backdrop é preferido para o fundo e o pôster para o hero. Sem backdrop, o fundo usa outro enquadramento do pôster. Full Bleed só usa o backdrop sem desfoque quando ele tem ao menos 1000 px de largura e proporção horizontal >= 1,3; caso contrário preserva o pôster integrado e emite aviso.

## Análise e limites

A análise usa luminância, variação local e densidade de bordas em uma miniatura. É uma **heurística**, não reconhecimento de rostos, personagens ou logotipos. Layouts laterais reservam uma zona do hero fora da tipografia; Full Bleed busca a região comparativamente menos complexa do enquadramento efetivo.

O contraste é estimado em amostras da região do texto, usando percentis para evitar que um único pixel domine a decisão. A meta é 4,5:1. Não equivale a uma garantia semântica ou a uma auditoria manual de todos os pixels.

O score penaliza texto fora da área segura, fontes pequenas, overflow, sobreposição, pouco espaço para a marca e interferência na zona central do hero. Propostas precisam de pelo menos 75/100 e não podem conter sobreposição de texto, overflow ou invasão da zona protegida. Se não houver três propostas adequadas, a interface informa que o conteúdo precisa ser revisto; não devolve opções ruins apenas para preencher a grade.

Não há remoção de fundo por IA. As máscaras são transições alfa; elas não recortam semanticamente pessoas.

## Desempenho e segurança

- Cache por SHA-256 do conteúdo, dimensões e parâmetros normalizados; TTL de 20 minutos, limite de 40 entradas e 64 MiB.
- Requisições idênticas em andamento compartilham a mesma promessa.
- Máximo de dois processamentos de efeitos simultâneos; fila limitada a 100.
- Imagens de origem continuam passando pelo carregador autorizado e seus limites de tamanho/hosts; nenhuma URL arbitrária é liberada.
- Dimensões e efeitos são limitados no servidor, incluindo os parâmetros enviados pelo Konva.
- Endpoints de criação/variações/movimento exigem `social_studio.create`; assets mantêm `social_studio.view`.
- Reprodução respeita redução de movimento do sistema. Preferências e enquadramentos são salvos no rascunho e no histórico.

## Verificação

```powershell
node --test tests/social-studio.test.mjs tests/social-studio-v2.test.mjs tests/social-studio-editor.test.mjs tests/social-studio-layout.test.mjs tests/social-studio-composition.test.mjs tests/social-studio-direction.test.mjs
npm run lint
npm run build
```

Os testes cobrem presets, máscaras, alfa de sombras/luz, crop independente, cache, fallback, persistência, equivalência prévia/exportação, hierarquia, análise, grids, score e variações. A revisão visual local inclui terror, animação, ação e comédia, além de desktop e mobile. Os exemplos são campanhas de teste, não confirmação de datas comerciais.
