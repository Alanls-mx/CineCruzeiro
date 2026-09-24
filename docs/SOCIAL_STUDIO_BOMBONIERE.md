# Direcao criativa da bomboniere

Escopo: Cine Cruzeiro. Os motores de filmes, clube, programacao e e-mails nao foram substituidos.

## Fluxo

`cadastro + objetivo + formato -> perfil do produto -> familia -> cena em camadas -> contraste raster -> validacao -> previa/exportacao`

- Produto ou combo e Oferta da bomboniere compartilham direcao e validacao.
- Tres estruturas principais: Produto + preco, Produto lateral e Hero product.
- Quatro tratamentos visuais independentes: Comercial vibrante, Produto cinematografico, Clean premium e Dark food / snack.
- Categoria automatica pelo nome/categoria do cadastro, com substituicao explicita no painel. Pipoca, bebida, chocolate, combo individual, dupla, familia e produto generico.
- Objetivos: vender, destacar preco, apresentar, despertar vontade, reforcar a marca, divulgar oferta ou novidade confirmada pelo operador.
- Proporcao real do recorte alfa determina o tamanho do produto. Imagens horizontais recebem composicao propria. Square, feed e Story nao sao simples redimensionamentos.
- Fundos personalizados continuam disponiveis. Catalogos passam a compor uma superficie continua na bomboniere, sem tres faixas verticais arbitrarias.

## Conteudo e marca

O preco vem do cadastro e moeda/valor sao um unico elemento. A copy considera categoria, objetivo, descricao cadastrada, filme vinculado e briefing; nao inventa quantidades, descontos, estoque ou condicoes comerciais. Detalhes extensos pertencem a legenda.

A indicacao "A embalagem ja mostra a marca do cinema" reduz a assinatura adicional. Tambem e aceito `containsCinemaBranding` no produto, quando fornecido pelo contexto. Nao existe reconhecimento semantico automatico de logotipos: inferir branding apenas por cor seria inseguro.

## Barreiras de qualidade

- Contraste minimo 4,5:1, amostrado sobre a pilha raster real, inclusive fundos e gradientes personalizados.
- Verificacao de areas seguras, tamanhos minimos, texto excedente, colisao entre textos/produto/marca, texto encoberto por camada posterior e chamada junto do destino.
- Produto inteiro, escala minima, arquivo presente, nome identificavel e preco fiel ao cadastro.
- Ajuste automatico de cor/contraste e reposicionamento da assinatura em colisao. Nova tentativa limitada as outras duas estruturas quando necessario.
- Se nenhuma direcao passar, resposta `422 CONCESSION_QUALITY`, com motivos e orientacao. Variacoes reprovadas nao sao exibidas.
- Exportacao manual e Remotion aplicam a mesma barreira. Grupos essenciais rotacionados ou transparentes exigem ajuste individual antes da exportacao.
- A heuristica nao substitui aprovacao humana: nao reconhece rostos, qualidade gastronomica, promessas comerciais ou direitos das imagens. Historico previamente exportado nao e apagado nem alterado.

Produto, sombras, atmosfera, titulo, preco, acao e marca continuam como camadas separadas para editor e Remotion. O gate nao achata a cena.

## Verificacao

`node --test --test-isolation=none tests/social-studio*.test.mjs`

`node scripts/verify-social-studio-concessions.mjs`

O segundo comando le apenas o catalogo publico e cria 60 artes locais: chocolate, refrigerante, pipoca e dois combos, nas quatro familias e tres formatos. As grades e o relatorio ficam em `artifacts/studio-bomboniere`. Nao publica posts nem altera dados de clientes.

`node scripts/verify-social-studio-workspace.mjs` verifica controles, erros e navegacao em desktop, tablet e celular, com API simulada.
