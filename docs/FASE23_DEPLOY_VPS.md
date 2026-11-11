# Fase 23 — candidata e portões de implantação na VPS

## Estado após a publicação parcial de 11/11/2026

A release `20261111-polimento-bb38d06` foi ativada para os arquivos de interface alterados no commit `bb38d06`. O frontend foi compilado na VPS e reiniciado; o backend financeiro permaneceu em execução. Os arquivos do Admin também foram copiados para a release anterior, da qual o processo backend ainda servia arquivos estáticos. A release anterior e uma cópia dos arquivos do Admin foram preservadas. A verificação confirmou HTTP 200 para home, catálogo, Admin e health check, além dos dois processos PM2 online. Esta foi uma publicação parcial sobre a base instalada, e o `release-info.json` herdado identifica o código base do backend, não a totalidade do commit `bb38d06`.

As avaliações NO-GO abaixo registram o estado da **troca integral de backend** na época dos respectivos preflights. A publicação parcial de interface não executou corte financeiro, migration, reconciliação dos pagamentos pendentes ou restauração de backup operacional. Antes de uma troca integral, reconfirmar esses estados e aplicar o runbook de corte ao SHA candidato.

## Preflight restrito de 09/11/2026 — somente leitura

Autorizado para metadados e contagens agregadas do **Cine Cruzeiro**. Host `ip-172-31-41-15` (`18.231.175.103`); `current` resolve para `/home/ubuntu/projects/cinecruzeiro/releases/20261105-221045-6d216eb`, manifesto SHA `6d216eb5fb956bba88d9726b3cf7aaaf8de86f8b`. PM2: backend e frontend Cine Cruzeiro online (backend com um restart registrado); os processos dos quatro cinemas vizinhos estavam online. Nginx validou sua configuração e mantém o prefixo do Cine, com API/admin/assets em `127.0.0.1:4100` e frontend em `127.0.0.1:3100`.

PostgreSQL 18.6 ativo; banco e role exclusivos nomeados `cinecruzeiro`, 50 migrations registradas, últimas 051/052. O disco raiz tinha cerca de 3,0 GB livres de 28 GB (90% ocupado), memória disponível cerca de 1,6 GB. Contagens pontuais: três pedidos e três pagamentos Mercado Pago pendentes desde 09–10/10; nenhuma lease travada nas filas consultadas e nenhum hold ativo. Isto não prova dreno nem saúde financeira. Nenhum backup, restore, migration, chamada a provedor, reinício ou troca de release foi realizado.

**Decisão atual: NO-GO técnico e operacional.** O probe isolado do SHA antigo terminou por timeout após ~10 s com WebSocket 1006 e stream HTTP abortado; não houve dreno gracioso. A candidata possui retomada controlada opcional, mas ainda falta inbox/recovery de callbacks durante o corte e teste integrado entre as duas releases. Os três pagamentos pendentes requerem conciliação autorizada. Também faltam backup atual/restauração isolada, janela, executores, limite de interrupção e plano de recuperação aprovado. O espaço livre deve entrar no cálculo do backup, sem limpeza arbitrária. O ensaio manual de provedores continua **dispensado, não executado**.

Para a futura execução controlada, a candidata deve iniciar com `CINE_CONTROLLED_STARTUP=1` e sem receber tráfego de checkout. Cada SIGUSR2 enviado **ao PID exato do backend Cine Cruzeiro** promove apenas um estágio; conferir o evento de transição antes do próximo. Não promover para `checkout` até conciliar pendências; não promover para `workers` sem conferir leases/ownership. Esta instrução prepara o procedimento, não autoriza sinais na VPS. O modo padrão não usa esses estágios. Não usar `deploy-all-vps.mjs`, `pm2 restart all` nem `db:migrate` comum para este piloto.

| Campo da ficha operacional desta troca | Situação |
| --- | --- |
| SHA instalado | `6d216eb5fb956bba88d9726b3cf7aaaf8de86f8b`, confirmado por `release-info.json` de `current`. |
| SHA candidato | Commit de código `001f7af1c72137b0597098004d3e7ed1b880899d`; fixar o SHA final após a documentação e a CI. |
| Janela e executores | **Não definidos**: responsável pelo corte e responsável pela conciliação financeira precisam ser designados. |
| Recursos permitidos | Planejamento restrito ao backend/frontend, prefixo Nginx e banco exclusivo do Cine Cruzeiro. Nenhuma escrita autorizada nesta verificação. |
| Limite de interrupção | **Não aprovado**; definir duração máxima e critérios de abortar antes da janela. |
| Dreno e callbacks | **Sem prova integrada** com a release antiga. Escolher parada supervisionada com inventário/conciliação ou release intermediária; testar callback assinado durante a troca. |
| Backup e restauração | Novo backup da base/artefatos atuais e restore isolado **pendentes de autorização específica**; 3 GB livres exigem dimensionamento prévio. |
| STOP e recuperação | Parar diante de estado inconclusivo sem autoridade, callback não recuperável, dreno sem prova, backup inválido, startup malsucedido ou impacto a outro cinema. Reverter código isoladamente; não restaurar banco sobre transações posteriores. |

## Registro histórico anterior ao preflight de 09/11

**Atualização posterior:** ver [fechamento dos bloqueios](FASE23_FECHAMENTO_BLOQUEIOS.md) e [dreno/callbacks](FASE23_CORTE_CALLBACKS.md). A intenção Pix/cartão e a reconciliação por consulta permitida foram implementadas localmente; o portão D e os casos sem autoridade consultável seguem bloqueados. O manifesto de SHA abaixo descreve a candidata anterior, não a branch após esta continuação. Nenhum novo deploy foi executado.

