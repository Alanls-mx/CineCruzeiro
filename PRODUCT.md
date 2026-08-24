# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clientes do Cine Cruzeiro compram ingressos, extras e assinaturas pelo celular. Proprietários, gerentes e operadores usam o painel administrativo em desktop, tablet e celular para operar programação, bilheteria, bomboniere, marketing, clube, usuários e integrações.

## Product Purpose

O Cine Cruzeiro combina a experiência de um cinema de rua tradicional com compra digital, operação de bilheteria, pagamentos, tickets com QR Code, catálogo, bomboniere e clube recorrente. O sucesso significa reduzir atrito para o cliente e dar à equipe uma visão confiável e rápida da operação diária.

## Positioning

Um sistema integrado para um cinema de bairro de sala única, preservando preço acessível, proximidade cultural e operação direta sem a complexidade de uma rede de shopping.

## Operating Context

O painel é usado durante cadastro e publicação de filmes, preparação de sessões, atendimento de balcão, validação de ingressos, atualização de estoque e acompanhamento financeiro. A operação precisa ser rápida, legível e resistente a erros em telas de tamanhos variados.

## Capabilities and Constraints

- Preservar autenticação, PostgreSQL, pagamentos Mercado Pago, estoque, capacidade, tickets e QR Code.
- Preservar rotas, permissões, formulários, ações e regras de negócio existentes.
- O painel deve manter boa densidade de informação e não pode depender de rolagem horizontal para ações comuns.
- Uploads de imagens são locais e persistentes; filmes também podem usar mídia externa via TMDB.
- O frontend público permanece mobile-first e o painel deve responder bem em desktop, tablet e celular.

## Brand Commitments

Nome Cine Cruzeiro, logotipo oficial, fundo navy/azul escuro e amarelo/dourado como destaque restrito. A voz é direta, próxima e profissional, em pt-BR.

## Evidence on Hand

O repositório contém a aplicação pública em Next.js, o painel administrativo em HTML/CSS/JavaScript, backend Node.js, banco PostgreSQL, assets de marca e fluxos reais de operação.

## Product Principles

- Operação rápida e sem ambiguidade.
- Dados reais e estados confiáveis.
- Tecnologia que reforça, sem apagar, a identidade do cinema de rua.
- Consistência entre painel, checkout e conta do cliente.
- Segurança e auditabilidade em ações financeiras e de ingresso.

