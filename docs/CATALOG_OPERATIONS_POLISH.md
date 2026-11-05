# Filmes, sessoes e contabilidade

## Exclusao do catalogo

- Excluir nao e o mesmo que arquivar. Filmes excluidos deixam o catalogo, a agenda e as opcoes comerciais, inclusive depois de recarregar ou reordenar a lista.
- Sem vinculos, a exclusao remove o filme e suas sessoes. A limpeza de midia continua respeitando referencias de outros registros.
- Com historico, preservamos IDs, sessoes e midias para consulta de pedidos, ingressos e relatorios. `metadata.catalogDeletedAt` identifica a exclusao do catalogo; o slug original fica em `catalogOriginalSlug`.
- Sessoes futuras com ingressos, pedidos ativos ou reservas temporarias impedem a exclusao. A equipe precisa tratar esses vinculos primeiro.
- Filmes ocultos anteriormente nao sao excluidos em massa. A equipe pode usar Excluir novamente nos registros desejados.
- O filtro financeiro continua incluindo os filmes historicos: remover do catalogo nao elimina receitas ou a memoria de calculo.
- PostgreSQL verifica referencias dentro de uma transacao e bloqueia atualizacoes atrasadas de filmes e criacao de sessoes em filmes excluidos.

## Sessoes

Datas inexistentes e horarios fora de 00:00 a 23:59 sao rejeitados, inclusive em lotes. Trocar o ID da sala exige as mesmas protecoes que trocar seu nome. Reservas temporarias tambem impedem a troca da sala.

O painel mostra dia da semana, data e situacao junto ao horario. Contadores de sessoes ativas excluem exibicoes encerradas/canceladas; ingressos pendentes nao contam como vendidos. Busca e filtro do catalogo preservam o formulario em edicao.

## Contabilidade

Periodos usam dias inclusivos exatos e validam ordem, datas e limite de 366 dias. Grafico diario e totais usam a mesma data de reconhecimento em Sao Paulo. A apuracao rejeita percentuais invalidos e preserva regras omitidas em atualizacoes parciais.

Reembolsos parciais preservam o saldo liquido. Falha ao carregar apuracao limpa valores antigos e desabilita exportacao. Em consultas simultaneas, apenas a resposta da ultima selecao pode atualizar a tela.

## Verificacao

`npm run test:catalog-operations` executa testes de dominio e HTTP em armazenamento JSON temporario. O teste PostgreSQL exige `TEST_DATABASE_URL` apontando para um banco de testes migrado. Nunca apontar para producao.

`CATALOG_UI_CHECK=1` ativa verificacao Playwright do painel em desktop, tablet e celular no teste HTTP. Capturas ficam em `scratch/catalog-polish-qa`.

Esta rodada nao altera contratos de repasse nem recalcula registros de vendas existentes. Sem migracao de esquema.