**Resultado: NO-GO; implantação não iniciada.** Cinema de destino: Cine Cruzeiro, instalação de desenvolvimento. A referência histórica é `/home/ubuntu/projects/cinecruzeiro` e prefixo `/projects/cinecruzeiro`; nenhum deles foi tratado como identidade confirmada da VPS atual. Nenhum comando SSH, backup remoto, DDL, alteração de Nginx, troca de `current` ou PM2 foi executado nesta etapa.

**Candidata desta continuação:** a branch possui reconciliação sintética e provas distribuídas de reembolso parcial posteriores ao manifesto histórico abaixo. O SHA final deve ser lido do HEAD após o commit documental. A release em execução na VPS continua não identificada nesta execução. Nenhum portão de corte, callback ou backup foi liberado por esses commits; não há autorização operacional específica de janela/responsável/limites/reversão para a troca atual.

## Manifesto da candidata local

| Campo | Evidência |
| --- | --- |
| Branch e código | `codex/cine-homologacao-fase23`, `f6012bacc17d0a29339c5e10176ed81bd7badeb0` |
| Origem histórica | `e883e459d7fa2f42d73ca4210f4949f154082f26`; sete commits posteriores da Fase 23.2 |
| Working tree do código | Limpo antes da criação destes relatórios; `git status --porcelain` sem saídas |
| Dependências | `package-lock.json`, SHA-256 `DF100644104B7E77F046BC428CE5FF301EC18A282A821947A397B0ADC4BCF4A3`; `npm run build` passou no mesmo código |
| Rota frontend | `next.config.mjs` define `basePath` e `assetPrefix` de produção `/projects/cinecruzeiro`, salvo override por ambiente; valor efetivo da VPS não conferido |
| Esquema versionado | 50 migrations; nenhuma migration nova entre `e883e45` e a candidata. A aplicação de 051/052 em 05/11 está documentada, mas não foi reconfirmada remotamente |
| Releases históricas | Registro de 05/11 cita instalada `6d216eb5fb956bba88d9726b3cf7aaaf8de86f8b` e anterior `ea7c5df...`; **estado atual desconhecido** |
| CI da candidata | Security, Browser E2E e PostgreSQL 16/18 verdes no SHA de código; links no [relatório](FASE23_RELATORIO_FINAL.md) |

Nenhuma release foi empacotada ou copiada à VPS. O script multi-instalação recusa Cine Cruzeiro com `CINECRUZEIRO_DEPLOY_GATE_PENDING`; não é executor alternativo. Nenhum arquivo não versionado é necessário à candidata de código, mas as configurações/runtime da instalação exigem inventário remoto específico antes de preparar artefato.

## Avaliação dos portões

| Portão | Estado e prova faltante |
| --- | --- |
| A — isolamento | **Pendente.** Identidade atual do host, diretório, Nginx, portas, PM2, banco/role e quatro cinemas vizinhos não reconfirmada. Nenhuma operação remota selecionada. |
| B — release | **Aprovado localmente para código `f6012ba`**, com build e três workflows verdes. Qualquer commit seguinte exige CI próprio no SHA final. Build e configuração efetiva na VPS ainda não verificados. |
| C — banco | **Pendente.** Repositório contém 50 migrations e não acrescentou novas nesta branch; histórico/schema e compatibilidade da base atual da VPS não consultados. DDL não autorizado nem necessário por evidência local. |
| D — corte/dreno | **BLOQUEADO.** Não há prova de dreno da release antiga para requests, WS/SSE, callbacks e efeitos externos, nem retomada gradual dos workers. Ver [Portão D](FASE13_2_PORTAO_D_CORTE_DRENO.md). |
| E — backup/restore | **Pendente.** Ensaio sintético PostgreSQL passou; nenhum backup novo da base atual, uploads e runtime foi criado ou restaurado. Os dumps de 05/11 não substituem backup novo. |
| F — recuperação | **Pendente.** Reversão de código só pode ser avaliada com schema e efeitos posteriores conhecidos; restore automático de banco é proibido. Necessários responsável financeiro, janela, limite e plano de reconciliação. |
| G — decisão | **NO-GO.** Risco financeiro antes do primeiro commit e D bloqueado bastam para impedir o corte, independentemente dos portões pendentes. |

**Ensaio manual de provedores:** aprovado **por dispensa do responsável** para a release de desenvolvimento. Não foi executado nem é evidência de homologação externa. Os portões financeiros locais, de corte, backup e recuperação permanecem independentes e não foram dispensados.

## Corte e recuperação ainda necessários

Antes de uma nova decisão, confirmar a identidade exclusiva da instalação e o inventário mínimo autorizado de jobs/leases/operações inconclusivas. Ensaiar uma pausa apenas do prefixo Cine Cruzeiro na configuração efetiva, inclusive callbacks e upgrades, medindo requests em andamento e efeitos externos. Demonstrar armazenamento/retomada seguros de callbacks e liberação por categoria de worker. Criar backup novo em destino privado, registrar hashes e restaurar em ambiente isolado sem provedores nem workers. Preservar a release anterior. Preparar respostas separadas para falha antes do corte, após troca, após commit e após efeito externo; jamais repetir cobrança/refund com nova identidade ou restaurar banco sobre transações posteriores. Apenas com todos os portões aprovados executar troca de `current` e processos Cine Cruzeiro específicos; não usar `pm2 restart all` ou deploy multi-cinema.

A autorização do pedido é condicional aos portões. A [ficha operacional anterior](FASE13_AUTORIZACAO_ATUALIZACAO.md) não contém janela/responsável/limites da presente atualização. O bloqueio técnico foi identificado antes de qualquer operação remota; por isso não houve preflight SSH nem consulta de estado de negócio nesta execução.
