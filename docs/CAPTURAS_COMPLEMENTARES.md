# Capturas complementares da produção

## Objetivo

Completar o banco visual da apresentação com as etapas autenticadas que não aparecem nas capturas atuais. Todas as imagens devem vir do site em produção, usar registros pertencentes à conta de demonstração e preservar a interface real do Cine Cruzeiro.

O coletor está em `scripts/capture-production-complements.mjs`. A saída é gravada diretamente em `apresentacao-cine-cruzeiro-demonstracao-4k-v2`, sem sobrescrever as imagens numeradas existentes.

## Regras de execução

- Não criar cobrança Pix ou cartão apenas para produzir uma captura.
- Reutilizar um pedido aprovado da própria conta para a tela de confirmação.
- Não validar entrada nem entregar bomboniere de um cliente real.
- Usar um registro já concluído para demonstrar a entrega.
- Remover visualmente nome, e-mail, CPF, telefone e código do ingresso.
- Exigir resolução mínima de 3840 x 2160 nas capturas de tela.
- Renderizar os PDFs diretamente dos endpoints autenticados, sem redesenhar o documento.
- Redigir QR Codes, códigos e referências capazes de validar ou localizar um pedido; a tarja faz parte da cópia de divulgação, não do PDF original.
- Interromper a execução quando faltar um estado compatível, em vez de substituir a tela por uma simulação.

## Imagens previstas

| Arquivo | Evidência | Uso recomendado |
|---|---|---|
| `R01-checkout-ingressos-autenticado.png` | Tipos e quantidade de ingressos | Jornada de compra |
| `R02-mapa-poltronas.png` | Mapa, legenda, numeração e seleção | Jornada de compra |
| `R03-checkout-extras.png` | Produtos e quantidades de bomboniere | Venda adicional |
| `R04-checkout-pagamento-pix.png` | Área Pix sem gerar cobrança | Pagamentos |
| `R04b-checkout-pagamento-cartao.png` | Brick de cartão do Mercado Pago carregado | Pagamentos |
| `R04c-checkout-clube-creditos.png` | Cupom, benefícios e créditos do Clube | Clube e conciliação |
| `R05-checkout-confirmacao.png` | Pedido existente aprovado | Conclusão da compra |
| `R06-ingresso-com-bomboniere.png` | Ingresso ativo com produtos vinculados | Pós-compra |
| `R07-bomboniere-entrega-concluida.png` | Entrega já concluída no servidor | Operação da bomboniere |
| `R10-pdf-ingresso-pagina-1.png` | PDF real com QR Code | Documento do cliente |
| `R10b-pdf-ingresso-pagina-2.png` | Detalhes e bomboniere do PDF | Documento do cliente |
| `R11-pdf-pdv-pedido.png` | Comprovante térmico real | Bilheteria e PDV |

## Documentos existentes

O ingresso digital possui PDF de duas páginas. A primeira concentra filme, sessão, sala, poltrona e QR Code. A segunda registra código, pedido, tipo, status e os itens de bomboniere vinculados.

O painel também gera um comprovante térmico para impressão no PDV. O próprio documento informa que não é fiscal. O módulo fiscal legado foi retirado e não deve ser representado na apresentação como NFC-e, nota fiscal ou tela operacional disponível.

## Dados exigidos pelo coletor

O coletor recebe pela entrada padrão um JSON temporário, nunca gravado em disco, contendo:

- segredo de sessão do ambiente;
- registro da conta de demonstração;
- registro do administrador;
- ID de uma sessão disponível para checkout, opcional;
- ID de pedido aprovado pertencente à conta;
- ID de ingresso com bomboniere;
- código de uma entrega de bomboniere já concluída.

Se qualquer requisito não estiver disponível, a execução termina com um código de erro específico. Isso impede que login, estado vazio ou dado incompatível seja registrado como se fosse a funcionalidade solicitada.

## Integração na apresentação

1. Substituir as capturas 05 e 06 atuais por R01 e R02 no fluxo de compra.
2. Usar R03 como apoio da etapa de bomboniere.
3. Usar R04, R04b e R04c para explicar meios de pagamento e benefícios sem mostrar uma cobrança real.
4. Usar R05 como encerramento da jornada de compra.
5. Usar R06 junto da área Minha Conta para demonstrar a associação entre ingresso e bomboniere.
6. Usar R07 como evidência do estado final da operação, depois das telas de conferência já existentes.
7. Usar R10 e R10b nas notas ou no slide de pós-compra.
8. Usar R11 na parte de bilheteria, sempre com a legenda “Comprovante não fiscal para PDV”.

## Validação final

Depois da coleta, conferir o arquivo `COMPLEMENTOS.md` gerado na pasta de imagens. Ele registra resolução, URL de origem e função exata de cada captura. As imagens somente entram no PPTX depois dessa conferência e da revisão visual de QR Codes e dados pessoais.
