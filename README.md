# Cine Cruzeiro

Documentação atualizada da plataforma pública, checkout, Clube Cine Cruzeiro e painel administrativo.

Última revisão: 31 de agosto de 2026.

## 1. Visão geral

O Cine Cruzeiro é uma plataforma full-stack para venda de ingressos, operação de bilheteria, programação de filmes, bomboniere, assinaturas recorrentes e relacionamento com clientes de um cinema de rua.

O produto possui duas experiências integradas:

- site público responsivo, voltado principalmente para compras pelo celular;
- painel administrativo para programação, vendas, validação, catálogo, usuários, marketing e integrações.

Produção:

- site: <https://lumixengine.com/projects/cinecruzeiro>
- painel: <https://lumixengine.com/projects/cinecruzeiro/admin>
- health check: <https://lumixengine.com/projects/cinecruzeiro/api/health>
- base path de produção: `/projects/cinecruzeiro`

## 2. Estado atual

| Área | Estado atual |
| --- | --- |
| Site público | Operacional e responsivo |
| Programação e sessões | Integradas ao backend |
| Tipos de ingresso por sessão | Catálogo central com seleção por sessão e pacotes múltiplos |
| Poltronas | Mapa configurável por sala, reserva temporária e sincronização em tempo real |
| Checkout | Ingressos, Extras, Pagamento e Confirmação |
| Mercado Pago | Orders API para Pix e cartão de ingressos |
| Clube | Modelo híbrido: mensalidades, ciclos, créditos individuais, resgates e complementos |
| Fiscal | Serviços separados de mercadorias; NFC-e preparada por provider desacoplado |
| PostgreSQL | Persistência obrigatória em produção |
| Ingressos digitais | Código, QR Code, PDF e histórico |
| Google Wallet | Implementação oficial, dependente de credenciais externas |
| E-mail | SMTP ou webhook de entrega configurável no Admin |
| Logs operacionais | Consulta, filtros e retenção administrável |
| Eventos privados | Formulário envia solicitação e confirmação automática |
| TMDB | Importação assistida de dados de filmes |
| Admin | RBAC, auditoria e módulos operacionais |

Não fazem parte da arquitetura ativa:

- EBANX;
- Pix Open Finance;
- mocks públicos quando a API falha;
- ativação de assinatura antes da aprovação do pagamento.

## 3. Arquitetura

```text
Navegador
  |
  | HTTPS /projects/cinecruzeiro
  | WSS   /projects/cinecruzeiro/api/realtime/seats
  v
Nginx da VPS
  |-- Next.js :3100
  |     |-- páginas públicas
  |     |-- checkout
  |     |-- conta do cliente
  |     `-- proxy /api para o backend
  |
  `-- Backend Node.js :4100
        |-- regras de negócio
        |-- autenticação e RBAC
        |-- Mercado Pago
        |-- SMTP, TMDB, Wallet e CRM
        `-- PostgreSQL
