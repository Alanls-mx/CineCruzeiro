# Deploy coordenado de instalações independentes

O repositório do Cine Cruzeiro é a única fonte de código. Cada cinema continua sendo uma instalação independente, com banco, uploads, configurações, processos PM2 e diretório próprios.

## Funcionamento

1. O deploy clona uma única vez o commit solicitado.
2. Todas as releases são preparadas e compiladas antes da publicação.
3. A identidade visual de cada cinema é aplicada apenas na release dele.
4. Cada banco recebe backup antes das migrations.
5. Os links `current` são trocados atomicamente e os processos PM2 são recarregados.
6. Se uma instalação não passar no health check, todas as instalações já trocadas voltam à release anterior.

O registro não contém senhas. Credenciais permanecem em `shared/backend.runtime.env` e `shared/backend.env.local` dentro de cada instalação.

## Registro da VPS

Copie `config/cinema-instances.example.json` para:

```text
/home/ubuntu/projects/cinema-instances.json
```

Cadastre nesse arquivo somente instalações completamente preparadas. Uma entrada habilitada exige:

```text
/home/ubuntu/projects/<slug>/
  backups/
  current -> releases/<release>
  ecosystem.config.cjs
  releases/
  shared/
    backend.runtime.env
    backend.env.local
    branding/
```

Os recursos opcionais de marca ficam em:

```text
shared/branding/public/
shared/branding/backend-public/
```

Esses diretórios são sobrepostos à release depois que o código é extraído. Não devem conter ambientes, bancos, logs ou dados operacionais.

As cinco instalações planejadas já aparecem desabilitadas no arquivo de exemplo. Elas só devem receber `enabled: true` depois que banco, ambiente, processos, Nginx e os três recursos obrigatórios de logo estiverem prontos. Isso impede a publicação acidental de uma demo com a marca do cinema-base.

## Bootstrap seguro de uma demonstração

O bootstrap cria um banco vazio, usuário PostgreSQL exclusivo, segredos próprios, credencial administrativa aleatória e configuração PM2. A carga demonstrativa consulta apenas tabelas de catálogo permitidas e gera sessões futuras novas. Usuários, pedidos, pagamentos, ingressos, campanhas, logs, webhooks, tokens e integrações não são copiados.

```bash
CINEMA_INSTANCES_FILE=/home/ubuntu/projects/cinema-instances.json \
  node scripts/bootstrap-demo-instance-vps.mjs <slug> /tmp/<slug>-branding
```

As credenciais iniciais ficam, com permissão `0600`, em `shared/demo-admin.txt` dentro da instalação. Imagens de produtos não são herdadas porque podem conter a marca do cinema-base. Apenas arquivos de pôster e backdrop efetivamente referenciados no catálogo são copiados para os uploads independentes.

Os blocos Nginx das demonstrações são gerados pelo registro, evitando divergência entre rota e porta:

```bash
node scripts/render-demo-nginx.mjs /home/ubuntu/projects/cinema-instances.json \
  cinemax-piraju cine-estacao-amparo cine-gama cinemania-cosmopolis
```

O resultado deve ser salvo em um snippet incluído dentro do servidor `lumixengine.com`. Sempre faça backup do site ativo, execute `nginx -t` e só então recarregue o Nginx.

## Comandos

Validar o formato local:

```bash
npm run deploy:validate
npm run deploy:plan
```

Simular o registro real da VPS:

```bash
CINEMA_INSTANCES_FILE=/home/ubuntu/projects/cinema-instances.json \
  node scripts/deploy-all-vps.mjs --dry-run
```

Publicar o HEAD do repositório em todas as instalações habilitadas:

```bash
bash scripts/deploy-vps.sh
```

Publicar um commit específico:

```bash
bash scripts/deploy-vps.sh <commit>
```

Publicar somente uma instalação durante diagnóstico:

```bash
bash scripts/deploy-vps.sh <commit> --only <slug>
```

`--only` é uma exceção operacional. O fluxo normal deve publicar todas as instalações habilitadas para impedir divergência de código.

## Regras de segurança

- Nunca adicionar `DATABASE_URL`, tokens ou senhas ao registro.
- Nunca cadastrar uma instalação sem banco e processos próprios.
- Nunca apontar dois cinemas para a mesma porta, pasta, rota ou processo PM2.
- Não usar uma variação como origem. Todas as releases partem do mesmo commit Git.
- A publicação não copia bancos, uploads ou arquivos `.env` entre cinemas.
