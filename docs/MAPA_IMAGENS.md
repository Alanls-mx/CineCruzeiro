# Mapa visual das imagens

## Convenção

Base absoluta de todos os arquivos abaixo: `C:/Users/alanl/Downloads/Cine Cruzeiro/apresentacao-cine-cruzeiro-demonstracao-4k-v2/`.

Foram analisadas visualmente 61 imagens: as 59 numeradas do guia, incluindo 25b, 25c, 30b e 30c, e duas capturas adicionais de e-mail que apareceram na pasta durante a revisão. O nome do arquivo não prevalece sobre o estado visível. O guia foi usado como contexto, não como garantia do conteúdo.

Crop = `(x, y, largura, altura)` em frações de 0 a 1 da imagem original, origem superior esquerda. Converter em pixels pela dimensão original, arredondar e ajustar bordas no momento da montagem. São regiões iniciais propostas, não recortes já executados. `Integral` significa `(0,0,1,1)`. Preservar proporção ao colocar no slide. Nos registros com duas regiões, A é principal e B é detalhe.

Importância: P1 essencial, P2 apoio, P3 reserva. “Reserva” não obriga uso. “Recapturar” significa que a função desejada não foi comprovada por esse arquivo; nenhum slide final pode conter um placeholder silencioso.

## Cliente

| Arquivo | Slide e papel | Crop proposto | Importância/uso | Leitura visual e cuidados |
|---|---|---|---|---|
| 01-cliente-home.png | 05, descoberta | A `(0.12,0.09,0.77,0.71)` | P1 principal | Hero de Vingadores, selo Estreia, CTA e início do catálogo. Excelente sinal de produto; cortar rodapé/navegação excedente. |
| 02-cliente-home-programacao.png | 05, variedade editorial | B `(0.16,0.79,0.72,0.21)` | P2 secundário | Quase igual a 01. Usar só a faixa de posters/selos Pré-Estreia, Destaque da Semana e Últimos Dias; não repetir Home inteira. Confirmar se rótulos não ficaram cortados. |
| 03-cliente-programacao.png | 06, alternativa de sessão | `(0.17,0.08,0.66,0.48)` | P2 reserva | Página longa 3840 x 3492. Programação de Sobrenatural no alto; Em Breve abaixo. Não atribuir uma sessão a outro filme. |
| 04-cliente-filme-detalhes.png | 06, escolha contextual | A `(0.17,0.09,0.66,0.33)`; B `(0.17,0.63,0.66,0.18)` | P1 principal | 3840 x 2912. A: poster/descrição. B: bloco completo com data e sessão 23:15 à esquerda. A página também diz lugares por ordem de chegada: não alegar assento marcado nessa sessão, nem usar seus textos sobre projeção como especificação técnica auditada do cinema. |
| 05-cliente-selecao-ingressos.png | Sem uso final; substituir por R01 | Integral apenas para auditoria | P1 recapturar | Mostra “Entre para comprar seu ingresso”. Não há seleção de ingressos. Pode provar exigência de login, mas não é a função planejada. |
| 06-cliente-mapa-poltronas.png | Sem uso final; substituir por R02 | Integral apenas para auditoria | P1 recapturar | Mesmo bloqueio de login de 05. Não contém mapa de assentos. Não usar como prova do mapa. |
| 07-cliente-clube.png | 10, apresentação do Clube | `(0.24,0.045,0.52,0.135)` | P2 secundário | Página 3840 x 4674. Hero com proposta do Clube. A revisão ampliada mostrou o carrossel em transição: Duplo escurecido, Família parcial. Não destacar esse plano apagado nem tentar corrigir sua opacidade artificialmente; usar 08 para os benefícios legíveis. |
| 08-cliente-assinatura-clube.png | 10, resumo do plano | `(0.586,0.18,0.191,0.34)` | P1 principal | Resumo à direita com Duplo R$54,90 e benefícios. A área de cartão à esquerda exige login; não comprova cobrança concluída ou recorrência efetiva. |
| 09-cliente-eventos.png | 22, experiência de cinema | `(0.14,0.04,0.72,0.19)` | P2 secundário | 3840 x 5610, hero de sessão para grupos e formulário abaixo. Usar só hero, como extensão do relacionamento. Não chamar de foto real do local sem confirmação de procedência. |
| 10-cliente-o-cinema.png | Reserva de Home, sem uso principal | `(0.12,0.04,0.77,0.39)` | P3 excluir da narrativa institucional | 3840 x 4376. É Home com Vingadores, não página “O Cinema”. Redundante com 01. |
| 11-cliente-minha-conta.png | 11, acesso pós-compra | `(0.18,0.10,0.64,0.40)` | P1 principal | 3840 x 3400. Cabeçalho da conta e acesso aos ingressos. Não há clube ativo nesta conta. Excluir campos pessoais; não usar os campos de cadastro como protagonista. |
| 12-cliente-meus-ingressos.png | 12, ingresso digital | `(0.50,0.10,0.34,0.52)` | P1 principal | 3840 x 3300. QR, filme, data, ações e assento. A bomboniere diz “Sem extras comprados neste pedido”; vínculo exige R06. QR/códigos devem ser inutilizáveis ou mascarados para divulgação. |
| 13-cliente-transferencia-ingresso.png | 12, transferência | `(0.33,0.33,0.51,0.62)` | P2 secundário | Formulário, não conclusão. Ajustar ao bloco do destinatário sem incluir campos pessoais reais. Não prova cooldown nem transferência da bomboniere. |