```

O frontend nunca é fonte de verdade para preço, disponibilidade, pagamento, ticket ou status de assinatura. Esses dados são recalculados ou confirmados pelo backend.

## 4. Stack tecnológica

### Frontend

- Next.js 16 com App Router;
- React 18;
- TypeScript;
- Tailwind CSS;
- Lucide React;
- `next/image`;
- SDK web oficial do Mercado Pago;
- layout mobile-first.

### Backend

- Node.js `>=20.9.0 <25` (produção atualmente em Node 22);
- servidor HTTP nativo em CommonJS;
- PostgreSQL com migrations SQL;
- `pg` para acesso ao banco;
- `nodemailer` para SMTP;
- `qrcode` para geração de QR Code;
- `jsQR` para leitura alternativa de QR Code;
- `crypto` para hashes, HMAC e proteção de dados sensíveis.

### Painel administrativo

O Admin utiliza HTML, CSS e JavaScript próprios servidos pelo backend. Essa decisão mantém o painel operacional independente do bundle público e permite interfaces densas para uso diário.

## 5. Estrutura principal

```text
.
|-- backend/
|   |-- db/
|   |   |-- migrations/
|   |   `-- postgresStore.js
|   |-- public/
|   |   |-- admin.html
|   |   |-- admin.css
|   |   `-- admin.js
|   |-- services/
|   |   |-- emailService.js
|   |   |-- integrationConfigService.js
|   |   `-- paymentService.js
|   `-- server.js
|-- public/
|   `-- images/
|-- scripts/
|   |-- db-migrate.js
|   |-- smoke-tests.js
|   |-- mercado-pago-webhook-tests.js
|   `-- postgres-concurrency-tests.js
|-- src/
|   |-- app/
|   |-- components/
|   |-- services/
|   `-- types/
|-- next.config.mjs
|-- package.json
`-- README.md
```

## 6. Páginas públicas

| Rota | Função |
| --- | --- |
| `/` | Página inicial, destaque, programação e argumentos comerciais |
| `/filmes` | Catálogo, navegação por data, filtros e sessões |
| `/filmes/[slug]` | Detalhes do filme e seletor único de sessões |
| `/checkout/[sessionId]` | Seleção de ingressos |
| `/checkout/[sessionId]/extras` | Bomboniere e extras |
| `/checkout/[sessionId]/pagamento` | Pagamento |
| `/checkout/[sessionId]/confirmacao` | Acompanhamento e confirmação |
| `/clube` | Apresentação e planos ativos do Clube |
| `/clube/assinar/[planId]` | Contratação do plano selecionado |
| `/conta` | Perfil, verificação de e-mail e Clube |
| `/conta/ingressos` | Próximos ingressos e histórico |
| `/eventos` | Solicitação de aluguel da sala |
| `/o-cinema` | História, tradição e cultura |
| `/privacidade` | Política de privacidade |
| `/termos` | Termos de uso |

## 7. Programação, filmes e sessões

A sessão é a fonte de verdade para os dados usados em:

- site e página do filme;
- checkout;
- painel administrativo;
- ingresso digital;
- PDF;
- e-mail;
- Google Wallet;
- validação de QR Code.

Uma sessão relaciona filme, sala, data, horário, formato, idioma, capacidade e disponibilidade. O backend impede venda de sessão indisponível ou encerrada.

Regra temporal importante:

- uma sessão deixa de ser vendida e exibida como disponível após 10 minutos do horário real de início.

O slug é usado para navegação amigável, mas a identificação do filme e da sessão depende de IDs estáveis.

### Criação e edição de sessões

O Admin aceita criação de sessão individual ou em lote. No modo em lote, o operador informa:

- data inicial e final;
- um ou mais horários;
- dias da semana desejados;
- sala, formato e status;
- tipos de ingresso disponíveis naquela programação.

Cada data é tratada como uma data civil do cinema no fuso `America/Sao_Paulo`. Alterar apenas o horário não deve deslocar a sessão para outro dia. Os testes de timezone cobrem horários noturnos e próximos da virada do dia.

O preço não é digitado diretamente na sessão: ele vem dos tipos de ingresso vinculados. Isso mantém catálogo, checkout, bilheteria e relatórios consistentes.

### Salas e poltronas

Cada sala pode operar com lugar livre ou com seleção de poltronas. Quando habilitado, o Admin permite configurar:

- tipos e cores de poltrona;
- fileiras, colunas, corredores e rótulos;
- cadeiras habilitadas ou bloqueadas;
- acessibilidade para cadeirante e pessoa obesa;
- capacidade calculada pelas cadeiras ativas do mapa.

O mapa da sala é a fonte de verdade para checkout e Bilheteria. Alterá-lo dispara `session_refresh_required` para as sessões vinculadas, inclusive quando a sala é renomeada. Uma cadeira com ingresso ou reserva ativa não pode ser removida silenciosamente.

### Exibição e recomendação

- a programação destaca os primeiros seis dias que realmente possuem sessões disponíveis;
- dias vazios não ocupam espaço no seletor;
- o filtro `Todos` agrega todos os formatos e idiomas da data;
- filtros como Normal, Dublado e Legendado usam a mesma fonte de dados;
- se as sessões do dia terminaram, a interface recomenda a próxima sessão futura disponível.

## 8. Checkout

Fluxo obrigatório:

```text
Ingressos -> Extras -> Pagamento -> Confirmação
```

Regras:

- etapas futuras ficam bloqueadas até a conclusão das anteriores;
- Extras pode ser concluída sem produtos;
- produtos escolhidos permanecem no pedido ao avançar;
- a Confirmação exige pedido e pagamento válidos;
- `pending` e `processing` não são tratados como aprovação;
- tickets só são liberados com pagamento `approved`;
- preço, estoque e capacidade são recalculados pelo backend;
- quando a sala possui mapa ativo, a quantidade de poltronas deve ser exatamente igual à quantidade efetiva de ingressos;
- não é possível pular a seleção de poltronas nem avançar com a seleção incompleta;
- as poltronas selecionadas permanecem no pedido ao avançar para Extras e Pagamento;
- o checkout autenticado reutiliza os dados reais da conta;
- o checkout convidado solicita apenas os dados necessários.

### Ingressos

O cliente escolhe apenas os tipos habilitados para a sessão. O backend valida capacidade, preço, disponibilidade e quantidade efetiva de tickets.

Um tipo pode definir `bundleQuantity` entre 1 e 20. Por exemplo, uma unidade de `Triple Ingresso` gera três tickets; duas unidades geram seis. O multiplicador é fixado no backend e não pode ser reduzido ou adulterado pelo frontend.

### Reserva de poltronas em tempo real

Checkout e Bilheteria participam do mesmo canal WebSocket por sessão. O primeiro cliente ou operador que selecionar uma cadeira recebe uma reserva temporária de dois minutos. Um `heartbeat` enviado a cada 35 segundos renova as cadeiras ainda selecionadas.

O servidor executa a aquisição dentro de mutação crítica e, em PostgreSQL, usa a tabela de reservas temporárias para garantir exclusividade. Um segundo clique concorrente recebe `SEAT_ALREADY_HELD` imediatamente. No fechamento da venda, o backend valida e assume as reservas pelo `seatHoldToken`; portanto, alterar apenas o payload do frontend não permite comprar uma cadeira reservada por outra pessoa.

Estados visuais padronizados:

- azul: disponível;
- dourado: selecionada pelo cliente ou operador atual;
- rosa: reservada temporariamente por outra compra;
- cinza: indisponível ou ocupada.

Protocolo principal em `/api/realtime/seats`:

| Direção | Evento | Finalidade |
| --- | --- | --- |
| Cliente -> servidor | `join_session` | Entra no canal com `sessionId` e `ownerToken` |
| Cliente -> servidor | `select_seat` | Solicita a reserva atômica de uma cadeira |
| Cliente -> servidor | `release_seat` | Libera uma cadeira pertencente ao mesmo token |
| Cliente -> servidor | `heartbeat` | Renova as reservas ainda selecionadas |
| Servidor -> cliente | `session_state` | Entrega ocupadas e reservas ativas ao conectar |
| Servidor -> cliente | `select_seat_confirmed` | Confirma a seleção e informa a expiração |
| Servidor -> cliente | `select_seat_rejected` | Rejeita conflito, sessão encerrada ou mapa inválido |
| Servidor -> clientes | `seat_status_changed` | Atualiza disponibilidade para checkout e Bilheteria |
| Servidor -> clientes | `session_refresh_required` | Solicita recarga quando o mapa da sala muda |

### Extras

Produtos da bomboniere possuem imagem local, descrição, preço, estoque, categoria e quantidade. Os itens pertencem ao pedido, não são duplicados em cada ticket.

### Pagamento

Ingressos aceitam os métodos habilitados no Mercado Pago para a Orders API, incluindo Pix real e cartão.

No Pix:

- o backend cria a order;
- o frontend recebe código copia e cola e QR Code;
- a confirmação consulta o estado periodicamente;
- o ingresso permanece bloqueado até aprovação real;
- o webhook atualiza o pedido de forma idempotente.

Clientes com assinatura ativa e créditos suficientes também podem escolher `Crédito do Clube`. A opção considera a quantidade efetiva de tickets, inclusive multiplicadores de pacote, e a baixa é atômica e idempotente. Se o pedido falhar ou for cancelado dentro das regras de estorno, o crédito é devolvido pelo backend.

## 9. Mercado Pago

A integração de ingressos utiliza a nova Orders API. A integração legada de pagamentos não deve ser reintroduzida.

Configurações principais:

- ambiente `sandbox` ou `production`;
- public key;
- access token;
- webhook secret;
- recorrência do Clube;
- configuração opcional de Point.

### Mercado Pago Point na bilheteria

A venda presencial usa a Orders API atual do Mercado Pago, com `type: point`. Em Integrações, habilite Point e informe o `Terminal ID` de uma maquininha pertencente à mesma conta do Access Token. O terminal deve estar no modo PDV.

Fluxo operacional:

1. o operador seleciona um ou vários filmes e escolhe `Maquininha`;
2. o backend envia uma única cobrança agregada ao terminal configurado;
3. pedidos e pagamento permanecem pendentes enquanto o cliente paga;
4. o painel consulta o estado automaticamente e também aceita a confirmação pelo webhook de Orders;
5. somente `processed` com `status_detail: accredited` libera e imprime os ingressos;
6. recusa, expiração ou cancelamento não emitem ingressos;
7. a mesma confirmação pode ser reenviada sem duplicar pedidos ou tickets.

O comprovante do vendedor pode ser impresso pela própria Point nas cobranças processadas pela maquininha. Nas vendas rápidas concluídas como `Dinheiro`, `Pix no balcão` ou `Cortesia`, o backend usa a API oficial de ações de impressão (`POST /terminals/v1/actions`) para enviar um ingresso personalizado à Point Smart configurada, com filme, sessão, sala, tipo, código e QR Code. A falha da impressora não desfaz a venda: o painel informa o problema e o ingresso continua disponível para impressão individual.

Endpoints administrativos:

```text
GET  /api/box-office/point-terminals
GET  /api/box-office/point-payments/:paymentId
POST /api/box-office/point-payments/:paymentId/cancel
GET  /api/admin/tickets/:ticketId/print
```

Webhook público:

```text
POST /api/webhooks/mercado-pago
```

Validação de segurança:

- lê `x-signature`;
- lê `x-request-id`;
- usa `data.id` da query string;
- valida HMAC com a webhook secret do ambiente;
- não exige JWT, sessão ou Authorization de usuário;
- rejeita assinatura inválida com `401`;
- aceita eventos válidos com `200`;
- registra eventos processados para evitar duplicidade.

Nunca usar `req.body.data.id` como substituto do `data.id` da query na montagem da assinatura.

## 10. Clube Cine Cruzeiro

Os planos são carregados do backend e podem ser administrados com nome, mensalidade, créditos, valor de referência, validade, acúmulo, limite, carência, elegibilidade, benefícios, imagem local, ordem, recomendação e status. Não existem planos de fallback hardcoded.

Benefícios configuráveis incluem:

- quantidade de ingressos incluídos por ciclo;
- desconto percentual em ingressos;
- desconto percentual na bomboniere;
- produtos específicos da bomboniere que podem ser resgatados gratuitamente;
- lista textual de benefícios exibida na página pública.
- formatos e sessões elegíveis;
- produtos excluídos do desconto;
- pagamento de diferença em sessões mais caras.

Descontos e itens gratuitos são recalculados no backend a partir do plano, assinatura, ciclo e produtos reais. O frontend não informa o valor final do benefício e não consegue transformar um item não elegível em gratuito.

Método ativo para contratação recorrente:

- cartão de crédito via Mercado Pago.

Pix recorrente e cartão de débito não são oferecidos nas assinaturas.

### Ativação

Uma assinatura nasce como `pending_payment`. O plano e os créditos só são atribuídos após aprovação confirmada pelo Mercado Pago.

O domínio financeiro é separado em `subscription -> subscription_payment -> subscription_cycle -> subscription_credit_unit -> subscription_credit_redemption -> ticket`. Um resgate integral não cria pagamento fictício de R$ 0,00. Quando existe complemento, o crédito fica reservado e a diferença segue pelo fluxo normal de Pix/cartão até o webhook confirmar a operação.

Assinaturas pendentes sem pagamento identificado expiram após 15 minutos.

### Estados

| Status | Significado |
| --- | --- |
| `pending_payment` | Aguardando autorização ou pagamento |
| `active` | Ativa e com benefícios vigentes |
| `paused` | Pausada administrativamente |
| `ending` | Cobrança encerrada, benefícios válidos até o fim do ciclo |
| `cancelled` | Cancelada sem benefício corrente |
| `ended` | Ciclo finalizado |
| `payment_failed` | Pagamento falhou |

### Cancelamento

Ao solicitar cancelamento:

- o backend encerra a renovação no Mercado Pago;
- nenhuma cobrança futura deve ocorrer;
- a assinatura passa para `ending` quando ainda existe ciclo pago;
- créditos continuam utilizáveis até o fim do ciclo;
- após o prazo, a assinatura vai automaticamente para o histórico;
- reativação de uma assinatura cancelada externamente é bloqueada.

O Admin não pode reativar e cobrar novamente uma assinatura cancelada pelo cliente. Uma nova cobrança exige uma nova contratação e autorização do titular.

### Admin de assinaturas

O painel permite:

- buscar por nome, e-mail ou plano;
- visualizar titular e e-mail;
- consultar créditos e status;
- abrir histórico de mensalidades, ciclos, créditos individuais e resgates;
- ajustar créditos com permissão;
- cancelar renovação;
- excluir registros terminais quando a regra de auditoria permitir;
- atribuir assinatura manual para venda presencial, cortesia ou migração.

Configurações contábeis por plano são restritas ao owner e versionadas. Nenhuma divisão entre componente de ingresso e benefícios é calculada automaticamente: esses valores dependem de orientação contábil.

Pedidos mistos guardam serviços e mercadorias separadamente. Ingressos usam controle contábil configurável, sem botão ou emissão automática de NFS-e. Mercadorias ficam preparadas para futura NFC-e através de uma interface de provider neutra; certificado A1 e credenciais de SEFAZ não são armazenados pela aplicação.

## 11. Conta do cliente

Funcionalidades:

- cadastro e login;
- login opcional com Google;
- recuperação de senha;
- verificação de e-mail;
- edição de nome, WhatsApp, CPF e senha;
- alteração de e-mail com confirmação;
- consulta do Clube e histórico;
- consulta de ingressos;
- transferência segura de ticket.

A sessão usa cookie HttpOnly. Dados sensíveis não são usados como substitutos de autenticação.

## 12. Verificação de e-mail e recuperação de senha

O backend gera tokens temporários, armazena somente o hash e envia um link pelo provedor de e-mail configurado.

Confirmação canônica:

```text
GET /api/auth/email/verify?token=...
```

O sistema:

- aguarda o resultado de envio ao cadastrar;
- informa sucesso ou falha sem expor o token no frontend;
- permite novo envio quando uma tentativa de entrega falha;
- aplica limite de requisições para reduzir abuso e spam;
- não marca um novo e-mail como verificado antes da confirmação.

## 13. E-mails

O provedor pode ser SMTP ou webhook privado de entrega.

E-mails transacionais incluem, conforme o evento:

- verificação de conta;
- recuperação de senha;
- pagamento aprovado;
- entrega e reenvio de ingresso;
- transferência de ticket;
- recebimento de solicitação de evento.

Os layouts transacionais utilizam a identidade do cinema, logo compatível com fundo de e-mail, pôster, dados sincronizados da sessão, resumo do pedido e ações disponíveis. O PDF real do ingresso pode seguir anexado à mensagem.

O módulo de Marketing permite campanhas por template estruturado ou HTML5 personalizado. No modo HTML, o conteúdo é sanitizado e envolvido pelo layout base do Cine Cruzeiro; o placeholder `{{nome}}` personaliza o destinatário. A prévia, assunto, audiência e resultado do envio permanecem no fluxo administrativo.

Regras:

- e-mails transacionais não exibem unsubscribe;
- campanhas de marketing exibem link individual de descadastro;
- layouts usam HTML responsivo compatível com clientes comuns;
- anexos de ingresso usam o PDF real gerado pelo sistema;
- secrets SMTP ficam criptografados e mascarados no Admin.
- a logo usada nos e-mails é um ativo local estável, evitando dependência de imagem privada ou URL temporária.

## 14. Formulário de eventos

A página `/eventos` envia uma solicitação real ao backend com:

- nome;
- WhatsApp;
- e-mail;
- tipo de evento;
- quantidade estimada;
- data e horário desejados;
- mensagem.

O backend:

- valida e sanitiza os campos;
- usa honeypot contra bots;
- exige integração de e-mail ativa;
- entrega a solicitação ao e-mail de atendimento configurado;
- define o cliente como Reply-To;
- envia resposta automática confirmando o recebimento;
- encaminha o evento ao CRM quando configurado.

## 15. Ingressos digitais

Cada ingresso possui:

- filme;
- sessão;
- sala;
- poltrona e tipo de poltrona, quando aplicável;
- data e horário;
- formato e idioma;
- tipo;
- código;
- QR Code;
- pedido;
- cliente;
- status;
- extras vinculados ao pedido.

Ingressos são separados entre próximos e arquivados. O arquivamento automático acontece quatro horas após a sessão, preservando ingressos usados no histórico.

### Transferência

Somente ticket pago, válido, não utilizado, não expirado, não cancelado e não reembolsado pode ser transferido.

A transferência:

- exige destinatário cadastrado;
- troca o proprietário em transação;
- registra remetente, destinatário, ticket e horário;
- rotaciona a validade do QR Code do antigo proprietário;
- envia e-mails transacionais aos envolvidos.

### PDF e Google Wallet

O PDF usa dados sincronizados da sessão, possui até duas páginas, inclui a marca do Cine Cruzeiro sem fundo preto e pode incluir pôster armazenado localmente. A poltrona aparece em destaque na primeira página. Datas visíveis seguem o padrão brasileiro `dd/mm/aaaa às HH:mm`.

O Google Wallet usa integração oficial. A opção só funciona em produção quando issuer, class e service account válidos estiverem configurados.

## 16. QR Code e validação

O painel permite validação por câmera ou código manual.

Regras:

- a câmera depende de HTTPS e permissão do navegador;
- o leitor possui tempo limitado de operação;
- a validação consulta o status real no servidor;
- QR Code não torna ticket pendente ou cancelado em válido;
- ticket usado não pode ser reutilizado;
- datas vazias são normalizadas antes de consultas PostgreSQL.

## 17. Painel administrativo

URL:

```text
/admin
```

Módulos principais:

- Dashboard;
- Filmes;
- Salas e sessões;
- Ingressos;
- Bilheteria;
- Bomboniere;
- Marketing;
- Clube;
- Usuários;
- Integrações.
- Logs.

O Dashboard separa receitas de ingresso, bomboniere, assinaturas e outros meios, permitindo rastrear a origem do faturamento.

Na Bilheteria, o operador seleciona ingressos, bomboniere e poltronas antes de concluir a venda manual. A tela usa os mesmos bloqueios WebSocket do checkout: uma seleção feita no site aparece no Admin, e uma seleção feita no Admin bloqueia imediatamente a cadeira no site. Vendas com várias sessões mantêm canais e tokens independentes por sessão.

Perfis:

| Role | Uso esperado |
| --- | --- |
| `owner` | Configurações, integrações e controle total |
| `manager` | Operação e gestão diária |
| `operator` | Bilheteria, consulta e validação permitidas |

Mutações administrativas relevantes registram ator, ação, entidade, IP, data e estado anterior/posterior sanitizado.

### Logs operacionais

O módulo de Logs centraliza eventos de aplicação e requisições relevantes com:

- nível `debug`, `info`, `warn` ou `error`;
- categoria e nome do evento;
- request ID para correlação;
- ator, rota, método e status HTTP quando aplicável;
- duração, IP, user agent e metadados sanitizados;
- filtros, paginação e limpeza por política de retenção.

Secrets, tokens, assinaturas completas e senhas não são persistidos. Em PostgreSQL, a retenção automática usa `SYSTEM_LOG_RETENTION_DAYS`, com padrão de 90 dias.

## 18. Bomboniere

O Admin controla:

- produtos;
- imagens por upload;
- categorias;
- preços;
- estoque;
- disponibilidade;
- descrições;
- combos;
- ordem de exibição.

As imagens persistem em diretório compartilhado da VPS e usam `object-fit: contain` no checkout. Produtos transparentes são integrados ao fundo navy sem container claro.

URLs externas de imagem não são usadas na Bomboniere, nos planos ou em filmes publicados. O TMDB continua disponível como origem de importação no painel.

Uploads salvos em produtos e planos são persistidos antes da atualização visual do formulário. A interface sempre reconcilia a prévia com a URL local retornada pelo backend, evitando que a imagem desapareça ao salvar ou recarregar.

## 19. Filmes e TMDB

O Admin pesquisa um título e pode importar:

- título e título original;
- pôster;
- banner;
- sinopse;
- classificação;
- duração;
- gêneros;
- identificadores de mídia.

O operador revisa os dados antes de publicar. A duração vem do campo `runtime` dos detalhes oficiais do TMDB e guarda metadados de origem. O sistema não aplica duração fictícia: quando o TMDB não informa o valor, exibe `Duração não informada` e impede a publicação até a revisão. A ordenação do catálogo é persistida no backend e os status possuem identificação visual.

Ao publicar um filme importado, o backend baixa o pôster e o banner do domínio oficial do TMDB, valida o conteúdo como JPG, PNG ou WebP e grava os arquivos no armazenamento persistente local. O banco passa a guardar URLs em `/uploads/`; as URLs originais ficam apenas nos metadados de rastreabilidade. Uma manutenção também converte filmes publicados anteriormente que ainda apontem diretamente para o TMDB. Na exclusão definitiva do filme, os arquivos locais sem outras referências são removidos para evitar acúmulo no disco; filmes apenas arquivados preservam a mídia necessária ao histórico de pedidos e ingressos.

Status de publicação incluem filmes em cartaz, estreia e em breve. Filmes agendados podem mudar de categoria conforme a data configurada.

## 20. Uploads e imagens

Uploads administrativos usam:

```text
POST /api/uploads/images
```

Em produção, os arquivos ficam fora da release:

```text
/home/ubuntu/projects/cinecruzeiro/shared/uploads
```

Cada release aponta para esse diretório por symlink, evitando perda de mídia durante deploy.

Ativos de identidade mantidos no projeto:

```text
public/images/favicon.svg
public/images/favicon-64.png
public/images/favicon-email.png
public/images/logo-header-compact.webp
public/images/logo-pdf.jpg
backend/public/admin/favicon-admin.svg
```

O frontend usa uma versão compacta para header e metadados; e-mail e PDF usam variantes próprias para preservar legibilidade e evitar fundos indevidos. O painel possui favicon administrativo separado.

## 21. Integrações administráveis

| Integração | Finalidade |
| --- | --- |
| Mercado Pago | Orders, Pix, cartão, webhooks e Clube |
| Google Login | Autenticação social |
| Google Wallet | Passe oficial de ingresso |
| TMDB | Catálogo e mídia de filmes |
| E-mail | SMTP ou webhook de entrega |
| CRM | Leads, eventos e automações |

Campos sensíveis são criptografados no backend e retornam mascarados ao painel.

## 22. PostgreSQL

Produção usa PostgreSQL. O JSON local existe apenas como fallback de desenvolvimento e testes específicos.

Migrations atuais:

```text
001_init.sql
002_password_reset.sql
003_box_office_payments.sql
004_club_subscriptions.sql
005_admin_dashboard_movies.sql
006_finance_dashboard_payments.sql
007_movie_sort_order.sql
008_remove_ebanx_pix_payments.sql
009_email_unsubscribe.sql
010_subscription_plan_media.sql
011_subscription_payment_state.sql
012_subscription_cancellation_lifecycle.sql
013_club_benefits.sql
014_session_ticket_types.sql
015_system_logs.sql
016_ticket_type_bundle_quantity.sql
017_fiscal_documents.sql
018_admin_two_factor.sql
019_session_revocation.sql
020_ticket_expired_status.sql
021_admin_permissions.sql
022_room_seat_layout.sql
023_realtime_seat_holds.sql
024_club_content_polish.sql
025_subscription_usage_quantity.sql
026_hybrid_club_accounting.sql
```

A migration 017 pertence ao histórico do banco e é mantida para compatibilidade com ambientes já migrados. O módulo fiscal correspondente foi retirado da aplicação e seus registros antigos não são expostos nem processados.

A migration 018 adiciona autenticação em duas etapas às contas administrativas, com segredo TOTP criptografado, estado de configuração e códigos de recuperação armazenados somente como hash.

As migrations 022 e 023 adicionam, respectivamente, o mapa configurável das salas e as reservas temporárias de poltronas usadas pelo WebSocket e pela validação concorrente do checkout e da Bilheteria.

A migration 025 persiste a quantidade efetiva de créditos consumidos em cada uso do Clube, permitindo estorno correto de pacotes com múltiplos ingressos.

A migration 026 adiciona ciclos e mensalidades separados, créditos individuais, resgates, composição de pedidos em serviços/mercadorias, snapshots contábeis versionados, campos financeiros do ingresso e preparação idempotente de NFC-e para mercadorias.

## 23. APIs principais

### Públicas e cliente

```text
GET  /api/health
GET  /api/health/live
GET  /api/health/ready
GET  /api/content
GET  /api/subscription-plans
POST /api/events
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/password/request
POST /api/auth/password/reset
GET  /api/auth/email/verify
PATCH /api/me
POST /api/me/email-verification/request
GET  /api/me/tickets
GET  /api/me/subscriptions
POST /api/subscriptions/subscribe
POST /api/payments/pix
POST /api/payments/card
POST /api/webhooks/mercado-pago
GET  /api/sessions/:sessionId/seats
WSS  /api/realtime/seats
```

### Administrativas

```text
POST /api/admin/login
POST /api/admin/login/2fa
POST /api/admin/logout
GET  /api/admin/me
GET  /api/admin/2fa/status
POST /api/admin/2fa/setup
POST /api/admin/2fa/enable
POST /api/admin/2fa/disable
POST /api/admin/2fa/recovery-codes
GET  /api/admin/dashboard
GET  /api/admin/content
GET  /api/admin/integrations
POST /api/admin/email/promotions
GET  /api/admin/reports/dashboard.csv
GET  /api/admin/subscription-plans
POST /api/admin/subscription-plans
GET  /api/admin/subscriptions
GET  /api/admin/subscriptions/:id
POST /api/admin/subscriptions/assign
PUT  /api/admin/goods-fiscal-settings
POST /api/uploads/images
POST /api/tickets/manual
POST /api/tickets/validate
```

Existem rotas parametrizadas adicionais para edição, cancelamento, exclusão, transferência, pedidos, sessões e recursos administrativos.

## 24. Segurança

Controles implementados:

- cookies HttpOnly para sessões;
- 2FA TOTP opcional para contas administrativas, com desafio curto e códigos de recuperação de uso único;
- RBAC no backend;
- hash de senha e tokens temporários;
- rate limit em autenticação e envio de e-mails;
- validação de origem e CORS;
- headers de segurança;
- secrets criptografados;
- mascaramento no Admin;
- HMAC de webhook Mercado Pago;
- idempotência de webhooks;
- auditoria de mutações;
- validação server-side de preço, estoque e status;
- logs estruturados sem secrets completos;
- uploads validados por formato e tamanho;
- PostgreSQL obrigatório em produção.

Nunca registrar ou versionar:

- access token do Mercado Pago;
- webhook secret;
- senha SMTP;
- private key da Google service account;
- JWT secret;
- string de conexão PostgreSQL;
- chave privada da VPS.

## 25. Variáveis de ambiente

Variáveis centrais:

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | Ambiente da aplicação |
| `PORT` | Porta do processo |
| `BIND_HOST` | Interface de rede do backend |
| `DATABASE_URL` | PostgreSQL |
| `DATA_STORE` | Store ativo |
| `JWT_SECRET` | Sessões e tokens |
| `INTEGRATION_SECRET_KEY` | Criptografia das integrações |
| `TWO_FACTOR_SECRET_KEY` | Chave dedicada para criptografar segredos TOTP (usa `INTEGRATION_SECRET_KEY`/`JWT_SECRET` como fallback) |
| `TWO_FACTOR_RECOVERY_PEPPER` | Pepper dedicado para hash dos códigos de recuperação (usa `JWT_SECRET` como fallback) |
| `FRONTEND_URL` | URL pública usada em links |
| `NEXT_PUBLIC_SITE_URL` | URL base do frontend |
| `NEXT_PUBLIC_BASE_PATH` | Base path público |
| `CINE_BACKEND_URL` | Backend usado pelo Next.js |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Validação HMAC |
| `ADMIN_EMAIL` | Conta administrativa inicial |
| `ADMIN_PASSWORD` | Senha administrativa inicial |
| `WEBHOOK_TESTER_ENABLED` | Simulador interno de webhooks |
| `TEST_DATABASE_URL` | Testes concorrentes PostgreSQL |

Integrações também podem ser configuradas pelo painel. Variáveis de ambiente funcionam como origem segura ou fallback conforme o provider.

## 26. Desenvolvimento local

Instalação:

```bash
npm ci
```

Frontend e backend:

```bash
npm run dev
```

URLs locais:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:4000
Admin:    http://localhost:4000/admin
```

