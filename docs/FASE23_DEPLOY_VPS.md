# Fase 23 — candidata e portões de implantação na VPS

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
