# Social Studio: auditoria e polimento

Data: 24 e 25/09/2026. Base inspecionada: commit `1ca9d88`, seguida das alterações desta rodada.
Escopo: somente Cine Cruzeiro. Sem migração de banco, troca de arquitetura, substituição de assets ou remoção de recursos avançados.

## 1. Inventário antes e depois

| Funcionalidade encontrada no código atual | Antes | Depois |
| --- | --- | --- |
| Criação de estreia, destaque, ingresso com preço e pré-venda | Ativa | Preservada |
| Oferta de ingressos e compra online | Ativa | Preservada |
| Produto/combo e oferta da bomboniere | Ativa | Preservada |
| Programação do dia, da semana e vários filmes | Ativa | Preservada; imagens obrigatórias |
| Clube no registro de templates e posts antigos | Compatibilidade, fora da criação principal | Preservada, sem reintroduzir a categoria |
| Seleção de entidade e preenchimento a partir do catálogo comercial | Ativos | Preservados, com descarte de respostas antigas |
| Significado da data, preços, regras de oferta e recorrência | Ativos | Preservados |
| Seleção automática/manual de filmes e destaque na programação | Ativa | Preservada; destaque não oculta cartazes dos demais filmes |
| Famílias de composição selecionadas por categoria | Ativas | Preservadas |
| Paletas, fundos próprios, catálogo/gênero, filme vinculado, assinaturas | Ativos conforme categoria | Preservados |
| Controles legados e avançados retidos para compatibilidade | Existentes | Preservados, sem apagar dados |
| Copy por regras, tom, briefing, sugestões, bloqueios e legenda | Ativos | Preservados, com CTAs mais variados e correções factuais |
| Prévia PNG/JPG e editor Konva embutido | Ativos | Atualização automática corrigida |
| Texto, tamanho, cor, opacidade, rotação, bordas, mover/redimensionar | Ativos | Preservados |
| Desfazer/refazer, duplicar, excluir, bloquear elementos | Ativos | Preservados; salvar não reinicializa histórico sem necessidade |
| Editor dedicado de posts salvos | Ativo | Preservado; melhorias de sessão/upload/exportação |
| Camadas, formas, clipboard, alinhamento, crop, safe area, zoom | Ativos no editor dedicado | Preservados |
| Rascunho local da criação e rascunho remoto do editor dedicado | Ativos | Preservados; recuperação de ajustes antes da recomposição |
| Posts prontos: catálogo e lançamentos editoriais | Ativos | Preservados |
| Variações, ranking, favorita local, similaridade e hierarquia | Ativos | Preservados |
| Histórico, paginação, visualização, duplicação e exclusão | Ativos | Preservados |
| Original automático, rascunho manual, versões e restauração | Ativos | Preservados; metadados comerciais protegidos pelo servidor |
| Salvar arte, salvar três formatos, baixar prévia, exportar edição | Ativos | Preservados; bloqueio de exportação de prévia desatualizada |
| Remotion, fila de jobs, progresso, cancelamento e download de vídeo | Ativos | Preservados; chave da animação separada da imagem estática |
| Cache, fallback FFmpeg, retenção e recuperação após reinício | Existentes | Preservados |
| Permissões de visualização/criação/exclusão | Ativas | Preservadas |
| Alternância usar/não imagens em programação | Ativa | Retirada por pedido explícito; requisições antigas `none` viram `equal` |

### Recursos recentes identificados

O editor embutido não depende de salvar um post primeiro. Ele recebe uma cena por mensagens de mesma origem e envia alterações ao painel. O snapshot autenticado sustenta a exportação e a animação da arte. Este fluxo é diferente do editor dedicado, que mantém rascunho remoto e versões de um post já salvo.

Também foram identificados os contratos de campanha por categoria, validação raster de contraste, manifestos de programação e vínculos entre título/horário. São comportamentos intencionais, não código descartável.

## 2. Mapa técnico e fluxos

