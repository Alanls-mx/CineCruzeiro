# Conteúdo, programação e animação

Evolução do Studio V2 em 22/09/2026. Mantém o editor de cenas, campanhas estáticas e permissões existentes. Não modifica e-mails nem replica código para outros cinemas.

## Regras de conteúdo

`engine/content-rules.js` resolve dados antes do layout. Estreia e pré-venda exigem data; o layout aproxima a chamada da data. Chamadas para compra, site e programação exigem o endereço oficial junto ao CTA. O site vem da configuração da marca, não de um campo opcional do post.

Exportar ou salvar campanhas sem data obrigatória, endereço necessário ou seleção mínima de filmes é bloqueado com orientação. Pré-venda sem sessões cadastradas gera aviso de confirmação: o Studio não abre vendas nem cria sessões.

Posts que prometem sessões exibem os horários conhecidos. Sessões do dia e da semana filtram o catálogo por data, hora e disponibilidade. O fuso é America/Sao_Paulo. Sessões passadas, canceladas, desativadas e esgotadas não entram; horários iguais são deduplicados. O período semanal cobre sete dias a partir da data inicial. Sem data inicial, começa hoje.

Muitos horários são resumidos com os primeiros e a quantidade restante. Nos posts com mais de dois filmes, aparece o primeiro dia disponível e a indicação dos demais dias no site. O fallback "Sessões disponíveis no site" é usado somente sem horários disponíveis no período. As datas e horários de exemplos de teste são fictícios, não programação real.

## Campanhas

- Sessões do dia: filme, data inicial, horários daquele dia, CTA e site.
- Sessões da semana: filme, período de sete dias e horários agrupados por dia.
- Vários filmes: de dois a seis filmes do catálogo, com ordem definida pelos campos Filme 1 a Filme 6. Lançamentos apenas editoriais não entram na programação.
- Composições multi-filmes: grade, editorial, resumo em lista, pôsteres com rodapé e destaque + grade. Resumo em lista é uma arte única; não exporta slides de carrossel separados.
- Todos se adaptam a feed 4:5, quadrado e story, mantendo pôsteres sem distorção.

O score inclui coerência: data próxima à estreia, site próximo ao CTA, horários presentes e quantidade mínima de filmes. Não representa previsão de vendas.

## Animação

Em Arquivo final, ative **Gerar versão animada**. O Studio prepara uma prévia do próprio arquivo codificado. **Exportar animação** baixa MP4, WebM ou GIF. O fluxo de salvar arte e o histórico continuam usando PNG/JPG, mas preservam a configuração de animação para reexportação.

Presets: cinematográfico (zoom lento no fundo e revelação), comercial (entrada mais rápida), suave (fade simultâneo). Títulos, datas e CTA entram em até 1,2 segundo; o texto fica estável depois disso. Pôsteres múltiplos e listas de sessões entram em sequência discreta. Não há áudio, giro ou bounce.

- Durações solicitadas: 5, 8 ou 10 segundos. O planejamento pode elevar para a próxima duração para acomodar a leitura.
- Acima de 60 palavras, a exportação pede redução do conteúdo, em vez de acelerar sua apresentação.
- Vídeos: 720 px de largura, altura proporcional e 20 fps. GIF: 480 px, 12 fps e 128 cores, para limitar tamanho.
- Loop do GIF é incorporado ao arquivo. MP4/WebM usam repetição no player; outras redes controlam sua própria repetição.
- Prévia e exportação usam os mesmos bytes. Não há publicação automática em redes sociais.

## Operação

O encoder requer FFmpeg no PATH (ou `SOCIAL_STUDIO_FFMPEG` apontando para o executável). Na VPS Ubuntu:

```sh
sudo apt-get update
sudo apt-get install --no-install-recommends ffmpeg
```

Não há shell montado a partir dos campos do usuário. O processo usa argumentos separados, uma execução por processo de backend, uma thread de codificação e timeout de 90 segundos. Arquivos temporários ficam em diretório exclusivo e são removidos ao concluir ou falhar. Desconexão cancela o encoder. Exportação limitada a 30 MB. Se o backend passar a ter múltiplos workers, usar fila compartilhada antes de ampliar a concorrência.

A rota POST `/api/admin/social-studio/animation` exige `social_studio.create`. O arquivo é devolvido diretamente, sem manter vídeos na VPS. A arquitetura separa conteúdo, cena, planos de imagem e encoder, permitindo substituir o encoder por um worker no futuro.

Referência técnica: [filtros oficiais do FFmpeg](https://ffmpeg.org/ffmpeg-filters.html), especialmente fade, overlay, zoompan e palettegen/paletteuse.

## Validação

- Testes de regressão do Studio e testes de conteúdo, período, cancelamento, seleção, histórico e grade em três formatos.
- Exemplos de estreia, pré-venda, compra online, sessões do dia, sessões da semana, grade e destaque.
- MP4, WebM e GIF codificados localmente, com inspeção de quadros e teste de prévia/download em Playwright desktop/mobile.
- Arquivos locais de inspeção: `scratch/studio-content-qa/`. Não são campanhas publicadas e não alteram dados de vendas.
