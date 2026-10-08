# Conteúdo e programação

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

## Exportação

O Studio gera apenas imagens estáticas em PNG ou JPG. O histórico preserva os rascunhos e as peças aprovadas; não há publicação automática em redes sociais.

## Validação

- Testes de regressão do Studio e testes de conteúdo, período, cancelamento, seleção, histórico e grade em três formatos.
- Exemplos de estreia, pré-venda, compra online, sessões do dia, sessões da semana, grade e destaque.
- Arquivos locais de inspeção: `scratch/studio-content-qa/`. Não são campanhas publicadas e não alteram dados de vendas.
