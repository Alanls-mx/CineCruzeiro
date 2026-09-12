# Sistema visual da apresentação Cine Cruzeiro

## Escopo, fontes e método

Planejamento fechado em 12/09/2026. Não é um PPTX implementado. Ler junto de `PLANO_APRESENTACAO.md`, `MAPA_IMAGENS.md` e `CHECKLIST_REVISAO.md` nesta pasta.

Referência: `C:/Users/alanl/Documents/LumixEngineCineCruzeiro.pptx`. Foram inspecionados visualmente os 16 slides, exportados em modo somente leitura pelo PowerPoint. A estrutura foi conferida por inspeção de shapes e XML do pacote PPTX. Os arquivos temporários de análise estão em `C:/Users/alanl/Downloads/Cine Cruzeiro/.codex-tmp/presentation-analysis/`, mas não são necessários para entender este planejamento.

Banco atual: `C:/Users/alanl/Downloads/Cine Cruzeiro/apresentacao-cine-cruzeiro-demonstracao-4k-v2/`. As 59 imagens numeradas foram vistas em pranchas de contato, com revisão ampliada de regiões críticas. Duas imagens adicionais de e-mail foram vistas individualmente, totalizando 61. Coordenadas de recorte propostas são aproximadas e precisam de ajuste fino na montagem; não constituem uma validação de pixels de slides ainda inexistentes.

## Auditoria da referência

### Formato e identidade

- 16:9, 960 x 540 pontos, equivalente a 13,333 x 7,5 polegadas.
- Identidade dark, fundos azulados quase pretos, branco frio, azul royal e amarelo. O amarelo marca decisões, etiquetas e pequenos acentos; não ocupa grandes áreas de fundo.
- Paleta encontrada no XML: `#07101D`, `#060B14`, `#08111E`, `#0A1320` nos fundos; `#101B2D` e `#101C2F` em superfícies; `#26364C` em contornos; `#F7F9FC` e `#FFFFFF` em títulos; `#97A8BE` em apoio; `#2E63E7` e `#63B7FF` em acentos; `#FFC000` e `#FFC81A` nos amarelos.
- A frequência de cores no XML conta elementos, não área de tela. Não a interpretar como proporção visual.
- Arial domina os textos editáveis. Títulos internos geralmente em Arial Bold 28 pt; subtítulos em 11,2 pt; etiquetas em 8,2 pt; pequenos textos entre 7,2 e 9,6 pt. Estes últimos são insuficientes para leitura presencial.

### Grid, elementos e tratamento

- Margem esquerda principal entre 41,76 e 51,84 pt. Cabeçalho recorrente: kicker em `(41,76; 56,16)`, título em `(41,76; 77,76)` e subtítulo em `(41,76; 122,40)`.
- O título ocupa aproximadamente 691 x 40 pt, e o subtítulo 648 x 27 pt. A proximidade entre essas caixas contribui para títulos/subtítulos apertados nos slides mais densos.
- Rodapé recorrente próximo a y=505,44, com divisor fino, assinatura e número. Há numeração duplicada em vários slides: etiqueta superior direita e número inferior.
- LumixEngine aparece em cabeçalho e/ou rodapé; Cine Cruzeiro aparece em oval azul, frequentemente no canto inferior direito. A repetição compete com o conteúdo em slides cheios.
- Screenshots em molduras de fundo escuro, bordas finas e cantos arredondados. Foram encontrados 104 `roundRect`, além de 330 retângulos. Não existe um único raio universal confiável: depende do tamanho e do ajuste da forma.
- Contornos mais comuns: 1 pt, 0,7 pt e 0,8 pt; também 0,55 pt. Há 39 efeitos de sombra externa no XML. Visualmente são discretos, não grandes halos.
- Imagens grandes, filtrando shapes de imagem com largura >180 pt e altura >80 pt: 37 ocorrências, média aproximada de 360,6 x 210,2 pt, incluindo a capa. Isso não representa exclusivamente screenshots: inclui imagens de fundo. Muitas telas secundárias têm apenas 222–282 pt de largura; as principais, 500–606 pt.
- Não há mockup físico relevante de celular/notebook. As capturas funcionam como janelas enquadradas. Diagramas usam caixas, setas, linhas e colunas numeradas; a organização ajuda, mas caixas dentro de caixas aumentam a densidade.
- Espaçamento é razoavelmente consistente entre grandes blocos, porém comprimido dentro das montagens. O número de telas por slide frequentemente exige textos pequenos demais.

