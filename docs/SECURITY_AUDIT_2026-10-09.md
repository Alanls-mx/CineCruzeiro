# Auditoria de seguranca local - 2026-10-09

## Escopo e estado

Revisao pontual do backend, checkout, painel administrativo, uploads, downloads remotos e dependencias. Nenhum dado real foi alterado e nao houve deploy. Este documento nao certifica uma auditoria exaustiva de todas as rotas, bibliotecas e instalacoes.

## Achados confirmados e correcoes

| Achado | Gravidade | Evidencia e impacto | Correcao |
| --- | --- | --- | --- |
| ID de pedido controlado pelo cliente inserido em `onclick` do admin | Alta | `escapeHtml()` nao protege uma string dentro de JavaScript inline; o ID podia sair do literal e executar codigo no painel | Acoes de pedidos/pagamentos passaram a usar atributos `data-*` e listener delegado; novos IDs de checkout e idempotencia aceitam somente formato limitado |
| Pix pendente exibido como poltrona ocupada | Media | O mesmo conjunto era usado para venda concluida e reserva temporaria | Estados `sold` e `reserved` separados no mapa HTTP e WebSocket; conflito de compra continua considerando ambos |
| Reserva de poltronas por WebSocket sem limite nos lotes | Media | `join_session` e `heartbeat` podiam renovar ate 20 poltronas por mensagem sem consumir o limite de selecoes; reconectar trocava o contador por socket | As tres formas de selecionar agora debitam por quantidade de poltronas, com teto por conexao e por IP; teste adversarial reproduziu a falha antes da correcao |
| Consultas repetidas do mapa via novas conexoes | Media | `join_session` sem poltronas gerava leitura do mapa e tinha apenas limite por socket; alternar conexoes multiplicava a carga | Teto de mensagens por IP compartilhado entre sockets, alem do limite por conexao; teste local reproduziu a falha antes da correcao |
| URLs remotas com risco de SSRF e resposta sem limite incremental | Alta | Downloads de trailer e poster podiam seguir destinos nao autorizados ou consumir bytes antes de validar o tamanho | DNS fixado em IPv4 publico, sem IP literal/porta/credenciais/redirecionamento, timeout e limite durante o fluxo; TMDB nao segue redirecionamento |
| Configuracoes publicas por exclusao | Media | Uma nova chave privada em `settings` poderia aparecer em `/api/content` | Lista explicita de chaves publicas; teste HTTP com segredo ficticio |
| Upload podia seguir pasta simbolica externa | Media | Validacao lexical nao detectava `folder` que resolvesse fora da raiz | Comparacao de caminhos reais antes da escrita e criacao exclusiva (`wx`) |
| Cookie de checkout sobrevivia a troca de conta | Media | Um usuario autenticado em outra conta no mesmo navegador podia usar o comprovante assinado do pedido anterior para consultar seu estado | Pedido associado a cliente agora exige a conta proprietaria quando ha sessao ativa; logout apaga tambem o cookie de checkout; resposta privada usa `no-store` |
| Dependencias de producao vulneraveis | Critica/Alta | Auditoria npm anterior apontou Next, Sharp, Nodemailer e transitivas | Next 16.4.0, Sharp/Nodemailer corrigidos e overrides de `fflate`/`source-map-js`; `npm audit --omit=dev` agora retorna zero |

## Continuidade da revisao

