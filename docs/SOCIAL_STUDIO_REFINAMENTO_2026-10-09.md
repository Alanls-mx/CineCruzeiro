# Refinamento das composições de filmes

As quatro composições do Studio continuam disponíveis. O ajuste concentra a decisão na imagem e no conteúdo da campanha.

- **Editorial integrado:** pôster centralizado e preservado, transição clara derivada da imagem, data e horário separados e assinatura no rodapé direito. O título adicional não ocupa mais uma coluna lateral quando o pôster oficial é mantido inteiro.
- **Fundo imersivo:** libera a área de título redundante para os dados da sessão. O fundo e o contraste usam uma cor da obra, incluindo a cor secundária contrastante quando disponível.
- **Estreia em destaque:** mantém a hierarquia de data e chamada; não repete o status como rótulo e destaque simultâneos.
- **Campanha integrada:** preserva o tratamento existente e compartilha a regra de título embutido com as outras composições.

## Regras de conteúdo

O gerador compara o conteúdo dos campos ignorando caixa, acentos, espaços e pontuação. Entre campos iguais, preserva o papel mais importante: informação principal, horário, título, CTA e destino precedem rótulos auxiliares. Uma assinatura gráfica substitui a repetição do nome do cinema. O contrato usado na exportação registra apenas os campos mantidos.

A regra anterior de datas continua ativa: estreia e sessão no mesmo dia não repetem a data; datas distintas continuam visíveis. O horário permanece separado no Editorial integrado e na Campanha integrada.

## Análise visual e contraste

No modo automático, as cores dos filmes são extraídas sem mistura com a identidade institucional. A paleta mantém até quatro cores observadas, a luminosidade média e uma cor secundária contrastante. As escolhas explícitas de paleta continuam disponíveis.

A escolha automática considera formato, luminosidade e complexidade da imagem antes do gênero. Story e estreia favorecem Spotlight; Square favorece Imersivo. A seleção manual permanece prioritária.

O reparo de contraste testa a cor do texto antes de aplicar uma máscara suave e localizada, tingida com uma cor da imagem. Não adiciona a antiga faixa preta cobrindo toda a metade inferior. A leitura é conferida no raster final com o mesmo limite de contraste existente.

## Limites da análise

Não há OCR nem reconhecimento de rostos. A estimativa de áreas importantes usa densidade de bordas e luminosidade. As composições que mantêm a imagem inteira protegem toda a área do pôster contra sobreposição de texto.

A presença de título usa os metadados fornecidos pelo operador. Na ausência deles, o pôster oficial cadastrado é tratado como material com título, uma convenção já usada pela Campanha integrada. Imagens alternativas não herdam essa suposição. O operador pode declarar que a imagem não contém título, forçar sua exibição ou fornecer um título personalizado. A suposição não é aplicada a um pôster recortado, onde o título original pode deixar de aparecer.

## Validação

Testes cobrem status único, título embutido e substituições manuais, paleta independente da marca, cores claras e escuras, data única, horários completos, três formatos, contraste raster, integridade dos assets, preços e assinaturas dos cinemas. O lote de validação usa os 11 filmes publicados do Cine Cruzeiro em quatro composições, com PNGs, folhas de contato e manifesto de textos e cores.

As exportações antigas não são modificadas pela atualização. As novas artes devem ser geradas novamente no Studio.