## Gestão e operação

| Arquivo | Slide e papel | Crop proposto | Importância/uso | Leitura visual e cuidados |
|---|---|---|---|---|
| 14-admin-login.png | 20, reserva | `(0.37,0.20,0.28,0.61)` | P3 reserva | Formulário pequeno em grande área vazia. Não é prova de 2FA; 50 é melhor para isso. |
| 15-admin-dashboard.png | 13, conciliação | A `(0.17,0.02,0.76,0.25)`; B `(0.69,0.26,0.24,0.36)` | P1 principal | KPIs e composição por origem. Gráfico cai a zero no dia seguinte: artefato do cenário demonstrativo, não queda comercial. Não destacá-lo. |
| 16-admin-dashboard-operacao.png | 13, sessões em andamento | `(0.17,0.58,0.77,0.40)` | P2 secundário | Coyote e Vingadores em andamento, Sobrenatural futuro. Operação de 12/09 e financeiro de 14/09 são contextos distintos; legendá-los separadamente. |
| 17-admin-filmes.png | 14, catálogo editorial | `(0.17,0.11,0.76,0.83)` | P1 principal | Lista com selos e editor de identificação de Coyote. Mostra controle de catálogo, não todas as etapas de edição. |
| 18-admin-filme-editor.png | 14, reserva | `(0.51,0.15,0.40,0.77)` | P3 reserva | Quase duplicata de 17 na identificação. Não gastar segundo quadro para repetir. |
| 19-admin-salas.png | 14, configuração espacial | `(0.40,0.22,0.48,0.49)` | P2 secundário | Capacidade e configuração de sala; o mapa está abaixo da dobra. Não usar como mapa do cliente nem como visão completa dos assentos. |
| 20-admin-tipos-ingresso.png | 14, preço configurável | `(0.17,0.16,0.75,0.41)` | P2 secundário | Normal R$10 e meia R$5. Usar controles superiores, não lista de ingressos emitidos. Valores são configuração capturada, não nova política comercial. |
| 21-admin-bilheteria-venda.png | 15, venda presencial | `(0.18,0.20,0.75,0.59)` | P1 principal | Venda em edição, filme/sessão/tipos e resumo. Não há cliente escolhido nem venda concluída. O mapa fica abaixo da dobra. |
| 22-admin-bilheteria-pedidos-demonstracao.png | 15, registro compartilhado | `(0.19,0.33,0.74,0.45)` | P2 secundário | Cinco de oito pedidos, totais inteiros e origens diferentes. Mostrar duas linhas com valor e status, sem prometer que as cinco linhas somam o total dos oito. |
| 23-admin-pedido-completo.png | 09, reserva de pedido misto | `(0.26,0.10,0.48,0.80)` | P3 reserva | Modal com pedido pago, cliente, sessão, ingressos e ações separadas de reembolso. A lista detalhada de bomboniere não está visível. Não usar como prova de itens discriminados. |
| 24-admin-pagamentos.png | 13 ou 15, reserva | `(0.19,0.30,0.74,0.57)` | P2 reserva | Oito registros pagos, Pix/cartão, origem, valor. A linha “Terminal Point não configurado” impede afirmar Point operacional neste ambiente. |
| 25-admin-leitor-ingresso-pronto.png | 16, reserva | `(0.35,0.26,0.41,0.72)` | P3 reserva | Câmera desligada, leitor pronto. Não usar como demonstração de leitura de câmera ativa. |
| 25b-admin-ingresso-conferido.png | 16, antes de liberar | `(0.35,0.27,0.41,0.26)` | P1 secundário | “Confira o ingresso” e “Liberar entrada”. Evidência real da confirmação humana antes da liberação. |
| 25c-admin-entrada-liberada.png | 16, depois da confirmação | `(0.35,0.26,0.41,0.27)` | P1 secundário | “Ingresso válido” e “Entrada liberada”. Prova do estado final na UI, não medição de tempo de fila. |
| 26-admin-bomboniere-vendas.png | 09, compra e produto | A `(0.19,0.27,0.74,0.14)`; B `(0.19,0.46,0.74,0.45)` | P1 secundário | R$563 líquidos, R$585 brutos, 32 itens, R$22 descontos/devoluções. Pedidos organizados por sessão, itens e status de entrega. Usar B focando 1–2 pedidos. |
| 27-admin-bomboniere-cardapio.png | 09, reserva | `(0.19,0.32,0.57,0.49)` | P3 reserva | Produtos, preço, imagem e elegibilidade/ativação. Item em edição, não prova de estoque reconciliado. |
| 28-admin-bomboniere-financeiro.png | 09, receita explicada | A `(0.19,0.28,0.74,0.23)`; B `(0.19,0.56,0.74,0.18)` | P1 principal | Bruto 585 menos 22 =563. Clube8 e cupom14. Composição por produto e descontos. Usar A como origem da equação e B só se legível. |
| 29-admin-bomboniere-leitor-pronto.png | 17, reserva | `(0.35,0.27,0.41,0.69)` | P3 reserva | Leitor aguardando, câmera desligada, sem pop-up de permissão. Não demonstra leitura em si. |
| 30-admin-bomboniere-confirmar-preparo.png | 17, conferência | `(0.35,0.29,0.41,0.47)` | P1 secundário | 2 combos e 1 bebida, itens desmarcados, confirmação desabilitada. Filme/sessão em segundo plano. |
| 30b-admin-bomboniere-itens-marcados.png | 17, preparo confirmado pelo operador | `(0.35,0.27,0.41,0.47)` | P1 secundário | Itens marcados, botão habilitado. Prova da etapa de conferência, não de entrega concluída. |
| 30c-admin-bomboniere-entrega-confirmada.png | Substituir por R07 | `(0.35,0.24,0.41,0.50)` | P1 recapturar | Apesar do nome, mostra “Validando no servidor...” com o mesmo pedido. Não comprova entrega confirmada. |

