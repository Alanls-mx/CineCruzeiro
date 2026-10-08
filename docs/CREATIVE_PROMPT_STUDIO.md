# Creative Marketing Studio

O Studio fica em **Admin > Marketing > Creative Studio**. Ele gera direção criativa e texto para uso no Canva; não renderiza, edita nem publica peças, e não usa a API do Canva. O fluxo anterior de filmes continua legível no histórico, mas campanhas novas usam o brief versionado `2`.

## Preparação

1. Configure o PostgreSQL da instância e execute `node --env-file=.env.local scripts/db-migrate.js` localmente, ou `npm run db:migrate` com `DATABASE_URL` já exportada. A migration `046` cria o histórico e a `047` acrescenta categoria, versão do brief e campanhas sem filme.
2. Entre com um usuário que tenha `marketing.view` para visualizar e `marketing.manage` para gerar, editar, subir imagens e salvar.
3. Nenhuma chave de IA é necessária para o modo manual. Descreva luz, cores, assunto e espaço de texto no formulário se quiser orientar melhor a composição sem análise multimodal.
4. Opcionalmente, em **Integrações > IA do Creative Prompt Studio**, configure a chave OpenAI no backend e ative a integração para análise visual. A chave nunca vai ao frontend. O modelo deve aceitar imagens e saída JSON.
5. Para usar um serviço local compatível com Chat Completions, configure no ambiente privado do backend `CREATIVE_STUDIO_VISION_BASE_URL=http://127.0.0.1:11434/v1` e `CREATIVE_STUDIO_VISION_MODEL=<modelo-com-visao>`. Opcionalmente use `CREATIVE_STUDIO_VISION_API_KEY` e `CREATIVE_STUDIO_VISION_TIMEOUT_MS`. Somente loopback HTTP é aceito; o servidor local deve ouvir na mesma máquina/processo de rede do backend. A configuração local tem prioridade sobre a OpenAI nesse fluxo. Teste memória, disco e tempo de resposta da VPS com o modelo escolhido antes de mantê-lo ativo. Sem o serviço local acessível, o fluxo manual permanece disponível.

## Uso

1. Escolha uma das nove categorias: Filmes, Bomboniere, Programação, Promoções, Eventos, Cupons, Sorteios, Institucional ou Criação livre.
2. Se houver um filme, produto ou promoção no cadastro, selecione-o. Os dados existentes entram nos campos relevantes, mas podem ser corrigidos antes de gerar. Para programação de vários filmes, informe a lista e os horários confirmados no campo de programação; a seleção cadastral inicial preenche um filme por vez.
3. Preencha os campos da categoria. Asterisco indica obrigatório. Não deixe preço, validade ou regras como exemplo: dados ausentes são omitidos. Escreva outros textos que **não podem ser omitidos** no campo de textos obrigatórios, um por linha.
4. Selecione o formato e a densidade. Use imagem cadastrada, upload de JPG/PNG/WebP de até 5 MB, ou **Sem imagem**. Informe corretamente o papel da imagem: arte oficial, produto, logo ou referência. A referência secundária é opcional e não deve ser copiada literalmente.
5. Abra **Biblioteca de referências** se quiser buscar e escolher um dos 200 estudos. Há 80 para Filmes, 60 para Bomboniere e 60 para Programação; nas demais categorias o Studio segue sem essa biblioteca. A escolha automática usa termos do briefing, gênero cadastrado e observações visuais quando houver correspondência clara. A prévia mostra o exemplo integral, inclusive textos fictícios: ele não é o prompt da campanha.
6. Clique **Gerar direção criativa**, compare as três propostas e compile o prompt. Cada abordagem modifica composição, hierarquia e acabamento, além da intensidade visual; nenhuma altera os fatos. **Gerar outra direção** muda também o eixo de leitura de cada proposta.
7. Edite o prompt no campo de resultado, copie-o, salve-o ou clique **Baixar materiais (.zip)**. O ZIP inclui `prompt-canva.txt`, `briefing.json`, as assinaturas clara e escura, a imagem principal e a referência quando fornecidas. Para filmes, inclui também pôster e backdrop cadastrados quando disponíveis. Um `LEIA-ME.txt` lista materiais ausentes. O download salva primeiro o texto editado e rejeita a retirada de dados obrigatórios. Para alterar o briefing, use **Editar conteúdo** e **Atualizar prompt**.
8. No Canva, envie as imagens do ZIP, escolha a assinatura com melhor contraste e use o prompt como direção. Confira letras, preços, códigos, datas e horários no editor antes de publicar; geradores visuais podem deformar texto. Datas oriundas do catálogo são apresentadas como `dd/mm/aaaa`. Para programação, cupons, promoções e sorteios, insira ou corrija dados críticos manualmente.