- Menus flutuantes de pedidos e campanhas, botoes com codigos de ingressos, dashboard/listas de sessoes e a lista arrastavel de filmes deixaram de interpolar IDs em handlers inline. A revisao seguinte migrou tambem bilheteria/Point, busca de clientes, Clube, integracoes, historico de webhooks, cadastros auxiliares, paginacao e grafico para eventos delegados. IDs historicos seguem esse caminho seguro. Testes estaticos e de despacho de cliques verificam os trechos alterados.
- POSTs de login/cadastro/recuperacao vindos de navegador com origem externa agora sao bloqueados mesmo sem cookie. Chamadas sem cabecalhos de navegador continuam disponiveis para clientes nativos. Testes HTTP locais cobrem origem externa, mesma origem, rota administrativa privada e cookie de cliente em origem externa.
- A politica CORS agora ignora coringa, esquema invalido e URL com credenciais; URLs validas com caminho continuam normalizadas para a origem.
- Testes adversariais com cliente PostgreSQL simulado confirmam que filtros de campanhas e patch do Studio permanecem em parametros e que apenas colunas internas entram no SQL. Nenhum PostgreSQL real foi usado nesses testes.
- O token legado do catalogo comercial na URL continua aceito por compatibilidade, mas a resposta agora usa `no-store`, `no-referrer` e cabecalho de depreciacao. A documentacao orienta migrar para header; URLs ainda podem vazar em logs antes de chegar ao backend.

## Pagamentos e Mercado Pago

- O formulario usa o SDK JS V2. O checkout espera o Device ID; se o SDK nao o produzir no Pix, carrega `https://www.mercadopago.com/v2/security.js` como fallback. A CSP libera somente essa origem adicional.
- O backend envia `X-meli-session-id` e ja inclui itens, quantidades, preco unitario, comprador e `statement_descriptor` no caminho correto de Orders para cartao. Os testes verificam esses campos e a separacao do sandbox.
- URL para notificacoes Order/Webhooks do Cine Cruzeiro: `https://lumixengine.com/projects/cinecruzeiro/api/webhooks/mercado-pago`. Orders API nao aceita `notification_url` no corpo; configurar a URL no painel do Mercado Pago.
- O backend exige assinatura `x-signature` e consulta o estado da order no provedor antes de aprovar. Nao desabilitar essa verificacao para eliminar HTTP 401. Conferir no painel o segredo de Webhooks da mesma aplicacao/ambiente cadastrado no backend; reenviar um evento de teste apos alinhar os segredos.
- A consulta publica em 09/10 confirmou chave de producao com 44 caracteres e checkout habilitado. O endpoint oficial `GET /v1/payment_methods` aceitou a chave e retornou 12 metodos, incluindo Visa. Isto valida a chave, nao a tokenizacao do Brick nem uma cobranca concluida. Nao colar Access Token em chats ou arquivos.
- Nenhuma cobranca real ou teste de webhook de producao foi realizado nesta auditoria.

## PostgreSQL e autorizacao

- Revisao estatica de `postgresStore`, repositorios e repositorio de campanhas nao confirmou interpolacao de valores externos em estrutura SQL. Valores externos observados usam parametros; colunas dinamicas usam mapas internos e direcao de ordenacao permitida. Os novos testes cobrem a construcao das consultas, mas nao substituem testes com PostgreSQL isolado.
- Sessoes administrativas e de clientes usam assinatura e verificacao de versao. Testes de 2FA, papeis administrativos, DTO de ingresso e posse anti-IDOR passaram; nao foi executado teste fim-a-fim de todas as rotas privadas.
- O teste HTTP isolado de checkout cobre proprietario, outra conta com o mesmo cookie de pedido, visitante com comprovante valido, comprovante expirado, limpeza dos cookies no logout, ocultacao de dados pessoais e resposta sem cache. O teste nao consulta provedores nem pedidos reais.
- A validacao de origem administrativa deixou de confiar em `X-Forwarded-Host` controlavel pelo requisitante. Revisar ainda todas as combinacoes de `Origin`, `Referer` e proxy em homologacao.
- O catalogo comercial ainda aceita `?token=` por compatibilidade. Clientes novos devem usar `Authorization: Bearer` ou `X-Commercial-Catalog-Token`; planejar a retirada do parametro de URL apos migracao dos consumidores.

## Testes executados

