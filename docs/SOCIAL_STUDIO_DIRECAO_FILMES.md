# Direção cinematográfica para filmes individuais

Revisão de 24/09/2026. Evolução do motor atual, sem recriar o Studio ou mudar a programação editorial, a bomboniere, o clube ou outros cinemas.

## Nove composições

- Pôster lateral / split cinematográfico.
- Pôster editorial.
- Pôster + atmosfera.
- Poster hero.
- Full bleed cinematográfico.
- Foco no personagem.
- Editorial assimétrico.
- Fundo imersivo.
- Estreia em destaque, com imagem expandida e data dominante, seguindo a direção das referências fornecidas.

O modo automático considera gênero, material disponível, áreas de menor complexidade e um identificador estável da campanha. A análise usa luminância e densidade de bordas: estima foco visual e espaço para texto, mas **não reconhece rostos nem a direção real do olhar**. Quando o hero usa uma cena do filme, o enquadramento deriva da análise dessa cena, não do pôster.

Pôster e ambiente têm enquadramentos independentes. As composições criativas recuperam as camadas do motor cinematográfico anterior: lavagem de cor, textura atmosférica, luz local e vinheta. Preservam cor e atmosfera do filme, usam máscaras nas bordas e gradientes contínuos para legibilidade. Não aplicam retângulos de fundo por texto. Sombras são reservadas aos pôsteres flutuantes, não às cenas full bleed.

Full bleed e foco usam backdrop quando disponível; na ausência dele passam para pôster + atmosfera. Estreia em destaque permite enquadramento ampliado do pôster, preservando a zona principal sem texto sobre ela. O controle manual permanece disponível. A referência visual não é copiada como uma arte final fixa.

## Informação e segurança

Data e horários vêm do catálogo. A sessão seguinte apresenta seus horários completos, sem reduzir a informação a “SESSÃO + data”. Estreia e pré-venda conservam o significado da data; quando há sessões, elas são comunicadas separadamente. A data dominante não inventa uma estreia local.

CTA e endereço são um grupo único, sem repetição. Logo discreta, com largura limitada e posição segura. A nova camada usa a marca original configurada por padrão; a escolha de assinatura existente é preservada.

A validação de exportação continua medindo contraste no raster, margens, texto cortado, colisões, imagens e assinatura. Nas composições criativas, um manifesto verifica a presença do título e preserva os dados de data e horários no editor. A chamada do título permanece editável. Uma composição reprovada tenta uma alternativa segura, sem publicar a versão inválida.

## Evidências

`tests/social-studio-movie-direction.test.mjs` cobre as nove famílias, os três formatos e quatro tipos de campanha (108 combinações), dados da sessão, contraste, seleção contextual e rejeição de alterações incoerentes.

`scripts/verify-social-studio-movie-direction.mjs` gera exemplos com Cara-de-Barro, Toy Story 5, Resident Evil e Minha Melhor Amiga. São 40 artes comparativas e um exemplo de estreia em 1080×1350. Os cartazes são do catálogo; os horários são **fixtures de teste**, sem gravação no banco ou publicação. Não divulgar esses arquivos como agenda comercial.

Arquivos: `artifacts/studio-movie-direction`. O relatório registra família resolvida e qualidade. Os tratamentos editoriais anteriores permanecem como escolhas e alternativas de segurança.

Limitação: sem segmentação semântica de personagens, o enquadramento automático é aproximado. A prévia e o editor continuam importantes para aprovar material cuja imagem tenha muitos personagens ou texto incorporado.

## Verificação desta revisão

- Revisão final: 162 de 162 testes Social Studio aprovados.
- A composição de produto `dark-snack` ganhou área suficiente para o packshot. Textos complementares que não cabem com tamanho legível passam para a legenda; o erro restante identifica o campo problemático.
- Tipagem (`npm run lint`) aprovada.
- Workspace verificado em desktop, tablet e mobile.
- 40 variações raster aprovadas, mais a estreia de referência; títulos longos conferidos em 54 combinações de formato, campanha e direção; programação validada em 15 combinações de quantidade/formato e exemplos de estilos.
- Cinco produtos reais da bomboniere foram conferidos nas quatro direções e nos três formatos (60 artes aprovadas).
- Os exemplos locais usam horários de teste e não devem ser publicados como programação real.
