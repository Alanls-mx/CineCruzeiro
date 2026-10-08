# Programação editorial do Social Studio

Atualização de 24/09/2026. Escopo: Cine Cruzeiro. Não replica alterações para os outros cinemas.

## Estrutura

O módulo existente passa a usar seis estruturas: `program-hero` (um filme), `program-duo` (dois), `program-cards` (três ou quatro), `program-grid` (cinco ou seis), `program-list` (sete ou mais) e `program-days` (múltiplos dias).

O quadrado e o feed usam duas colunas na dupla e três na grade compacta. Stories usa dupla vertical e grade de duas colunas. A lista ajusta tipografia à densidade disponível. Templates incompatíveis com a quantidade são resolvidos automaticamente. IDs antigos são aceitos e migrados para essas estruturas.

Os três tratamentos visuais são Pôsteres, Editorial clean e Cinematográfico. Este último utiliza apenas uma imagem ambiente discreta, desfocada e escurecida; não combina faixas ou cores de vários filmes. Se o contraste final falhar, usa fundo sólido. O modo sem pôsteres é editorial. Destaque de filme depende de seleção explícita; agendas densas priorizam os horários.

## Informação

- Seleção de até 12 filmes; excesso é recusado, não descartado silenciosamente.
- Datas crescentes; grupos dentro do dia ordenados pelo primeiro horário, com desempate pelo título. Todos os horários do mesmo filme/dia permanecem juntos, únicos e ordenados.
- Múltiplos dias usam agenda por dia. Em duas colunas, leitura de cima para baixo na primeira coluna, depois na segunda.
- Título calculado pelas datas efetivamente presentes. “Hoje” somente no template do dia quando a data corresponde ao dia atual. “Da semana” somente para intervalo real de sete dias.
- CTA do dia: “ESCOLHA SUA SESSÃO”; demais: “CONFIRA A PROGRAMAÇÃO”. Preserva o destino configurado.
- Sessões canceladas, indisponíveis ou passadas continuam excluídas pelas regras existentes. Não cria filmes, datas, horários, preços ou disponibilidade.
- Filme selecionado sem sessões gera aviso com o nome e impede a exportação.
- Agenda que não cabe com fontes legíveis gera `PROGRAM_CAPACITY`, orientando reduzir o período ou dividir a seleção. Não corta horários nem acrescenta “mais sessões” para esconder conteúdo.

## Proteções

Rodapé com área própria para chamada e URL; assinatura única no canto inferior direito. Pôsteres nítidos em `contain`, sem deformação. Títulos completos em até duas linhas. A seleção de estrutura reduz decoração antes de comprometer a leitura.

A validação existente de PNG, JPG e animação também verifica o manifesto da programação: texto presente e íntegro, ordem visual dos filmes, vínculo espacial entre filme e horários, equivalência dos pôsteres, posição da assinatura, sobreposições, safe areas e contraste medido no raster. Alterar um horário ou separá-lo de seu filme no editor exige gerar novamente a composição a partir das sessões.

## Verificação

`node --test tests/social-studio-programming-editorial.test.mjs` cobre quantidades, formatos, agrupamento, títulos factuais, edição incorreta, modos de pôster e excesso de conteúdo.

`node scripts/verify-social-studio-programming.mjs` gera 15 artes principais (1, 2, 3, 5 e 8 filmes nos três formatos), cinco comparativos, três estilos e uma agenda por dia, em `artifacts/studio-programming-editorial`. Usa cartazes do catálogo real e **horários sintéticos de teste**. Não publica posts nem altera o catálogo. Esses exemplos não devem ser divulgados como programação comercial.

O teste do painel com Playwright verifica desktop, tablet e mobile, incluindo os novos controles. TypeScript passa. Na suíte ampliada, foi identificada uma falha já existente no teste de proporção de imagem da bomboniere (`social-studio-polish.test.mjs`); foi reproduzida isoladamente no commit anterior, sem as alterações desta entrega. O módulo de bomboniere não foi alterado nesta revisão.
