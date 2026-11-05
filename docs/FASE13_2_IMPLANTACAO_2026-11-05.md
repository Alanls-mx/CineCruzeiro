# Cine Cruzeiro — implantação na VPS em 05/11/2026

## Resultado

O usuário autorizou a implantação na VPS `18.231.175.103` e identificou as instalações como versões de desenvolvimento. A release de código `6d216eb5fb956bba88d9726b3cf7aaaf8de86f8b` foi ativada em `/home/ubuntu/projects/cinecruzeiro/current`, apontando para `releases/20261105-221045-6d216eb`. A release anterior `20261010-041635-ea7c5df` foi preservada. Os processos PM2 `cinecruzeiro-backend` e `cinecruzeiro-frontend` estão online. Os quatro outros cinemas permaneceram online.

Esta implantação não equivale à homologação de pagamentos, Point, Wallet, e-mail ou callbacks externos. Nenhuma transação real foi criada para testar a release.

## Preparação e recuperação

- O dump de 28/10 em Documentos teve o SHA-256 conferido e foi restaurado em PostgreSQL 18 temporário, sem acesso de rede. O ensaio confirmou 48 migrations, 33 pedidos, 33 pagamentos e 19 ingressos; a instância temporária foi removida.
- Um backup novo anterior ao corte foi salvo na VPS como `backups/cinecruzeiro-20261105T221441Z-precut.dump`, modo `0600`, SHA-256 `77ac1d411b0d383ae7334d308c48d7adbb0f60a55432c26f2c35e0c5469ff74b`.
- Os arquivos `shared` foram preservados em `backups/cinecruzeiro-20261105T221607Z-shared.tar.gz`, modo `0600`, SHA-256 `d7d5337520146a0d43dec0d02071c0e9aa2ffd6df432a899494bf337d2f86cef`. A configuração PM2 e a configuração Nginx anterior também foram copiadas para `backups`.
- Após parar os dois processos Cine Cruzeiro, foi criado o dump do ponto de corte `backups/cinecruzeiro-20261105T222028Z-cut.dump`, modo `0600`, SHA-256 `9b8dce58ead11eda9914e5a2703d14db8d7ae0f84ab7e0703d2c4c3b9a639255`. Esse dump também restaurou com sucesso em PostgreSQL 18 temporário, sem rede, com as mesmas contagens; a instância temporária foi removida.
- As cópias do dump anterior, do dump do corte e de `shared` foram guardadas em `C:\Users\alanl\Documents\Backups-VPS\2026-11-05_Cine_PreDeploy`. Os hashes foram conferidos. Nenhum backup ou release anterior foi apagado.

## Corte e migração

Uma regra temporária no servidor HTTPS do Nginx retornou 503 apenas ao prefixo `/projects/cinecruzeiro`. O site LumixEngine e a Casa da Mãe Tiana continuaram respondendo. Havia uma conexão persistente entre Nginx e o backend antigo; não havia consulta de banco ativa, apenas conexões ociosas. A conexão foi encerrada ao parar somente os dois processos PM2 do Cine Cruzeiro. O Nginx permaneceu em manutenção durante o snapshot e a migração.

O manifesto restrito confirmou banco, role, origem TCP, SHA da candidata, 48 migrations aplicadas, duas pendentes e hashes dos 50 arquivos SQL. `scripts/db-migrate.js --guarded-pilot` aplicou `051_ticket_email_jobs.sql` e `052_point_payment_methods.sql` em uma transação. Uma consulta posterior confirmou 50 migrations, `ticket_email_jobs` e a constraint de métodos Point. Não foi usado o runner genérico.

A candidata iniciou primeiro em `quiescent`: health de manutenção 200 e rotas operacionais 503. O frontend respondeu 200 na porta interna. Em seguida, o backend iniciou em `normal`, com SHA esperado e health 200. A regra temporária de Nginx foi removida, `nginx -t` passou e a configuração foi recarregada. A configuração PM2 exclusiva do Cine Cruzeiro passou a usar `backend/start.js` e um snapshot de ambiente em `shared/pm2-runtime.json`, modo `0600`; o estado PM2 foi salvo para reinício da VPS.

## Verificação após abertura

- URL pública inicial, `/conta`, `/filmes` e API health: 200. Admin redirecionou para a rota canônica e terminou em 200.
- A arte `images/login-bomboniere/combo-classico.webp` respondeu 200. `/login` não é rota desta aplicação; o login fica em `/conta`.
- Chromium headless carregou `/conta` e `/filmes` com títulos e H1 corretos, sem exceção de JavaScript. Uma requisição abortada durante navegação sequencial não se reproduziu no carregamento isolado de `/filmes`.
- Backend e frontend Cine Cruzeiro permaneceram online sem reinícios adicionais; os outros quatro cinemas ficaram online. O guard de Nginx foi removido e `nginx -t` passou.
- Consulta PostgreSQL somente de leitura após a abertura: 50 migrations, 33 pedidos, 33 pagamentos, 19 ingressos e nenhuma tarefa de e-mail nova; as contagens de negócio permaneceram iguais às do snapshot do corte.

## Limites e acompanhamento

O corte interrompeu uma conexão persistente de navegador. O processo antigo não oferecia dreno observável de WebSockets nem pausa por categoria de worker; o novo modo `normal` inicia as categorias de uma vez. O tópico opcional `stop_delivery_op_wh` do Mercado Pago e a política de retry dos demais provedores não foram confirmados no painel. Estas lacunas foram aceitas para a janela de desenvolvimento, mas precisam de solução antes de tratar o procedimento como pronto para uma instalação operacional.

Os três pagamentos `pending` existentes eram fixtures `webhook_test`/`testOnly`, não compras de clientes; três consultas GET de suas referências no Mercado Pago retornaram 404/400/400. Nenhum desses registros foi alterado ou apagado. Validar separadamente pagamentos, callbacks, Point, Wallet, e-mail e reconciliação em homologação controlada. Após 051/052, reverter apenas o symlink não é um rollback completo: avaliar compatibilidade de esquema, efeitos posteriores e eventual restauração com conciliação antes de qualquer retorno.