### Leitura dos 16 slides

| Slide antigo | Avaliação visual | Decisão para a nova versão |
|---|---|---|
| 01, capa | Fundo do site escurecido, marca visível, caráter cinematográfico. Muitas assinaturas e blocos pequenos. | Manter atmosfera e marca; substituir excesso de elementos por hero 53 e título literal Cine Cruzeiro. |
| 02, ecossistema | Três painéis textuais e quatro telas dividem a atenção. | Separar visão estratégica e jornada em dois diagramas simples. |
| 03, experiência pública | Home dominante com dois detalhes é uma das composições mais fortes. | Manter a hierarquia; ampliar apenas um detalhe relevante. |
| 04, programação | Tela grande e coluna explicativa conduzem bem a leitura. | Reutilizar o princípio, com texto maior e recorte mais próximo da sessão. |
| 05, checkout | Cinco telas estreitas comprimem todo o processo. | Desdobrar filme, assentos e pagamento. Não repetir a montagem de cinco telas. |
| 06, pós-compra | Quatro telas e legendas competem pelo mesmo espaço. | Separar conta de ingresso e transferência. |
| 07, clube | Tema comercial identificável, mas depende de detalhes pequenos. | Usar um plano legível e uma sequência curta, sem página longa inteira. |
| 08, dashboard | Tela principal dá foco, apoios ajudam. Valores de teste antigos não servem ao novo case. | Manter prova financeira com dados demonstrativos conciliados e rótulo explícito. |
| 09, catálogo | Três telas completas com o mesmo peso. | Uma tela principal e dois recortes de configuração. |
| 10, bilheteria | Quatro telas, cabeçalho denso e aproximação excessiva de textos. | Venda como protagonista; pedidos como evidência secundária. |
| 11, validação | Explica câmera, mas não mostra bem a operação humana. | Hero 54 e conferência real da interface em faixa própria. |
| 12, bomboniere | Relação checkout/operação é clara, mas as telas ficam reduzidas. | Separar oportunidade comercial de entrega presencial. |
| 13, marketing | Módulos agrupados, subtítulo muito próximo do título. | Mostrar templates e prévia como assunto principal. |
| 14, integrações | Abrangência aparece, porém falta escala para ler estados. | Recorte seletivo, excluindo Gemini e evitando promessas de disponibilidade. |
| 15, arquitetura | Fluxo compreensível, mas demasiadas caixas e rótulos minúsculos. | Diagramas nativos editáveis, sem caixas aninhadas. |
| 16, encerramento | Texto sobreposto e montagem cortada prejudicam o fechamento. | Uma frase de valor, três resultados funcionais e assinatura; sem colagem. |

Fortes: 03, 04, 08 e a relação conceitual de 12. Fracos: densidade de 02/05/06/09/10 e sobreposição de 16. Preservar identidade e evidência real, não copiar a quantidade de molduras.

## Sistema proposto

### Paleta

| Token | Cor | Aplicação |
|---|---|---|
| Fundo | `#060B14` | Base comum e áreas de respiro. |
| Superfície | `#101B2D` | Apenas faixa de evidência ou ferramenta realmente enquadrada. |
| Título | `#F7F9FC` | Texto principal. |
| Apoio | `#B8C5D6` | Mais claro que o apoio antigo para projeção. |
| Acento | `#FFC81A` | Linha curta, palavra-chave, progressão, número financeiro escolhido. |
| Azul | `#2E63E7` | Diagramas secundários e correspondência com produto. |
| Ciano | `#63B7FF` | Relações e informação, uso pontual. |
| Divisor | `#26364C` | Linhas sutis quando necessárias. |

