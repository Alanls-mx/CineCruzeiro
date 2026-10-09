# Auditoria de seguranca local - 2026-10-09

## Escopo e estado

Revisao pontual do backend, checkout, painel administrativo, uploads, downloads remotos e dependencias. Nenhum dado real foi alterado e nao houve deploy. Este documento nao certifica uma auditoria exaustiva de todas as rotas, bibliotecas e instalacoes.

## Achados confirmados e correcoes

| Achado | Gravidade | Evidencia e impacto | Correcao |
| --- | --- | --- | --- |
| ID de pedido controlado pelo cliente inserido em `onclick` do admin | Alta | `escapeHtml()` nao protege uma string dentro de JavaScript inline; o ID podia sair do literal e executar codigo no painel | Acoes de pedidos/pagamentos passaram a usar atributos `data-*` e listener delegado; novos IDs de checkout e idempotencia aceitam somente formato limitado |
| Pix pendente exibido como poltrona ocupada | Media | O mesmo conjunto era usado para venda concluida e reserva temporaria | Estados `sold` e `reserved` separados no mapa HTTP e WebSocket; conflito de compra continua considerando ambos |
| URLs remotas com risco de SSRF e resposta sem limite incremental | Alta | Downloads de trailer e poster podiam seguir destinos nao autorizados ou consumir bytes antes de validar o tamanho | DNS fixado em IPv4 publico, sem IP literal/porta/credenciais/redirecionamento, timeout e limite durante o fluxo; TMDB nao segue redirecionamento |
| Configuracoes publicas por exclusao | Media | Uma nova chave privada em `settings` poderia aparecer em `/api/content` | Lista explicita de chaves publicas; teste HTTP com segredo ficticio |
| Upload podia seguir pasta simbolica externa | Media | Validacao lexical nao detectava `folder` que resolvesse fora da raiz | Comparacao de caminhos reais antes da escrita e criacao exclusiva (`wx`) |
| Dependencias de producao vulneraveis | Critica/Alta | Auditoria npm anterior apontou Next, Sharp, Nodemailer e transitivas | Next 16.4.0, Sharp/Nodemailer corrigidos e overrides de `fflate`/`source-map-js`; `npm audit --omit=dev` agora retorna zero |

## Continuidade da revisao

- Menus flutuantes de pedidos e campanhas, botoes com codigos de ingressos, dashboard/listas de sessoes e a lista arrastavel de filmes deixaram de interpolar IDs em handlers inline. IDs historicos tambem seguem esse caminho seguro. Testes estaticos verificam os trechos de renderizacao.
- POSTs de login/cadastro/recuperacao vindos de navegador com origem externa agora sao bloqueados mesmo sem cookie. Chamadas sem cabecalhos de navegador continuam disponiveis para clientes nativos. Testes HTTP locais cobrem origem externa, mesma origem, rota administrativa privada e cookie de cliente em origem externa.
- A politica CORS agora ignora coringa, esquema invalido e URL com credenciais; URLs validas com caminho continuam normalizadas para a origem.
- Testes adversariais com cliente PostgreSQL simulado confirmam que filtros de campanhas e patch do Studio permanecem em parametros e que apenas colunas internas entram no SQL. Nenhum PostgreSQL real foi usado nesses testes.
- O token legado do catalogo comercial na URL continua aceito por compatibilidade, mas a resposta agora usa `no-store`, `no-referrer` e cabecalho de depreciacao. A documentacao orienta migrar para header; URLs ainda podem vazar em logs antes de chegar ao backend.

## Pagamentos e Mercado Pago

