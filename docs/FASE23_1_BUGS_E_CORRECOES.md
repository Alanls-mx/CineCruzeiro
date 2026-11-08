# Fase 23.1 — defeitos e correções

## B01 — dados da conta permaneciam após sair (P1, corrigido)

**Fluxo:** conta do cliente. Depois do cadastro, clicar em **Sair** mantinha o formulário de criação montado com e-mail e senha, apesar de a sessão ter terminado. O teste de navegador [customer-account-lifecycle.spec.js](../e2e/customer-account-lifecycle.spec.js) reproduziu a falha antes da correção. `src/app/conta/page.tsx` agora retorna ao modo de login e limpa campos de cadastro, token de recuperação, perfil sensível e mensagens locais. O mesmo teste passou em JSON e PostgreSQL descartável. Commit `ef4532d`.

## B02 — alteração de sessão não aparecia nos logs técnicos PostgreSQL (P2, corrigido)

**Fluxo:** edição e cancelamento de sessão com vendas. A operação persistia sessão e auditoria em `audit_logs`, mas `/api/admin/logs?view=technical` lia `system_logs`; o evento `session.updated` não aparecia. O E2E [session-sales-consistency.spec.js](../e2e/session-sales-consistency.spec.js) falhou mesmo após aguardar o evento. O handler passou a publicar `session.updated`/`session.cancelled` em `system_logs` somente depois de `sessionRepository.update`, sem alterar a transação, a resposta HTTP ou a trilha em `audit_logs`. O teste passou em PostgreSQL descartável. Commit `5575881`. A apresentação técnica permanece assíncrona; falha dessa escrita não reverte uma sessão já confirmada.

## Falhas do ambiente de teste corrigidas

- A fixture do Admin tinha `passwordHash` vazio e dependia da normalização JSON. Ao importar diretamente para PostgreSQL, o login falhou. A fixture agora recebe hash PBKDF2 sintético antes da importação. Nenhuma credencial operacional foi usada.
- A suíte completa excedia o limite real de 12 logins administrativos por minuto no mesmo IP e recebia 429. As consultas de apoio dos testes de checkout reutilizam uma sessão administrativa de teste, sem desabilitar ou elevar o rate limit do servidor. A resposta 429 foi verificada antes dessa alteração.
- Foi adicionado um caminho E2E PostgreSQL protegido por nome descartável, marcador de servidor/banco, Docker local com `tmpfs`, migrations e limpeza do banco/contêiner. JSON permanece como ensaio de compatibilidade.

Essas alterações do harness estão no commit `f0fab41`. O primeiro lote de concorrência PostgreSQL 16 executado ao mesmo tempo que o navegador perdeu um worker no Windows antes de `ready` (código `3221226505`); esse resultado não foi contado como aprovado. O lote foi repetido sozinho; o resultado está no [relatório da fase](FASE23_1_HOMOLOGACAO_FUNCIONAL.md).

Não foi necessário alterar pagamentos, reembolsos, HMAC, migrações ou permissões. Logs de tentativa de e-mail sem canal configurado no E2E representam a integração externa não exercitada, não uma entrega aprovada.