## Comunicação e relacionamento

| Arquivo | Slide e papel | Crop proposto | Importância/uso | Leitura visual e cuidados |
|---|---|---|---|---|
| 31-admin-marketing-visao-geral.png | 18, reserva | `(0.19,0.27,0.73,0.14)` | P3 reserva | Contagens e atalhos; grande vazio. Não prova desempenho de campanhas. |
| 32-admin-marketing-home.png | 05, reserva editorial | `(0.20,0.50,0.54,0.28)` | P3 reserva | Configuração de imagens e chamadas de eventos. Evitar preço promocional de teste e mostrar somente se necessário explicar publicação. |
| 33-admin-campanhas-objetivos.png | 18, reserva | `(0.20,0.56,0.47,0.27)` | P2 reserva | Objetivos simples e layout automático. Gerador Gemini visível acima: só usar crop da área inferior, nunca a tela inteira. |
| 34-admin-cupons.png | 18, reserva comercial | `(0.35,0.55,0.39,0.20)` | P3 reserva | Há inconsistência entre título “Ingressos do filme selecionado” e aplicação “Somente bomboniere”. Não destacar esse cupom como exemplo coerente; preferir recaptura futura se entrar no deck. |
| 35-admin-anuncios.png | 18, reserva | `(0.19,0.28,0.57,0.54)` | P3 reserva | Editor de anúncio sem imagem preenchida. Não usar como anúncio final publicado. |
| 36-admin-biblioteca-templates.png | 18, variedade de modelos | `(0.20,0.34,0.72,0.34)` | P1 principal | Linha com Coyote, Vingadores e Homem-Aranha. Material de referência reutilizável; selecionar 2–3 modelos. Não repetir uma biblioteca inteira de 14 cards. |
| 37-admin-template-previa.png | 18, reserva de referência | `(0.33,0.27,0.34,0.48)` | P2 reserva | Modal da prévia, texto com placeholder `{{nome}}` ainda literal. Não é e-mail recebido nem personalização final. |
| 38-admin-campanhas-editor.png | Sem uso final | `(0.20,0.47,0.46,0.34)` | P3 redundante | Repete etapa de objetivo, apesar do nome “editor”. Gemini no alto. 41 é evidência melhor de conteúdo. |
| 39-admin-campanhas-previa.png | Sem uso final | `(0.70,0.49,0.19,0.48)` | P3 redundante | Objetivo e prévia genérica, não campanha terminada. Gemini aparece acima. |
| 40-admin-campanhas-historico.png | 18, reserva | `(0.19,0.13,0.73,0.81)` | P3 reserva | Rascunhos, concluídas, paginação e rótulos de origem IA. Não há métricas de abertura/clique disponíveis. Omitir do principal para não destacar o gerador. |
| 41-email-campanha-rascunho.png | 18, conteúdo/previsão desktop | `(0.70,0.17,0.21,0.65)` | P1 secundário | E-mail no painel com nome de teste, logo, texto e CTA. Não é caixa de entrada. Evitar domínio técnico visível no formulário à esquerda. |
| 42-email-campanha-mobile.png | 18, alternativa móvel | `(0.70,0.18,0.21,0.80)` | P2 reserva | Prévia em largura móvel do mesmo e-mail. Bom para substituição de 41, não quarto quadro adicional. |
| 43-admin-clube-visao-geral.png | 19, reserva | `(0.19,0.27,0.73,0.12)` | P3 reserva | 3 planos, 1 assinatura,7 créditos e economia de testes. Não sugerir base de clientes grande nem ganho real. |
| 44-admin-clube-aparencia.png | 10, reserva | `(0.19,0.29,0.55,0.22)` | P3 reserva | Upload/identidade da página de clube. Não comprova benefícios financeiros. |
| 45-admin-clube-planos.png | 19, regras do plano | `(0.37,0.21,0.41,0.64)` | P1 principal | Família R$89,90,8 créditos,20% ingressos e 15% bomboniere. Benefícios publicados são configuração do cenário, não política prometida no contrato do deck. |
| 46-admin-clube-assinaturas.png | 19, acompanhamento | `(0.36,0.23,0.55,0.23)` | P2 secundário | Assinatura ativa e controles de gestão. Omitir economia de teste R$10,06; destacar status e ações, não valores. |
| 47-admin-clube-creditos.png | 19, trilha de uso | `(0.19,0.33,0.72,0.12)` | P2 secundário | Uma utilização consumida, data e vínculos. IDs longos pouco úteis devem ser excluídos/mascarados na futura cópia. Não comprova política completa de estorno de crédito. |

