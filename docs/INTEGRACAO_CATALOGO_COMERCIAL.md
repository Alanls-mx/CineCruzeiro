# Catálogo Comercial Externo

## Objetivo

O sistema disponibiliza um feed JSON protegido para uma aplicação parceira consultar apenas informações comerciais publicáveis. Ele não expõe clientes, pedidos, pagamentos, estoque ou dados administrativos.

## Configuração

1. Acesse `Painel administrativo > Integrações > Catálogo comercial externo`.
2. Gere um token seguro, salve a configuração e ative a integração.
3. Opcionalmente, informe as origens da aplicação parceira separadas por vírgula para permitir consumo direto no navegador.

O token é criptografado no servidor e não é exibido novamente após ser salvo. Gerar outro token invalida o anterior.

## Endpoint

`GET /api/commercial/catalog`

Em produção do Cine Cruzeiro, a URL é:

`https://lumixengine.com/projects/cinecruzeiro/api/commercial/catalog`

Autenticação recomendada:

```http
Authorization: Bearer SEU_TOKEN
```

Para integrações que só aceitam uma URL, também é aceito:

```text
https://lumixengine.com/projects/cinecruzeiro/api/commercial/catalog?token=SEU_TOKEN
```

Não use o token em links públicos, páginas indexadas ou código exposto no navegador. Para uma aplicação web parceira, prefira o header `Authorization` e cadastre sua origem permitida no painel.

## Dados entregues

- `movies`: filmes publicados, artes, classificação, duração e sessões disponíveis por filme.
- `availableSessions`: sessões abertas para compra neste momento.
- `programming`: programação futura, incluindo sessões cuja venda ainda será aberta.
- `concessions`: itens ativos da bomboniere, preços e imagens.
- `promotions`: promoções vigentes sem código de cupom.
- `coupons`: cupons vigentes com código, regra de desconto e validade.
- `dates`: dias da programação e contagem de sessões.

O feed inclui `generatedAt`, versão e fuso horário `America/Sao_Paulo`. Imagens locais são retornadas com URL absoluta para a aplicação externa poder exibi-las sem adaptar caminhos.

## Operação

O endpoint tem limite de 120 consultas por IP a cada cinco minutos e cache configurável de 0 a 300 segundos. Respostas sem token válido retornam `401`; uma integração desativada ou ainda não configurada retorna `404`.
