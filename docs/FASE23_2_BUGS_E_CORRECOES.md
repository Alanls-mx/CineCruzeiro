# Fase 23.2 — defeitos e correções

Ambiente: branch `codex/cine-homologacao-fase23`, contas sintéticas, SDKs simulados, pagamentos simulados e PostgreSQL local descartável. Nenhum ensaio usou provedor, cartão, banco operacional ou terminal real.

| ID | Gravidade | Contrato afetado e reprodução | Correção | Evidência | Estado |
| --- | --- | --- | --- | --- | --- |
| F23.2-01 | Alta | Após a API criar uma Order de cartão, a resposta se perde. O segundo clique gerava outra chave de idempotência. O teste Playwright falhou comparando duas chaves distintas; isso poderia iniciar outra cobrança. | Persistir a identidade da tentativa no rascunho **antes** do POST; reutilizá-la após perda de resposta e reload para a mesma composição. Impedir mudança da composição enquanto o resultado for incerto e bloquear double-submit na mesma página. Resposta terminal 4xx libera a tentativa para correção dos dados; resposta 5xx ou perda de rede a preserva. | `e2e/card-payment-resilience.spec.js`, `e2e/checkout-payment.spec.js`; commit `a401595` | Corrigido localmente. O caso de commit perdido após aceite externo continua bloqueado para homologação integral. |
| F23.2-02 | Média | Quando o usuário gerava Pix durante uma tentativa inconclusiva, o erro aparecia na página, mas o handler de clique descartava uma Promise rejeitada. O Next em desenvolvimento registrou `unhandledRejection`. | Tratar a rejeição no clique Pix e na barra móvel; a mensagem continua sob controle do checkout. O Brick mantém sua Promise para o SDK. | Teste de mudança Pix durante tentativa de cartão; commit `5fce3d3` | Corrigido localmente. |
| F23.2-03 | Teste | A suíte E2E completa falhou por `429` no cadastro quando dois novos testes passaram a consumir o mesmo limite de IP. Isso também interrompeu a jornada existente de cadastro. | Pré-carregar somente as contas sintéticas de cartão no fixture descartável. A jornada de cadastro original permanece íntegra e continua exercitando o rate limit real. | Execução completa inicial: 24 passaram, 2 falharam e 2 não rodaram; fixture e teste Pix em `f420a09` | Corrigido no harness; nova execução completa registrada no relatório principal. |

## Riscos abertos que não foram ocultados por mudanças de teste

- **Intenção financeira antes do efeito externo:** os ramos Pix/cartão ainda chamam `createActiveOnlinePayment` antes do `writeDb` final. Se o provedor aceitar e o commit local falhar, o navegador preserva a chave, mas a operação não ganha uma intenção local durável. Os failpoints existentes mostram rollback e retry em ambiente simulado; não demonstram recuperação automática após fechamento definitivo do navegador ou ausência de resposta do provedor. Exige projeto transacional próprio, sem alteração de protocolo por conveniência desta etapa.
- **Refund entre operadores:** não há ainda ensaio SQL com duas instâncias e o mesmo estorno parcial/integral, incluindo resposta externa perdida. Mantido como bloqueio de homologação desse ramo.
- **PagBank externo:** SDK, captura e webhook testados por simulação e serviços; a conta e o provedor reais não foram exercitados. Não presumir que um cartão fictício prova aceite real.

Nenhuma regra financeira, assinatura de webhook ou migration foi modificada para fazer os testes passarem.
