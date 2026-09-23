# Social Studio: animacao sobre a arte aprovada

## Responsabilidades

O Social Studio continua produzindo conteudo, copy, preco, sessoes, cores, enquadramentos,
mascaras, branding e cenas. Satori/Sharp continuam responsaveis pelas imagens estaticas e
pela rasterizacao individual das camadas. Konva continua sendo o unico editor visual.
O modulo de e-mail nao foi alterado.

Remotion 4.0.527 executa a cena em React e produz MP4/H.264 e WebM/VP9. Preview e exportacao
usam o mesmo `MotionSpec` e a mesma funcao `frameState`; somente resolucao e compressao mudam.
O estado final converge para a cena original, com tempo de leitura de pelo menos 2,5 segundos
e ampliacao conforme a quantidade de palavras. Ciclos reservam leitura por filme e no resumo.
O limite e 30 segundos; texto excessivo gera aviso em vez de um video ilegivel.

## Uso

1. Gere a arte e revise a previa.
2. Em Arquivo final, marque **Animar esta arte**. A previa aprovada e salva antes do job.
3. Escolha movimento, intensidade e duracao. A direcao automatica considera genero e campanha.
4. Reproduza, pause ou reinicie usando os controles do video; exporte MP4 ou WebM.
5. Desmarque a animacao para retornar ao PNG. Falhas de video nao bloqueiam a imagem.

No editor manual, **Animar esta arte** salva uma nova versao antes de abrir o Studio.
Reabrir uma campanha recupera as configuracoes do ultimo video da mesma versao da arte.
Versoes anteriores permanecem independentes da imagem original e da edicao atual.

Presets: Cinematic Reveal, Slow Parallax, Dark Reveal, Commercial Focus, Poster Reveal,
Editorial, Poster Cascade, Featured Cycle, Cinema Lineup, Crossfade Program, Spotlight e
entrada simultanea. As posicoes aprovadas nao sao substituidas por slides de outro layout.
CTA e destino compartilham a mesma entrada. Nao ha audio nesta versao; o contrato o reserva.

## Fila e armazenamento

- Uma renderizacao por processo de backend; VPS atual usa uma instancia do backend.
- Worker Node separado, heap limitado a 768 MB, Remotion com concorrencia 1.
- Fila de ate 10 solicitacoes; timeout de 3 minutos e cancelamento com encerramento de seguranca.
- Estados: waiting, rendering, done, failed, cancelled; progresso consultado sem prender o painel.
- Manifestos privados incluem autor, campanha, versao da arte, hash da cena, configuracao e arquivo.
- Cache compara tambem os bytes dos assets. Usuarios e campanhas diferentes nunca compartilham jobs.
- Previews e falhas: ate 24h e cache de previews limitado a 256 MB.
- Finais: ultimas 3 exportacoes por campanha/operador, mantidas entre deploys. Excluir a campanha
  remove seus videos. Baixe os arquivos para preservar mais versoes externamente.
- Temporarios sao removidos no sucesso, erro e cancelamento. Ao reiniciar, jobs interrompidos
  ficam como falha recuperavel. Uma nova tentativa nao altera o PNG salvo.
- Precisa de pelo menos 1 GB livre para aceitar novo render.

Pasta padrao: `shared/social-animation`, derivada do diretorio compartilhado de uploads.
Em desenvolvimento sem uploads externos: `backend/data/social-animation`.
Pode ser substituida por `SOCIAL_STUDIO_ANIMATION_DIR`. Nao servir esta pasta pelo Nginx.
Os endpoints autenticados `animation-jobs` validam o operador. Permissoes de visualizar/criar
do Social Studio continuam obrigatorias.

## Instalacao e deploy

```
npm ci --include=dev
node scripts/build-social-motion.cjs --browser
```

O deploy do Cine Cruzeiro executa esse build antes de ativar a release. `.remotion` guarda o
bundle e o caminho do Chrome Headless Shell baixado pelo Remotion. As dependencias de Chrome
devem estar instaladas no Linux. O navegador nao e baixado dentro de uma requisicao normal.

Variaveis opcionais:

- `SOCIAL_STUDIO_CHROME`: executavel Chrome existente.
- `SOCIAL_STUDIO_REMOTION_BUNDLE`: bundle precompilado alternativo.
- `SOCIAL_STUDIO_FFMPEG`: executavel FFmpeg.
- `SOCIAL_STUDIO_ANIMATION_ENGINE=ffmpeg`: fallback operacional explicito.

O fallback rasteriza os mesmos tracks/quadro e utiliza FFmpeg para codificacao. Nao possui
regras paralelas de timing. E mais lento em cenas grandes e nao substitui Remotion automaticamente
em uma falha: o operador recebe erro e pode tentar novamente. FFmpeg tambem converte GIF.
Documentacao oficial: https://www.remotion.dev/docs/renderer/render-media e
https://www.remotion.dev/docs/renderer/ensure-browser. Verificar a licenca do Remotion para
o modelo comercial de distribuicao adotado antes de ampliar a oferta do produto.

## Validacao reproduzivel

```
node --test tests/social-studio-remotion.test.mjs tests/social-studio-animation.test.mjs
node scripts/render-social-motion-examples.mjs
node scripts/verify-social-motion-examples.mjs
```

Exemplos locais em `artifacts/remotion`: sete categorias em Feed/Square/Story, PNG,
preview MP4, final MP4, comparacao multi-filmes e WebM. `comparacao.html` abre sem servidor.
`verification.json` registra dimensoes e diferenca de pixels entre arte e quadro final.
`report.json` registra tempo, bytes, RSS e CPU do processo Node (nao inclui consumo do Chrome).
Os exemplos nao sao publicacoes nem uma programacao comercial real.

Antes de escalar para varios processos de backend, substituir a fila em memoria por uma fila
compartilhada com trava distribuida. Nao aumentar instancias PM2 sem esse ajuste.