- Entrada: aba Marketing/Social Studio no admin; módulo `backend/public/social-studio.js` monta painel, seletores, abas de produção e histórico.
- Editor embutido: `/social-editor?inline=1`, `InlineEditor.tsx`, `EditorCanvas.tsx` e `SceneSerializer.ts`.
- Editor dedicado: `/social-editor?postId=...`, `SocialEditor.tsx`, Toolbar, LayersPanel e PropertiesPanel.
- Abas: Conteúdo, Imagem, Ajustes; produção: Composições, Animação, Legenda, Exportação. O editor usa propriedades contextuais, não um novo assistente de etapas.
- Confirmações nativas existentes: exclusão e restauração do original. Nenhum novo modal obrigatório foi adicionado ao fluxo de criação.
- Contexto: `socialStudioContext()` deriva filmes, sessões e bomboniere de `buildCommercialCatalog`; branding vem das configurações; próximos lançamentos vêm da coleção editorial local.
- Normalização: contratos de conteúdo, preço, campanha, bomboniere, ingressos, layout e workspace; horários filtrados por disponibilidade e fuso do cinema.
- Geração: normalizer, content-rules, copy-engine, composição por categoria, scene factory/builders, fontes locais, Satori e Sharp.
- Direção visual: famílias de filme/produto/programação, crops, máscaras, efeitos, cores, hierarquia, grupos e assinatura.
- Validação: regras comerciais e semânticas, capacidade de programação, manifestos, colisão, safe area, fontes mínimas, contraste raster e assets disponíveis.
- Persistência: `settings.socialStudioPosts` via repositório de configurações; uploads via storageService. Não foi criada tabela.
- Rascunhos/favoritos da criação: localStorage. Rascunhos e versões do editor dedicado: registro do post no servidor.
- Prévia: cache local limitado; snapshots em memória, vinculados ao usuário, com 30 minutos de validade e limite global de 32.
- Vídeo: AnimationJobs, manifestos/arquivos em disco, fila limitada, worker isolado, cache por cena/configuração/assets, cancelamento e limpeza. Reinício marca jobs interrompidos como falhos.
- Serviços externos: imagens do catálogo já integrado e infraestrutura de storage conforme configuração. Copy é baseado em regras; não há chamada a LLM nesta implementação auditada. Remotion/FFmpeg são renderizadores, não provedores de texto.

### Endpoints encontrados

Prefixo `/api/admin/social-studio`:

`context`, `uploads`, `assets`, `copy`, `resolve`, `preview`, `preview-scene`, `variations`, `posts`, `campaigns`, `animation`, `motion-preview`, `animation-jobs`.

Por post: `download`, `scene`, `scene-draft`, `scene-versions`, `scene-export`, `scene-reset` e exclusão. Por job: consulta, cancelamento e arquivo. As verificações de permissão seguem o middleware existente; jobs e snapshots também verificam autoria.

### Fluxos preservados

1. Selecionar campanha/conteúdo -> preencher dados -> compor -> editar na própria prévia -> revisar -> salvar/baixar/animar.
2. Comparar variações -> selecionar/favoritar -> abrir na criação ou no editor dedicado.
3. Abrir post pronto -> ajustar -> criar.
4. Histórico -> visualizar/baixar/duplicar -> editar rascunho -> salvar versão -> restaurar original quando necessário.
5. Arte salva -> configuração de movimento -> job -> progresso -> vídeo pronto/download/cancelamento.

## 3. Problemas encontrados e bugs corrigidos

| Gravidade | Problema confirmado | Correção |
| --- | --- | --- |
| Alta | Ajustes manuais bloqueavam toda atualização, mantendo filme no canvas ao selecionar bomboniere | Recomposição automática; checkpoint recuperável dos ajustes anteriores |
| Alta | Salvar/baixar durante mudança de dados podia usar imagem/token anterior | Checagem de chave, estado e token antes da ação |
| Alta | Resultado de salvamento podia substituir a criação que o usuário alterou durante a espera | Histórico é atualizado, mas o canvas só muda se ainda corresponder à operação |
| Alta | Editor dedicado aceitava metadados de origem enviados pelo cliente | Formato, template e sourceDraft ancorados na cena original do servidor |
| Média | Legenda alterada após gerar a prévia era ignorada ao salvar pelo snapshot | Salvamento aplica a legenda atual sem alterar a imagem nem mutar o snapshot |
| Média | Respostas atrasadas de preenchimento, copy e upload contaminavam seleções mais recentes | Verificação do contexto completo e versão de upload |
| Média | Salvar e reenviar a mesma cena reinicializava seleção/desfazer no iframe | Cena idêntica na mesma revisão não reinicializa o editor |
| Média | HTTP 401 e 403 no editor eram tratados igualmente com redirecionamento | Mensagens distintas e preservação da página de edição |
| Média | Requisições sem limite de espera e resposta HTML tratada como sucesso | Timeout, validação de resposta, mensagens de rede e limpeza de listeners/timers |
| Média | Editor oferecia 8 MB e servidor aceitava 5 MB | Limite de upload alinhado em 5 MB |
| Média | Configuração de animação invalidava também a chave da prévia estática | Separação entre chave visual estática e configuração de movimento |
| Média | Destacar um filme em agenda podia retirar cartazes dos outros | Agenda conserva as imagens dos demais filmes |
| Baixa | Botões voltavam a rótulos antigos após concluir | Rótulos estáveis para salvar arte, salvar formatos e comparar composições |
| Baixa | Fallback de clipboard anunciava sucesso sem confirmação | Resultado verificado; seleção manual em caso de falha |