## Governança e hero shots

| Arquivo | Slide e papel | Crop proposto | Importância/uso | Leitura visual e cuidados |
|---|---|---|---|---|
| 48-admin-equipe.png | 20, papéis e permissões | `(0.35,0.57,0.39,0.41)` | P1 principal | Permissões por módulo. Excluir e-mail e senha temporária da parte superior. Não afirmar auditoria independente de segurança. |
| 49-admin-clientes.png | 11, reserva bloqueada por privacidade | `(0.19,0.28,0.17,0.62)` | P3 reserva | Lista de clientes à esquerda; formulário à direita ainda exibe nome, telefone e CPF, apesar do e-mail genérico. Não usar imagem inteira. Preferir omitir. |
| 50-admin-seguranca.png | 20, segunda etapa de acesso | `(0.19,0.27,0.73,0.20)` | P1 secundário | 2FA protegido e política da equipe. Evidência de controle de acesso, não certificação ou garantia de invulnerabilidade. |
| 51-admin-integracoes.png | 21, serviços conectados | `(0.19,0.28,0.73,0.51)` | P1 principal | Mercado Pago, Google, Wallet, TMDB e e-mail. Cortar antes da linha Gemini. Testes exibidos têm datas anteriores à captura; “operacional” é snapshot, não SLA. |
| 52-admin-logs-desempenho.png | 21, diagnóstico | `(0.19,0.21,0.74,0.49)` | P1 principal condicionado | CPU/RAM/disco e p95=1300 ms crítico; mensagem de normalidade contraditória abaixo. Só usar para explicar identificação de anomalia, ou substituir por R09 coerente. Não dizer “performance excelente”. |
| 53-simulacao-operador-aproxima-cliente.png | 01, hero de capa | Integral | P1 hero | Cliente apresenta celular ao operador. Preservar interação central. Logo/aparelho são gerados, não prova literal de UI. Texto sobre região calma superior/inferior, sem cobrir mãos/QR. |
| 54-simulacao-leitura-qr-entrada.png | 16, hero de entrada | Integral | P1 hero | Celulares à direita, operador à esquerda. Título pode usar faixa escura superior esquerda. A interface real precisa de 25b/25c como apoio. |
| 55-simulacao-leitura-qr-bomboniere.png | 17, hero de retirada | Integral | P1 hero | Telefones à esquerda/centro, produtos à direita. Título no alto à direita com placa discreta. Não recortar fora o produto; 30/30b comprovam UI real. |

