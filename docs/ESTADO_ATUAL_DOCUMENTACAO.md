# Estado atual da documentação

Revisão de 11/11/2026. Este índice distingue o código da `main`, a validação automatizada e a publicação parcial da interface na VPS. Relatórios de fases anteriores preservam a evidência e a decisão da data em que foram produzidos.

## Versões conferidas no repositório

| Componente | Manifesto | Instalação local consultada |
| --- | --- | --- |
| Next.js | `16.4.5` | `16.4.5` |
| React / React DOM | `^19.2.4` | `19.2.4` |
| Tailwind CSS | `^3.4.14` | `3.4.19` |
| Node.js | `>=20.9.0 <25` | A VPS foi observada com Node 22 na auditoria de 09/11 |

O manifesto e o lockfile são a fonte para uma nova instalação. As versões efetivamente instaladas devem ser conferidas no ambiente alvo, pois os intervalos `^` permitem revisões posteriores.

## Código, testes e instalação

- O [README](../README.md) descreve o projeto e os comandos atuais. O [Mapa Inteligente](architecture/README.md) localiza rotas, módulos, dependências e persistência.
- O [guia PostgreSQL](TESTES_POSTGRESQL.md) descreve o harness descartável. `npm test` reúne unidade, smoke, concorrência e repositórios. `npm run test:legacy:json` exercita compatibilidade. Os workflows de navegador e PostgreSQL validam cada SHA publicado.
- O [polimento de novembro](POLIMENTO_GERAL_CINE_CRUZEIRO.md) registra o escopo do teste visual e os limites da validação. A [publicação parcial](FASE23_DEPLOY_VPS.md) aplicou sete arquivos de interface alterados no commit `bb38d06` sobre a instalação existente. A [validação após publicação](FASE23_VALIDACAO_POS_DEPLOY.md) confirma disponibilidade e arquivos servidos, sem homologação de pagamentos reais.
- A troca integral do backend segue os [portões operacionais](FASE23_DEPLOY_VPS.md) e o [runbook](FASE13_RUNBOOK_EXECUCAO.md). Os registros das Fases 12 e 13 que mostram migrations 051/052 pendentes antecedem o preflight de 09/11, que confirmou ambas aplicadas.

Nesta revisão, os links locais dos 112 arquivos Markdown examinados, incluindo `docs/` e o README, foram conferidos. Isso valida destinos de links, não a equivalência semântica de cada relatório histórico com o código atual.
