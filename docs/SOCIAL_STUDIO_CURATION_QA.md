# Curadoria do Social Studio: validação

## Amostra visual

Execução de 22/09/2026 com imagens de Cara de Barro, Shrek 5, Sonic 4 e Focker-in-Law. A data "22 DE OUTUBRO" é um dado de teste compartilhado, não uma confirmação de lançamento ou programação desses filmes.

Foram avaliadas oito estruturas por filme, comparando a versão inicial com o acabamento. Somente as quatro melhores aprovadas recebem miniaturas finais. Não foram criados posts ou alteradas sessões em produção durante a avaliação.

| Gênero | Melhor composição | Nota | Segunda opção | Nota |
| --- | --- | ---: | --- | ---: |
| Terror | Tipografia dominante | 98 | Hero à esquerda | 96 |
| Animação | Tipografia dominante | 95 | Hero à esquerda | 94 |
| Ação | Tipografia dominante | 96 | Imagem inteira | 95 |
| Comédia | Hero à esquerda | 95 | Imagem inteira | 94 |

As três primeiras campanhas priorizam a data, por isso a tipografia dominante venceu. Na comédia, o equilíbrio do retrato à esquerda com data e chamada à direita foi melhor avaliado. O acabamento uniformizou o rodapé, adicionou separador, reposicionou a marca e preservou o conteúdo. Pontuações iguais antes/depois são possíveis: a etapa não promete uma melhora numérica artificial.

## Calibração e limites

A primeira rodada produziu empates excessivos próximos de 100. A calibração passou a exigir mais tamanho e contraste nos textos principais e a considerar peso lateral e proporção da imagem. As notas finais variaram entre 83 e 98 na amostra. A comparação visual confirmou maior destaque da data nas primeiras opções e leitura preservada nas alternativas.

O score é uma heurística de composição, não uma previsão de conversão ou vendas. A proteção do artwork é geométrica, sem reconhecimento de rostos. A revisão manual permanece disponível. Favoritas são locais ao navegador, limitadas a oito, e não sincronizam entre operadores.

## Verificações

- Suíte de 71 testes do Studio, incluindo hierarquia, curadoria, acabamento, stories, textos longos e persistência.
- Geração de variações parecidas e de novas estruturas com hierarquia preservada.
- Playwright em 1440 × 1000 e 390 × 844: ações, persistência das favoritas, troca de filme, sincronização de miniaturas e ausência de erros de JavaScript ou overflow horizontal.
- Prévia no navegador usa o renderer real; a resposta de variações no teste de interface usa a saída real previamente gerada. Os modos de geração são testados diretamente no backend.
- Lint TypeScript e build de produção.

Os exemplos locais estão em `scratch/studio-curation-qa/`: `before-after.png` (antes acima, depois abaixo), arquivos `*-ranked.png`, `report.json` e capturas desktop/mobile. Esses arquivos de inspeção não são publicados como campanhas.