## Capturas ausentes e nomes reservados

### E-mails adicionados durante a revisão

| Arquivo | Slide e papel | Crop proposto | Importância/uso | Leitura visual e cuidados |
|---|---|---|---|---|
| email_1.png | 11, confirmação no pós-compra; alias E1 | `(0.185,0.015,0.69,0.615)` | P1 secundário | 903 x 729. Logo, “Pagamento aprovado”, “Ingressos confirmados”, filme/data/assento. Há código completo abaixo do crop e indicação de pedido sem extras. Excluir código da versão pública. Isolada, mostra o corpo de um e-mail; a procedência Gmail é corroborada por E2. Não é campanha promocional. |
| email_2.png | 11, evidência de anexo nas notas; alias E2 | `(0.025,0.75,0.155,0.22)` | P2 reserva | 1582 x 706. Parte inferior do mesmo e-mail, interface Gmail e um PDF anexado. Código completo no corpo; não usar imagem inteira. A miniatura comprova presença de anexo, não legibilidade/validade de todo o PDF. Sem bomboniere nesse pedido. |

E1 entra no slide 11 com a conta; E2 fica como evidência suplementar nas notas, sem criar quarto quadro no slide 12. Essas imagens não substituem R04/R05 de checkout nem R06 de ingresso com produtos, e não dispensam R08 caso se queira mostrar uma campanha de marketing recebida.

### Novos estados necessários

Estes arquivos NÃO existem ainda. Só capturar em etapa futura expressamente autorizada, sem gerar cobranças reais, enviar campanhas ou liberar ingresso de cliente. Guardar novas cópias em uma subpasta `complementares/` do banco, sem sobrescrever os 61 arquivos existentes.

| ID e nome reservado | Uso | Estado que precisa ficar visível |
|---|---|---|
| R01-checkout-ingressos-autenticado.png | 06 | Conta de demonstração autenticada, filme/sessão e tipos/quantidades escolhidos. |
| R02-mapa-poltronas.png | 07 | Mapa inteiro da sala, fileira mais longa, numeração por poltrona, seleção e legenda. |
| R03-checkout-extras.png | 09, alternativa | Produtos, quantidades e resumo antes do pagamento. Não indispensável ao slide financeiro se 26/28 forem usados. |
| R04-checkout-pagamento.png | 08 | Pix ou cartão realmente carregado, resumo com ingressos/bomboniere e benefícios coerentes. QR inativo ou expurgado na cópia de divulgação. |
| R05-checkout-confirmacao.png | 08 | Estado aprovado de pedido de demonstração, acesso aos ingressos. Não confundir com Pix gerado. |
| R06-ingresso-com-bomboniere.png | 12 | Ingresso do cliente com produtos vinculados, quantidades e ação de retirada. |
| R07-bomboniere-entrega-concluida.png | 17 | Estado estável de sucesso após resposta do servidor, não “Validando...”. |
| R08-email-recebido.png | 18, opcional | E-mail de teste realmente recebido, logo/imagens/CTA carregados, sem dados de terceiros. Não necessário se o slide permanecer rotulado “Prévia”. |
| R09-monitoramento-coerente.png | 21, opcional | Métricas e mensagem de status coerentes. Pode mostrar alerta real, não precisa estar tudo verde. |

R01/R02/R04/R05 são bloqueios para a versão final completa do fluxo de compra. R06/R07 são necessários para comprovar os estados finais descritos. R03/R08/R09 são melhorias condicionais. Não inventar telas, nem extrair telas antigas de teste e apresentá-las como estado atual. Sem novas capturas, seguir as alternativas narrativas explícitas do plano e informar a redução de evidência.