- 94 testes automatizados distintos passaram: seguranca local (18), uploads (3), ingresso/anti-IDOR (8), metadata de pagamento (5), financeiro/webhooks (48), permissoes (4), mapa administrativo (2) e registro de instancias (6).
- Scripts de localizacao TMDB, assinatura Mercado Pago, 2FA e tempo real de poltronas passaram. O teste de tempo real agora inclui lotes de reconexao, heartbeats, rotacao de sockets e consultas repetidas do mapa no mesmo IP.
- `npm run lint`, `npm run build`, `npm run deploy:validate` e `npm audit --omit=dev --audit-level=high` passaram.
- O teste de abuso que aponta por padrao para um host publico, os testes que podem tocar `backend/data/db.json` e os testes de PostgreSQL sem banco isolado nao foram executados. Nao houve scanners ou carga contra producao.
- O CI novo executa o subconjunto local, auditoria de dependencias de producao, lint e build em pull requests e pushes. Seu resultado no GitHub ainda precisa ser observado.

## Riscos residuais e operacao

- `npm audit` completo ainda aponta 7 avisos em dependencias de desenvolvimento do Tailwind 3. A migracao para Tailwind 4 e uma mudanca maior de CSS; testar separadamente. O runtime de producao nao apresenta alertas no audit atual.
- A CSP do backend nao usa mais `unsafe-inline` para scripts: login e painel nao possuem blocos ou atributos de evento inline, e `script-src-attr 'none'` impede sua reintroducao no navegador. O login/2FA passou em smoke test Chromium com essa politica. A CSP do Next ainda usa `unsafe-inline` para seus scripts de hidratacao; seus atributos de evento tambem estao bloqueados por `script-src-attr 'none'`. Remover o ultimo `unsafe-inline` exige nonce integrado ao renderizador Next e homologacao visual do checkout e Studio.
- Os limites de taxa em memoria, inclusive o novo limite agregado de reservas por IP, nao sao compartilhados entre processos. Para multiplas instancias, configurar protecao Nginx/borda ou armazenamento compartilhado e validar a cadeia de proxy para IP real. HTTP e WebSocket agora compartilham a mesma validacao: o backend confia no ultimo endereco valido de `X-Forwarded-For` apenas quando a conexao vem de loopback; o proxy deve anexar o IP real como ultimo salto e o backend nao deve ser exposto diretamente.
- Verificar na VPS isolamento dos bancos por cinema, privilegios minimos do usuario PostgreSQL, firewall, TLS, backup/restauracao e permissoes dos diretorios de upload. Nenhuma configuracao remota foi modificada.
- O registro das cinco instalacoes passou nas validacoes, mas nenhum checkout de cada cinema foi homologado. Confirmar URLs, chaves e segredos por instalacao antes de publicar.

## Continuidade de CSP e homologacao - 09/10

- O JavaScript inline de `admin-login.html` foi movido para `admin-login.js`. Os handlers estaticos restantes do painel agora usam atributos `data-*` e um listener delegado; imagens com erro usam listener de captura. A CSP do backend removeu `unsafe-inline` de scripts, bloqueou atributos de evento e objetos incorporados. A CSP do Next bloqueia atributos de evento, mas preserva seus scripts inline de hidratacao.
- Testes locais: 19 testes de seguranca, 7 testes focados em Orders/sandbox/webhook, lint, build e validacao do registro passaram. Smoke Chromium confirmou transicao login para 2FA sob a CSP nova.
- Verificacoes de producao somente leitura: configuracao publica Mercado Pago com chave de producao valida; cinco rotas `/api/health/ready` retornaram HTTP 200. Nenhum pagamento real, pedido de teste remoto ou reenvio de webhook foi executado.
- Homologacao ainda pendente: tokenizacao e pagamento com conta/cartao de teste autorizado, evento assinado entregue pelo Mercado Pago e confrontado com order consultada no provedor. O historico de HTTP 401 exige alinhar o segredo da aplicacao/ambiente no painel; os testes locais de assinatura nao provam esse alinhamento remoto.
- A publicacao coordenada depende de acesso SSH autenticado a VPS. Nesta maquina o host conhecido respondeu `Permission denied (publickey)`; nao alterar `current` nem publicar por caminho alternativo sem acesso operacional verificado.

## Referencias oficiais

- [Notificacoes da Orders API](https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications)
- [Migracao Payments para Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders)
- [Device ID na Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/improve-payment-approval/recommendations)