## 4. Inconsistências corrigidas

- Programação sempre cria com cartazes; input legado `none` é migrado, sem alterar arquivos de posts antigos.
- Filme sem pôster e sem backdrop é identificado pelo nome antes de concluir a programação. O sistema solicita cadastro da imagem em Filmes, sem inventar asset.
- A validação de publicação rejeita remoção/ocultação das imagens obrigatórias da nova programação.
- Download do histórico usa o endpoint do post selecionado. A extensão da prévia vem do MIME real.
- Salvamento do editor embutido não libera silenciosamente os ajustes para descarte automático; a recomposição guarda recuperação explícita.

## 5. UX

- Trocas de categoria, conteúdo, formato e composição voltam a atualizar automaticamente.
- `Restaurar ajustes anteriores` recupera a cena e os parâmetros anteriores; o checkpoint acompanha o rascunho local.
- O sistema impede uma exportação desatualizada e explica como obter uma prévia válida.
- Falhas de rede, expiração de sessão e falta de permissão mantêm dados disponíveis na página.
- Novas respostas não substituem uma edição mais recente.

## 6. Polimento visual e acessibilidade

- Fonte do editor embutido alinhada ao editor existente.
- Controles herdam tipografia; seleção de texto e slider usam cores da interface.
- Foco de teclado visível, opções de arquivo com mais largura, mensagens com quebra segura.
- Alvos de toque de 44 px na barra e nos inputs do editor embutido em dispositivos de toque.
- Logos e assets existentes preservados. A programação recebeu a direção cinematográfica solicitada na continuação.
- Programação de três filmes prioriza destaque com mosaico no automático. Cartazes editoriais e agenda permanecem alternativas; Stories recebem arranjo próprio e cinco filmes usam duas fileiras completas, quando a capacidade permite.
- Detector visual sinalizou a borda do símbolo de conclusão como possível borda decorativa de card. Inspeção confirmou um check de status, não uma borda lateral de seção; mantido como falso positivo contextual.

## 7. Sistema criativo

Preservadas as famílias existentes, com evolução do gerador de programação: cartazes editoriais, destaque com mosaico e agenda por dia apresentam geometrias diferentes. Comparações descartam resultados com a mesma geometria dos pôsteres, em vez de contar apenas mudanças de cor.

O fundo automático combina paletas dos filmes e uma imagem do catálogo com blur, wash e vinheta. O estilo amarelo com faixas continua selecionável. A correção de contraste atua nas áreas de leitura sem remover todo o fundo. Pôsteres ficam nítidos e completos, com proteção contra sobreposição de texto.

Em campanhas de um único dia, a data fica no cabeçalho. Horários são agrupados por filme e a programação de vários dias pode continuar em mosaico, quando cabe, sem obrigar a conversão em lista. Capacidade, assinatura, CTA, URL e vínculos entre filmes e horários seguem validados.

## 8. Mensagens e loadings

Catálogo reutilizável no módulo do painel para prévia desatualizada, rede, timeout, resposta inválida, sessão expirada, permissão e conclusão. As mensagens de etapa continuam associadas a operações reais. Não há porcentagem inventada: imagem usa estado indeterminado e vídeo usa progresso do job.

## 9. Copy

- CTAs de filmes e programação variam entre alternativas coerentes com compra disponível ou lançamento futuro.
- Corrigida a associação do gênero `animation` ao repertório familiar.
- Duração numérica recebe unidade em minutos; duração já formatada é preservada.
- Removida a promessa `SETE DIAS DE CINEMA`, que não era garantida por uma programação semanal com sessões em poucos dias.
- Blocos textuais exatamente repetidos são deduplicados; fatos, horários, preços, condições e bloqueios editoriais continuam vindo dos contratos existentes.
- Não foram inventadas promoções, sessões, benefícios, características de filmes ou datas.

## 10. Engenharia

Mudanças concentradas nos módulos existentes: wrapper de requisições, controle de concorrência por chave/revisão, preservação de checkpoint e reaproveitamento de `editableSnapshot` nos endpoints de edição. Sem nova dependência, framework ou migração. Testes antigos foram atualizados apenas onde o comportamento mudou explicitamente (imagens obrigatórias), mantendo a verificação de conteúdo e qualidade.

