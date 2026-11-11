# Polimento geral do Cine Cruzeiro

Branch `codex/cine-homologacao-fase23`. A revisão partiu de uma árvore limpa em `21206272e4aeb1ea5d5bafced9164d99dcbc5a6d`, também HEAD remoto naquele momento. O último commit de implementação é `5c71c047bf5ddbaecd4508aedf84bd825cd4fa27`. Para obter o SHA de fechamento, incluindo os três relatórios, use `git log -1 --format=%H -- docs/POLIMENTO_GERAL_CINE_CRUZEIRO.md` nesta revisão.

## Jornada e evidências

Foram corrigidos cinco problemas na fixture de concorrência, na renderização de dados de pedidos, na consulta de poltronas, no catálogo sem arte e na cópia do Pix. Os commits e as reproduções constam na [lista de correções](POLIMENTO_BUGS_CORRIGIDOS.md).

O roteiro abriu todas as rotas de página em `src/app`, a página 404, o login administrativo e os onze painéis do menu. Percorreu as abas de agenda, vendas, pedidos, pagamentos, validação, cardápio, financeiro, Social Studio, campanhas, anúncios, cupons, equipe, clientes, segurança, planos, assinaturas e créditos. [Matriz das 280 observações](POLIMENTO_VALIDACAO_VISUAL.md).

Os testes de navegador exercitam cadastro, recuperação, saída da conta, limpeza de campos pessoais, permissões, navegação, conflito por poltrona, cupom, crédito do Clube, vendas presenciais, troca de sessão, pedidos e acompanhamento de Pix/cartão simulados. A nova cobertura exige foco ao abrir e fechar a troca, bloqueio durante a consulta de poltronas, acesso ao título do filme no celular e disponibilidade do código Pix para cópia manual.

## Desempenho observado

Em Chromium local, servidor de desenvolvimento e dados sintéticos, o evento DOMContentLoaded terminou em 318 ms na home, 99 ms em filmes, 763 ms no detalhe, 192 ms em conta, 125 ms na entrada de checkout e 257 ms na abertura do Admin. São observações individuais de navegação, sensíveis ao cache e à compilação de desenvolvimento. O documento do Admin é compartilhado pelas abas, portanto esse valor não mede o tempo para trocar de aba. A redução medida na interface foi de 450 px de espaço reservado para a arte ausente no detalhe a 360 px de largura. Esta rodada não estabeleceu um gargalo de SQL reproduzível nem mediu carga de produção.

## Regressão e limites

- Os comandos locais de unidade, segurança, manutenção, JSON legado, deployment, desktop e isolamento multi-cinema retornaram sucesso. A bateria de unidade também inclui caracterização e os dois conjuntos financeiros. Casos opcionais de repositórios e campanhas que exigem banco próprio aparecem como ignorados na execução local sem PostgreSQL.
- O E2E JSON completo voltou a passar após o isolamento da sessão. A suíte dirigida do Pix e o percurso visual também passaram. Lint, build e verificação dos links de arquitetura integram a validação local.
- As quatro invocações locais do harness PostgreSQL pararam na verificação do Docker, antes da criação de banco. A validação PostgreSQL ocorre nos serviços descartáveis dos workflows, com concorrência, repositórios, guard, fumaça e backup/restore nas versões 16 e 18, upgrade na 18 e Browser E2E em PostgreSQL 16.
- A falha inicial está registrada no [Browser E2E do SHA de origem](https://github.com/Alanls-mx/CineCruzeiro/actions/runs/42933297708). Para consultar os três resultados do SHA que contém este relatório, execute `gh run list --commit "$(git rev-parse HEAD)"` no checkout correspondente. Cada execução do Browser E2E possui passos individuais para JSON e PostgreSQL.
- Leitor de tela real, teclado virtual físico, impressão, terminal Point, entrega real por SMTP, Google Wallet e provedores de pagamento permanecem fora da homologação desta rodada. As campanhas e pagamentos exercitados são sintéticos. A revisão do navegador verificou telas e fluxos descritos, sem cobrir todas as combinações de dados e permissões.
- A prontidão operacional continua sujeita a conferir dreno, callbacks em trânsito, backup restaurável e conciliação na janela de uma futura atualização. A tarefa usou somente a branch e ambientes de teste. [Registro operacional da Fase 23](FASE23_DEPLOY_VPS.md).