- O formulario usa o SDK JS V2. O checkout espera o Device ID; se o SDK nao o produzir no Pix, carrega `https://www.mercadopago.com/v2/security.js` como fallback. A CSP libera somente essa origem adicional.
- O backend envia `X-meli-session-id` e ja inclui itens, quantidades, preco unitario, comprador e `statement_descriptor` no caminho correto de Orders para cartao. Os testes verificam esses campos e a separacao do sandbox.
- URL para notificacoes Order/Webhooks do Cine Cruzeiro: `https://lumixengine.com/projects/cinecruzeiro/api/webhooks/mercado-pago`. Orders API nao aceita `notification_url` no corpo; configurar a URL no painel do Mercado Pago.
- O backend exige assinatura `x-signature` e consulta o estado da order no provedor antes de aprovar. Nao desabilitar essa verificacao para eliminar HTTP 401. Conferir no painel o segredo de Webhooks da mesma aplicacao/ambiente cadastrado no backend; reenviar um evento de teste apos alinhar os segredos.
- A chave publica completa de producao ainda precisa ser confirmada no painel administrativo. Sem ela, o Brick de cartao permanece indisponivel. Nao colar Access Token em chats ou arquivos.
- Nenhuma cobranca real ou teste de webhook de producao foi realizado nesta auditoria.

## PostgreSQL e autorizacao

- Revisao estatica de `postgresStore`, repositorios e repositorio de campanhas nao confirmou interpolacao de valores externos em estrutura SQL. Valores externos observados usam parametros; colunas dinamicas usam mapas internos e direcao de ordenacao permitida. Os novos testes cobrem a construcao das consultas, mas nao substituem testes com PostgreSQL isolado.
- Sessoes administrativas e de clientes usam assinatura e verificacao de versao. Testes de 2FA, papeis administrativos, DTO de ingresso e posse anti-IDOR passaram; nao foi executado teste fim-a-fim de todas as rotas privadas.
- A validacao de origem administrativa deixou de confiar em `X-Forwarded-Host` controlavel pelo requisitante. Revisar ainda todas as combinacoes de `Origin`, `Referer` e proxy em homologacao.
- O catalogo comercial ainda aceita `?token=` por compatibilidade. Clientes novos devem usar `Authorization: Bearer` ou `X-Commercial-Catalog-Token`; planejar a retirada do parametro de URL apos migracao dos consumidores.

## Testes executados

- 89 testes automatizados distintos passaram: seguranca local (13), uploads (3), ingresso/anti-IDOR (8), metadata de pagamento (5), financeiro/webhooks (48), permissoes (4), mapa administrativo (2) e registro de instancias (6).
- Scripts de localizacao TMDB, assinatura Mercado Pago, 2FA e tempo real de poltronas passaram.
- `npm run lint`, `npm run build`, `npm run deploy:validate` e `npm audit --omit=dev --audit-level=high` passaram.
- O teste de abuso que aponta por padrao para um host publico, os testes que podem tocar `backend/data/db.json` e os testes de PostgreSQL sem banco isolado nao foram executados. Nao houve scanners ou carga contra producao.
- O CI novo executa o subconjunto local, auditoria de dependencias de producao, lint e build em pull requests e pushes. Seu resultado no GitHub ainda precisa ser observado.

## Riscos residuais e operacao

- `npm audit` completo ainda aponta 7 avisos em dependencias de desenvolvimento do Tailwind 3. A migracao para Tailwind 4 e uma mudanca maior de CSS; testar separadamente. O runtime de producao nao apresenta alertas no audit atual.
- A CSP ainda usa `unsafe-inline` por dependencias existentes do Next/admin. Remover apenas com migração de handlers inline e teste visual do checkout e Studio.
- Ha outros handlers inline no admin, sobretudo em cadastros auxiliares e operacoes de bilheteria. Os caminhos de pedido, ingresso, campanha, sessoes e lista de filmes foram migrados; uma revisao contextual completa de XSS/DOM ainda e necessaria.
- Os limites de taxa em memoria nao sao compartilhados entre processos. Para multiplas instancias, configurar protecao Nginx/borda ou armazenamento compartilhado e validar a cadeia de proxy para IP real.
- Verificar na VPS isolamento dos bancos por cinema, privilegios minimos do usuario PostgreSQL, firewall, TLS, backup/restauracao e permissoes dos diretorios de upload. Nenhuma configuracao remota foi modificada.
- O registro das cinco instalacoes passou nas validacoes, mas nenhum checkout de cada cinema foi homologado. Confirmar URLs, chaves e segredos por instalacao antes de publicar.

## Referencias oficiais

- [Notificacoes da Orders API](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications)
- [Migracao Payments para Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders)
- [Device ID na Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/improve-payment-approval/recommendations)
