# Disaster recovery - Cine Cruzeiro

Este runbook descreve recuperacao tecnica. Ele nao substitui politicas fiscais, contabeis ou juridicas de retencao.

## Objetivos

- RPO operacional: ate 6 horas de dados.
- RTO operacional: ate 4 horas para restaurar banco, uploads e uma release validada.
- Retencao recomendada: 14 copias diarias, 8 semanais e 12 mensais.
- Destino: armazenamento fora da VPS, com criptografia GPG e acesso restrito.

## Backup

Instale a chave publica GPG do destino, carregue `DATABASE_URL` sem imprimi-la e execute:

```bash
export BACKUP_DESTINATION=/mnt/backup-offsite/cinecruzeiro
export BACKUP_GPG_RECIPIENT=backup@cinecruzeiro
export BACKUP_RETENTION_DAYS=35
bash scripts/backup-production.sh
```

Agende a cada seis horas com systemd timer ou cron. O destino local deve ser sincronizado para outra conta/regiao. O script inclui PostgreSQL, `shared/uploads` e os arquivos de configuracao, sempre dentro de um pacote criptografado. Secrets nunca entram no Git.

## Teste de restauracao

Execute mensalmente em banco e diretorio isolados:

```bash
export BACKUP_FILE=/mnt/backup-offsite/cinecruzeiro/cinecruzeiro-AAAAMMDDTHHMMSSZ.tar.gz.gpg
export RESTORE_DATABASE_URL='postgresql://.../cinecruzeiro_restore_test'
export RESTORE_UPLOADS_DIR=/tmp/cinecruzeiro-uploads-restore-test
export RESTORE_CONFIRM=RESTORE_TO_ISOLATED_TARGET
bash scripts/restore-production.sh
DATABASE_URL="$RESTORE_DATABASE_URL" npm run db:migrate
TEST_DATABASE_URL="$RESTORE_DATABASE_URL" npm run test:postgres
```

Registre data, backup usado, checksums, quantidade de tabelas/pedidos/ingressos e resultado dos testes. Apague o ambiente isolado somente depois da evidencia. Nunca aponte o teste para a `DATABASE_URL` de producao.

## Recuperacao de incidente

1. Preserve logs e identifique o ultimo backup valido.
2. Crie um PostgreSQL novo e um diretorio novo de uploads.
3. Restaure usando o procedimento isolado.
4. Aplique migrations da mesma release que sera promovida.
5. Execute health, smoke tests e verificacoes de contagem.
6. Atualize os arquivos de ambiente persistentes para os novos destinos.
7. Recarregue um unico backend e o frontend pelo PM2.
8. Valide pagamento, ingresso, QR e consulta de pedido antes de reabrir vendas.

Rollback de codigo nao reverte migration nem dados. Nunca execute rollback SQL destrutivo automaticamente.