Encerrar os processos:

```bash
npm run dev:stop
```

## 27. Banco de dados

Aplicar migrations:

```bash
npm run db:migrate
```

Criar dados iniciais:

```bash
npm run db:seed
```

As variáveis de conexão devem estar disponíveis no ambiente do processo que executa a migration.

## 28. Validação e testes

TypeScript:

```bash
npm run lint
```

Build de produção:

```bash
npm run build
```

Testes disponíveis:

```bash
npm test
npm run test:e2e
TEST_DATABASE_URL=postgresql://... npm run test:postgres
```

O comando executa:

- smoke tests de API e fluxos essenciais;
- testes de assinatura do webhook Mercado Pago;
- testes concorrentes PostgreSQL quando `TEST_DATABASE_URL` existe;
- E2E Playwright para navegação pública, 404, conta e autenticação administrativa.

Coberturas relevantes incluem autenticação, e-mail, evento privado, pagamento, cancelamento do Clube, crédito, webhook, criação de tickets e concorrência de poltronas. Os testes de tempo real abrem clientes WebSocket concorrentes, confirmam o bloqueio do primeiro, a rejeição do segundo, o broadcast de mudança e a liberação da cadeira. O smoke test também verifica que a Bilheteria não conclui uma venda usando uma reserva pertencente a outro token.