Manter as cores originais dentro das screenshots. Não recolorir estados, cupons, preços ou selos para adequá-los ao deck. Verde e vermelho só aparecem por semântica da interface, nunca como decoração. O fundo dark é requisito deste case, não justificativa para apagar contraste.

### Tipografia

- Arial, por continuidade e portabilidade. Arial Bold nos títulos e números. Não depender de fonte externa nem substituir a marca LumixEngine por texto digitado.
- Capa: 48 pt, até duas linhas. Encerramento: 40 pt. Títulos internos: 30–34 pt, até duas linhas. Subtítulos: 18 pt, máximo duas linhas.
- Corpo e labels relevantes: 18 pt. Callouts: 16–18 pt. Número em destaque: 36–44 pt. Kicker/rodapé: 10–11 pt, nunca contendo a ideia principal.
- Entrelinha de 1,08–1,15 em títulos e 1,2 em apoio. Espaçamento entre caracteres zero. Sem caps longos em parágrafos.
- Limite editorial: título até 9 palavras; subtítulo até 24 palavras; no máximo três callouts de até 7 palavras. Narrativa complementar vai nas notas, não na tela.
- Se um texto não couber: encurtar, reposicionar ou aumentar área antes de reduzir corpo. Não descer abaixo de 16 pt em informação que precisa ser lida pela plateia.

### Coordenadas e grid

Todas as posições do plano usam pontos sobre 960 x 540, formato `(x, y, largura, altura)`.

- Margens regulares: 48 pt laterais, 32 pt superior, 28 pt inferior.
- Grid: 12 colunas de 61 pt, 12 pt de intervalo, total 864 pt. Elementos podem ocupar múltiplas colunas.
- Escala de espaçamento: 6, 12, 18, 24, 36 e 48 pt.
- Cabeçalho regular: kicker `(48,28,700,14)`, título `(48,50,864,78)`, subtítulo `(48,132,864,46)` quando usado. Conteúdo `(48,190,864,288)`; rodapé y=511.
- Título de uma linha permite subir a mídia para y=148 e usar até 336 pt de altura. O plano de cada slide indica a exceção.
- Não colocar título e corpo dentro de um card. Seções são abertas e alinhadas ao grid.
- Rodapé único: assinatura LumixEngine à esquerda em largura até 90 pt; número em `(880,511,32,14)`. Sem segundo número superior, sem repetir os dois logos em todos os cantos.

### Famílias de composição

| Código | Composição | Uso |
|---|---|---|
| H | Hero full-bleed, título sobre região calma da própria imagem; faixa inferior de até 150 pt quando há evidência UI. | 01, 16, 17. |
| E | Editorial aberto, texto principal grande e poucas palavras ou diagrama. | 02, 03, 04, 22. |
| D | Uma screenshot dominante de 600–700 pt e pequena coluna de explicação. | 05, 06, 07, 11, 15. |
| F | Prova financeira: números editáveis, equação e um recorte de origem. | 09, 13. |
| P | Duas evidências complementares com hierarquia desigual, não dois sites inteiros. | 08, 10, 12, 14, 18, 19, 20, 21. |

Mesmo quando há família repetida, alternar eixo e proporção. Não mais de dois slides consecutivos com a mesma silhueta. O hero 53 abre o caso; 54 e 55 formam um díptico intencional de operação, com posições de título diferentes.

### Screenshots, fotos e recortes