## 11. Arquivos principais

- `backend/public/social-studio.js` e `.css`
- `backend/server.js`
- `backend/services/social-studio/engine/content-rules.js`
- `backend/services/social-studio/programming/builders.js`
- `backend/services/social-studio/programming/direction.js` e `engine/renderer.js`
- `backend/services/social-studio/composition-engine/artwork-quality.js`
- `backend/services/social-studio/composition-engine/variations.js`
- `backend/services/social-studio/copy-engine/index.js`
- `backend/services/social-studio/scene/preview-edit.js`
- `src/components/social-editor/InlineEditor.tsx`, `SocialEditor.tsx`, `social-editor.css`
- `scripts/verify-social-studio-focused.mjs`
- `scripts/verify-studio-programming-campaigns.mjs`
- Testes de copy e programação editorial

## 12. Validação

- 151 testes do Social Studio aprovados, incluindo qualidade visual, semântica, ofertas, programação, edição, contratos, animação e retenção de jobs.
- `npm run lint` (TypeScript): aprovado.
- Testes de interface usam Playwright com API simulada e renderizador real; não efetuam publicações nem modificam catálogo em produção.
- Matriz de viewport: desktop 1500x1000, laptop 1280x800, tablet 820x1180 e mobile 390x844. Evidências em `artifacts/studio-focused`.
- Comparação raster: 11 casos com pôsteres locais antes/depois e 11 casos com pôsteres do catálogo real em `artifacts/studio-programming-campaigns`. Sessões desses exemplos são fictícias exclusivamente para QA. Incluem solo, dupla, editorial, mosaico, agenda, cinco filmes, múltiplos horários, dois dias, amarelo, quadrado e Story.
- `npm test`: executado, interrompido em `scripts/smoke-tests.js:110`; login retorna 202, enquanto a fixture exige 200. A sequência anterior foi executada. Não foi alterada autenticação para tornar o teste verde.
- Teste de assinatura de webhook do Mercado Pago: aprovado, executado separadamente após a interrupção da suíte geral.
- Concorrência PostgreSQL: não executou cenários por ausência de `TEST_DATABASE_URL`; o script informou skip.
- `npm run test:e2e`: 4 passaram, 9 falharam, 3 não executaram. Falhas em bilheteria (seletor ambíguo, reconexão/assentos), fixtures de provedor de email, checkout, clube e consistência de sessão. Não foi executado baseline para atribuir origem dessas falhas. Log em `artifacts/studio-focused/e2e-tests.log`.
- Build de produção aprovado na auditoria; repetido antes da publicação da extensão de programação. Deploy restrito ao Cine Cruzeiro.

## 13. Pendências e limites conhecidos

- A fixture geral de smoke precisa lidar com o desafio de autenticação 202. Isso não foi corrigido como parte do Studio.
- Não foi possível comprovar todos os fluxos de banco PostgreSQL sem base de teste dedicada.
- O editor Konva e o raster final usam renderizadores distintos. São compartilhados cena, assets e fontes, mas equivalência pixel a pixel de todos os efeitos e todos os templates não foi comprovada nesta rodada.
- Detecção de rosto não existe como reconhecimento facial: a proteção é geométrica/heurística. Não deve ser anunciada como identificação infalível do personagem.
- Programações que excedem a capacidade visual continuam bloqueadas com orientação; não há paginação automática de dezenas de sessões.
- Salvar em três formatos com edição manual continua exigindo composição própria por formato, para não deformar ajustes.
- Copy continua determinístico por regras e referências cadastradas; não pesquisa novos fatos de filmes na internet.

## 14. Riscos e revisão futura

- Snapshot de prévia pode expirar ou ser removido pelo limite global; o usuário recebe orientação para atualizar, não há garantia de duração ilimitada.
- Rascunhos e favoritas são locais ao navegador. Limites de armazenamento são tratados, mas não substituem backup ou salvamento no histórico.
- Operações de salvamento não possuem idempotência distribuída. Em timeout com resposta perdida, conferir histórico antes de repetir é necessário.
- O editor dedicado mantém limite de versões e coexistência de rascunho/original; cenários de dois administradores editando o mesmo post simultaneamente merecem futura revisão de concorrência no repositório.
- A curadoria automática não garante sempre três opções: composições reprovadas por capacidade/qualidade são descartadas.

Conclusão: o mesmo Studio foi preservado. A rodada prioriza previsibilidade de estado, proteção do conteúdo, recuperação de erros e continuidade da criação; não declara que todos os cenários possíveis de produção foram exaustivamente comprovados.