## 29. Deploy na VPS

O procedimento operacional completo, com comandos, dados persistentes, rollback, health checks e politica de exclusao de releases, esta em [`DEPLOY_VPS.md`](DEPLOY_VPS.md). Esse runbook e a referencia para publicacoes em producao.

Monitoramento e resposta a incidentes estão em [`OPERATIONS.md`](OPERATIONS.md). Backup criptografado, restauração isolada, RPO e RTO estão em [`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md).

Estrutura atual:

```text
/home/ubuntu/projects/cinecruzeiro/
|-- current -> releases/<release-id>
|-- releases/
|-- shared/
|   |-- backend.runtime.env
|   |-- backend.env.local
|   |-- uploads/
|   `-- data/
`-- ecosystem.config.cjs
```

Processos PM2:

```text
cinecruzeiro-backend  -> 127.0.0.1:4100
cinecruzeiro-frontend -> 127.0.0.1:3100
```

Fluxo recomendado:

1. testar e gerar commit;
2. publicar no GitHub;
3. criar release isolada na VPS;
4. instalar dependências;
5. carregar env e uploads persistentes de `shared/`;
6. executar build;
7. aplicar migrations;
8. trocar o symlink `current` atomicamente;
9. recarregar PM2;
10. verificar health check e páginas públicas;
11. remover releases antigas somente após sucesso.

O deploy não deve alterar a aplicação principal da LumixEngine fora do caminho `/projects/cinecruzeiro`.

## 30. Operação diária

### Programação

1. cadastrar ou importar filme pelo TMDB;
2. revisar mídia e conteúdo;
3. definir status e estreia;
4. criar sessões ligadas à sala;
5. conferir capacidade e preços;
6. publicar e ordenar o catálogo.

### Bilheteria

1. selecionar venda rápida, cliente avulso ou cadastrado;
2. escolher filme e sessão;
3. informar tipos, quantidades e itens da bomboniere;
4. selecionar todas as poltronas quando a sala exigir mapa;
5. registrar o meio de pagamento;
6. emitir ticket;
7. validar entrada por QR Code ou código manual.

### Clube

1. acompanhar pagamentos pendentes;
2. consultar titular pelo nome ou e-mail;
3. verificar créditos e ciclo;
4. cancelar renovação quando solicitado;
5. evitar reativação sem nova autorização;
6. consultar assinaturas finalizadas no histórico.

### Integrações

1. cadastrar credenciais no painel;
2. salvar;
3. testar conexão;
4. ativar somente após teste válido;
5. acompanhar logs e webhooks sem expor secrets.

## 31. Dependências externas e pendências reais

Recursos que dependem de configuração externa:

- Mercado Pago requer credenciais e webhook secret do ambiente correto;
- Google Wallet requer issuer, class e service account aprovados;
- Google Login requer OAuth e redirect URI válidos;
- TMDB requer API key ou bearer token;
- SMTP requer host, porta, usuário, senha e remetente válidos;
- câmera requer HTTPS, permissão do navegador e dispositivo compatível.

Antes de uma nova liberação, homologar pelo menos:

- Pix real e webhook;
- pagamento recorrente do Clube;
- cancelamento sem nova cobrança;
- verificação e recuperação por e-mail;
- solicitação de eventos;
- upload de imagens;
- emissão, PDF, Wallet e validação de ingresso;
- responsividade mobile do checkout e Admin.

## 32. Identidade visual

Diretrizes atuais:

- fundo navy escuro;
- amarelo/dourado apenas como destaque e ação principal;
- tipografia de alto contraste;
- ícones Lucide no lugar de emojis;
- cards com raio contido;
- poucas bordas sólidas;
- sombras suaves e separação por espaçamento;
- controles compactos no Admin;
- imagens reais ou mídia oficial;
- prioridade para telas mobile sem rolagem horizontal.

## 33. Referências complementares

- `DESIGN.md`: sistema visual e decisões de interface;
- `CLUBE_HIBRIDO_E_FISCAL.md`: domínio híbrido, fluxos, estados e limites fiscais;
- `DOCUMENTACAO.md`: documentação histórica extensa, podendo conter decisões anteriores já substituídas por este README.

Este `README.md` é a referência resumida e canônica para o estado atual do código em 31 de agosto de 2026.