## Arquitetura

- `creativeMarketingStudioService.js` mantém perfis extensíveis por categoria, campos contextuais, variantes, curadoria, brief `version: 2`, compilação e QA. Os campos factuais são mantidos literalmente; a curadoria não os descarta. Conteúdo extenso em formato curto recebe recomendação de carrossel.
- `creativePromptLibraryService.js` lê a biblioteca JSON fornecida pela equipe. A API autenticada lista metadados por categoria e mostra o exemplo integral sob demanda. Apenas conceitos delimitados de composição, tipografia, paleta e acabamento entram na direção; fatos e textos comerciais do exemplo não são copiados. A artwork e os dados confirmados prevalecem. O ID do estudo fica salvo no histórico e no brief.
- As rotas administrativas existentes `/api/admin/creative-prompts/*` mantêm autenticação, permissões, upload seguro, rate limit e histórico. Requisições com `studioVersion: 2` seguem o fluxo universal; registros antigos seguem o fluxo de filmes.
- O endpoint autenticado `GET /api/admin/creative-prompts/:id/bundle` reúne os originais visuais autorizados e o briefing em ZIP. O histórico guarda as URLs de pôster e backdrop usadas na geração para que uma alteração posterior no catálogo não troque os materiais da direção. A leitura de imagens continua restrita aos uploads locais, imagens públicas da aplicação e ao catálogo TMDB. Um asset principal ou referência indisponível interrompe o download; materiais complementares ausentes aparecem no manifesto.
- O analisador visual é opcional. Quando configurado, arte principal e referência são enviadas em chamadas separadas e a resposta fica no histórico. Quando ausente ou falha, o prompt registra explicitamente que a imagem não foi analisada e usa a descrição manual. O modo local usa uma API Chat Completions compatível; a integração OpenAI existente usa Responses API.
- A tabela `creative_prompt_studio_runs` persiste o snapshot do briefing, categoria, versão, observações, variantes, brief, fatos curados, prompt e status. Uploads permanecem no armazenamento existente; o histórico guarda URLs, não bytes de imagem.
- O Prompt QA verifica seções obrigatórias, formato e presença exata dos dados fornecidos. Ele não garante que o gerador do Canva reproduza esses dados corretamente; a revisão humana é obrigatória.

## Segurança e limites

O upload usa o serviço de armazenamento existente, valida assinatura/MIME/pixels e fica na pasta `creative-prompts`. A leitura para análise restringe origens; não aceita URL arbitrária para fetch. O serviço local é restrito a loopback para evitar chamadas a destinos externos controlados pelo usuário. Dados no formulário e em imagens são tratados como contexto, não como instruções de sistema. Chamadas de IA têm timeout; erros visuais não bloqueiam o modo manual e aparecem na tela. Há limite de oito solicitações de direção por dez minutos.

Não há OCR preciso, extração de title lockup, garantia geométrica de proteção de rostos/mãos, editor gráfico, publicação ou integração Canva. O fluxo manual pode ser menos específico que um modelo multimodal; a interface indica isso. A primeira versão não consulta automaticamente múltiplos filmes para compor uma programação inteira.

## Validação

Execute `node --test tests/creative-marketing-studio.test.mjs tests/creative-prompt-studio.test.mjs tests/creative-prompt-ui.test.mjs tests/creative-prompt-http.test.mjs`, `node --env-file=.env.local --test tests/creative-prompt-postgres.test.mjs`, `npm run lint` e `npm run build`. Os testes de IA usam mocks; não consomem créditos. Exemplos completos e **fictícios** das nove categorias estão em [CREATIVE_MARKETING_STUDIO_EXAMPLES.md](CREATIVE_MARKETING_STUDIO_EXAMPLES.md).