- Recortar a fonte sem alterar conteúdo. Usar `MAPA_IMAGENS.md` para região-alvo. Depois aplicar `contain` dentro da caixa de destino, preservando proporção. Nunca esticar uma tela para preencher uma caixa.
- Uma tela principal, no máximo dois detalhes na maior parte do deck. Uma terceira evidência só se for uma faixa simples, não uma quarta tela completa.
- Não reduzir páginas de 4–5 mil pixels de altura a uma miniatura. Cortar navegação, rodapé, vazios e áreas sem relação com o benefício.
- Preferir imagem sem moldura extra. Se separação for necessária: raio 4 pt e contorno 0,6 pt `#26364C`. Sem cards dentro de cards, bordas amarelas perimetrais ou glow.
- Sem sombra por padrão. Exceção: detalhe flutuante, sombra preta até 15% de opacidade, blur 6 pt, deslocamento 2 pt. Não aplicar à foto de fundo.
- Overlays de hero são placas translúcidas ou escurecimento localizado sob texto, nunca filtros cobrindo celulares e logos. Fotos continuam nítidas. Sem orbes, bokeh adicional, vetores decorativos ou novos cenários gerados.
- Fotos 53/54/55: contexto ilustrativo gerado, não fotografias documentais. Preservar pessoas, mãos e aparelhos. Não tratar telas sintetizadas como reprodução pixel a pixel do site. Usar screenshots reais para provar estados.
- As três fotos têm arquivo 4K, mas a procedência inclui ampliação de imagens menores. Não prometer detalhe óptico 4K; avaliar a 100% na exportação futura.
- Não inserir smartphone genérico ao redor de screenshot desktop. A imagem 42 é prévia móvel dentro do painel, não uma captura de aparelho.
- Máscaras de privacidade devem ficar em uma cópia de apresentação, nunca na fonte. Preferir crop que exclua o dado; se necessário, cobertura opaca ou desfoque já validado. Não redesenhar números financeiros nem estados do sistema.

### Diagramas, ícones e marcas

- Diagramas nativos editáveis. Linhas 1,5 pt, setas curtas e no máximo seis etapas. Rótulos por benefício, não nomes de endpoint, tabela ou API.
- Sem caixas aninhadas. Usar linhas de conexão e títulos soltos. Ícones apenas quando ajudam identificação, todos da mesma família Lucide, sem emojis. Nenhum ícone é obrigatório.
- Cine Cruzeiro: usar o ativo original, nunca recriar a oval. Fontes locais disponíveis: `C:/Users/alanl/Downloads/Cine Cruzeiro/public/images/logo-display.webp` (320 x 183) e `logo-header-compact.webp` (112 x 64). Preferir o primeiro para pequenas aplicações. Para ampliação, buscar o original de maior resolução incorporado ao PPTX e inspecioná-lo antes de usar.
- LumixEngine: reaproveitar o original incorporado ao PPTX. No slide 1, as relações apontam a `ppt/media/image2.png` e `image3.png`, além do fundo `image1.jpg`. Confirmar visualmente qual contém cada logo durante a extração futura; não assumir identidade só pelo índice. Manter transparência, proporção e área de respiro de pelo menos metade da altura da marca.
- Capa e encerramento: assinatura LumixEngine com destaque suficiente para atribuir o projeto. Nos slides internos, assinatura discreta. Não usar o logo da foto como substituto do logo oficial do deck.

## Evidência e linguagem

Benefícios expressam intenção/capacidade, não resultados medidos. Usar “oportunidade de ampliar a compra”, “visibilidade por produto” e “conferência antes da liberação”. Não afirmar aumento percentual de receita, redução de filas, segurança absoluta ou disponibilidade garantida.

Rótulos obrigatórios: “Dados de demonstração” nas provas financeiras; “Simulação ilustrativa” nas três cenas geradas; “Prévia de e-mail” quando a origem é o painel. Não escrever “e-mail recebido” a partir de 37/41/42. Os arquivos adicionais email_1/email_2 mostram mensagem transacional e anexo no Gmail, não uma campanha promocional recebida; podem documentar o pós-compra com códigos ocultados.

O slide de monitoramento deve mostrar capacidade de identificar anomalias. A imagem 52 mostra p95 crítico de 1300 ms e uma mensagem inferior contraditória de normalidade. Não aproveitar esse estado como prova de alta performance nem esconder a contradição para afirmar saúde do sistema.
