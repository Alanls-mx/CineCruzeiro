# Fase 13 - ficha para eventual Portao B

**Formulario nao preenchido e nao concedido. Nenhuma operacao remota de escrita esta autorizada por esta ficha.** Preencher fora do repositorio as referencias restritas e aprovar explicitamente cada linha. A preparacao do Portao A, credenciais existentes e CI verde nao substituem a assinatura do responsavel.

Fase 13.1 adicionou [guard de alvo e entrypoint fechado](FASE13_1_FECHAMENTO_BLOQUEADORES.md); eles nao aprovam esta ficha. Solicitar separadamente o manifesto restrito de migrations, ensaio de corte/dreno da release antiga, comportamento de retry de cada callback e plano de retomada por categoria antes de propor janela. Nao publicar URL de banco, segredos ou dados financeiros nesta ficha.

| Campo | Valor a confirmar |
| --- | --- |
| Cinema / ambiente | Cine Cruzeiro / desenvolvimento na VPS LumixEngine |
| Responsavel pela aprovacao / operador / conciliador financeiro / canal | **Pendente** |
| Janela, fuso, duracao maxima, ponto de corte, limites de parada | **Pendente** |
| Release antiga / SHA | `ea7c5df24cf44d64516d00d81585cb2b0f7efe09`; reconfirmar `current` e manifesto |
| Release candidata / SHA imutavel e CI associado | **Pendente** |
| Diretorio exclusivo | `/home/ubuntu/projects/cinecruzeiro`; reconfirmar |
| Banco e role / evidencia de exclusividade | Identificadores proprios por metadados, fingerprints `e599e94bf4eb`; role ainda tem `CONNECT` em seis outros bancos. Revisao de grants e assert de alvo de DDL **pendentes**; nomes exatos por canal restrito, sem revelar senha |
| Consultas operacionais autorizadas (tabelas, campos, agregacoes, IDs restritos, retencao) | **Pendente de autorizacao separada** |
| Pausa de HTTP, WebSocket, callbacks, workers, maintenance e in-flight | **Mecanismo e ensaio pendentes; bloqueia Portao B** |
| Backup: banco, release, env restrito, uploads, PM2/Nginx pertinentes; destino, ACL, espaco, retencao | **Pendente de autorizacao separada** |
| Restore de ensaio: destino isolado, controle de rede, hashes e invariantes | **Pendente de autorizacao separada** |
| Migrations permitidas | `051_ticket_email_jobs.sql`, depois `052_point_payment_methods.sql`, apenas banco confirmado e apos backup restaurado; **nao autorizadas ainda** |
| Processos permitidos para parada/reinicio | Somente `cinecruzeiro-backend` e `cinecruzeiro-frontend`, conforme pausa validada; **nao autorizados ainda** |
| Servicos externos bloqueados / mocks permitidos | Mercado Pago/Point, Pix/cartao, refunds, SMTP/email, Wallet, Studio/publicacao e impressao: **bloqueados ate escopo especifico** |
| Infraestrutura fora do escopo | Outros quatro cinemas, PM2 global, Nginx global, DNS, TLS, firewall, demais bancos e uploads |
| Criterios de parada, plano de retorno antes/depois de migration e apos efeito externo | **Pendente**, seguir [matriz](FASE13_MATRIZ_ATUALIZACAO.md) e [runbook](FASE13_RUNBOOK_EXECUCAO.md) |
| Resultado A-F do preflight e evidencias/links de CI no mesmo SHA | **Pendente de fechamento**; ver [relatorio](FASE13_PREFLIGHT_OPERACIONAL.md) |
| Autorizacao explicita por operacao (inventario, pausa, backup, restore, migration, troca, reinicio, liberacao) | **Nenhuma concedida** |
| Registro da decisao do responsavel, data e limite de validade | **Pendente** |

Para solicitar o Portao B, apresentar esta ficha preenchida com evidencias do PostgreSQL 18, compatibilidade executavel da release antiga com esquema novo, pausa de workers/requests comprovada, backup restauravel e CI final. A aprovacao deve nomear as operacoes e recursos de cada etapa; nao se aceita "continue" como autorizacao implicita para efeitos remotos.
