# Anexo de Escopo Funcional do Sistema Cine Cruzeiro

| Identificação | Informação |
| --- | --- |
| Documento | Anexo de Escopo Funcional do Sistema Cine Cruzeiro |
| Revisão | 1.0 |
| Data de referência | 11 de setembro de 2026 |
| Base funcional analisada | Versão do sistema identificada pelo commit 55bac69 |
| Finalidade | Incorporação ou referência em contrato de desenvolvimento, licenciamento, implantação ou manutenção |

## 1. Finalidade do documento

Este documento descreve os sistemas, recursos, regras operacionais e limites da plataforma digital desenvolvida para o Cine Cruzeiro. Seu objetivo é servir como referência funcional para contrato, homologação, treinamento e futuras solicitações de alteração.

O texto apresenta o que cada módulo é capaz de fazer e os princípios usados em sua concepção. Não descreve endereços técnicos, rotas de programação, credenciais, segredos, comandos de servidor ou procedimentos internos de segurança.

As funcionalidades que dependem de terceiros somente operam quando o respectivo serviço externo está contratado, ativo, corretamente configurado e disponível. Alterações de escopo posteriores, integrações adicionais e mudanças impostas por fornecedores externos devem ser avaliadas separadamente.

## 2. Visão geral da solução

O Cine Cruzeiro possui uma plataforma integrada formada por:

- site público responsivo;
- catálogo de filmes e programação;
- venda online de ingressos;
- seleção de poltronas em tempo real;
- venda presencial por Bilheteria;
- gestão de bomboniere;
- pagamentos digitais e presenciais;
- emissão e gestão de ingressos digitais;
- Clube Cine Cruzeiro e assinaturas recorrentes;
- cupons e promoções;
- campanhas de e-mail;
- painel administrativo;
- aplicativo administrativo para Windows;
- integrações com serviços externos;
- registros de auditoria, segurança e operação.

A solução foi pensada para utilizar uma única fonte de dados. Filme, sessão, sala, preço, poltrona, pedido e pagamento são reaproveitados pelos diferentes módulos, reduzindo divergências entre o que o cliente vê, o que a Bilheteria vende e o que a administração acompanha.

## 3. Princípios de concepção

### 3.1 Fonte única de verdade

Dados comerciais não são recalculados livremente pelo navegador. Preço, desconto, disponibilidade, estoque, capacidade, benefício e estado do pagamento são confirmados pelo servidor antes da conclusão de uma operação.

### 3.2 Consistência entre canais

Site, Bilheteria, painel administrativo, ingresso, PDF, e-mail e aplicativo Windows utilizam os mesmos registros centrais. Uma alteração válida em sala, sessão ou filme deve refletir nos sistemas que dependem dessa informação.

### 3.3 Segurança por validação no servidor

Informações enviadas pelo navegador são consideradas solicitações, e não fatos definitivos. O servidor valida identidade, permissão, preço, estoque, poltrona, cupom, benefício e estado do pagamento antes de persistir o resultado.

### 3.4 Preservação do histórico

Operações concluídas mantêm registros suficientes para consulta e auditoria. Itens encerrados são preferencialmente arquivados ou desativados quando sua remoção comprometeria o histórico de ingressos, pedidos, pagamentos ou campanhas.

### 3.5 Dependências explícitas

Recursos dependentes de Mercado Pago, Gemini, TMDB, Google, SMTP, câmera, impressora ou outro fornecedor não simulam sucesso quando a integração real falha. A interface deve informar indisponibilidade, pendência ou necessidade de configuração.

## 4. Site público e presença digital

O site público apresenta a identidade do Cine Cruzeiro e oferece acesso às principais informações e serviços do cinema.

Capacidades:

- página inicial com destaques, filmes, chamadas e programação;
- catálogo de filmes em cartaz e em breve;
- página individual de filme com sinopse, duração, classificação, gêneros, mídia e sessões;
- navegação por datas, formatos e idiomas disponíveis;
- página institucional sobre o cinema;
- apresentação do Clube Cine Cruzeiro;
- formulário de contato para eventos privados;
- páginas de privacidade e termos;
- página de erro personalizada quando um conteúdo não existe;
- adaptação para computador, notebook, tablet e celular.

O site foi pensado para priorizar a programação real e a compra, evitando apresentar como disponível uma sessão encerrada, oculta ou incompatível com as regras atuais.

### 4.1 Descoberta e compartilhamento

As páginas públicas possuem metadados descritivos, endereço canônico, informações para compartilhamento social, mapa de conteúdo indexável e instruções para que áreas privadas, checkout e painel não sejam tratadas como páginas públicas por mecanismos de busca.

Filmes publicados podem ser incluídos dinamicamente no mapa de conteúdo. Esses recursos melhoram a base técnica de descoberta, mas não constituem garantia de posição, tráfego ou resultado em mecanismos de busca.

### 4.2 Medição de audiência e consentimento

Quando configurado, o site pode utilizar Google Analytics e Pixel da Meta para medição de navegação e campanhas.

Essas ferramentas são carregadas somente após consentimento do visitante. A escolha entre medição e uso apenas de recursos essenciais fica armazenada no navegador. A implementação não envia nome, e-mail, telefone ou CPF como dados de evento para essas plataformas.

O funcionamento e a retenção posterior dos dados dependem das contas e políticas dos respectivos fornecedores. A configuração técnica não substitui a responsabilidade do cinema por sua política de privacidade e bases legais aplicáveis.

## 5. Catálogo de filmes

O módulo de filmes permite cadastrar, revisar, publicar, ordenar, arquivar e excluir conteúdos do catálogo.

Cada filme pode conter:

- título e título original;
- sinopse;
- duração;
- classificação indicativa;
- gêneros;
- pôster e imagem de destaque;
- trailer e referências de mídia;
- data de estreia;
- estado de publicação;
- selo editorial;
- sessões relacionadas.

Os selos podem representar situações como pré-estreia, estreia, em cartaz ou outras classificações editoriais disponíveis. O sistema também permite não exibir selo. O selo normal não precisa ser mostrado ao público quando representa apenas o estado padrão.

As transições temporais foram pensadas para que filmes mudem de estágio conforme as datas e regras cadastradas, sem depender de edição manual em cada ocorrência. A alteração automática somente deve ocorrer quando os dados existentes permitirem uma decisão confiável.

## 6. Integração de catálogo com o TMDB

O painel pode pesquisar filmes no TMDB e importar informações disponíveis, reduzindo digitação manual.

Podem ser importados título, título original, sinopse, duração, classificação, gêneros, identificadores e imagens. O operador continua responsável por revisar o material antes da publicação.

A duração é obtida a partir dos detalhes oficiais disponibilizados pelo TMDB. Quando o fornecedor não informa o dado, o sistema não deve inventar uma duração. A pendência é apresentada para revisão administrativa.

Ao publicar um filme, as imagens externas utilizadas são baixadas para o armazenamento do próprio Cine Cruzeiro. A partir desse momento, site, painel, PDF e e-mail utilizam o endereço local da imagem. Essa decisão reduz dependência visual do TMDB e evita falhas causadas por links temporários ou políticas externas.

Na exclusão definitiva de um filme, imagens locais sem outras referências podem ser removidas para evitar ocupação desnecessária. Filmes apenas arquivados preservam a mídia necessária ao histórico.

## 7. Programação e sessões

A sessão é o registro central que relaciona filme, sala, data, horário, formato, idioma, tipos de ingresso, capacidade e disponibilidade.

O painel permite:

- criar uma sessão individual;
- criar sessões em lote por intervalo de datas;
- escolher dias da semana e múltiplos horários;
- definir sala, formato, idioma e estado;
- vincular os tipos de ingresso aceitos;
- editar ou encerrar sessões;
- consultar ocupação e vendas relacionadas.

O tratamento de datas utiliza o horário local do cinema. Isso evita que sessões noturnas mudem de dia por conversão inadequada de fuso horário.

Sessões encerradas deixam de ser oferecidas para compra. Após o prazo operacional definido, podem ser arquivadas automaticamente, preservando os ingressos e pedidos relacionados. Sistemas dependentes devem ignorar sessões arquivadas como opção de nova venda.

Sessões em andamento podem aparecer no dashboard com destaque, horário previsto de término, tempo restante, ocupação e informações relevantes para a operação.

## 8. Salas e tecnologias

O módulo de salas permite cadastrar ambientes de exibição e suas características.

Cada sala pode possuir:

- nome;
- descrição;
- capacidade;
- tecnologias de imagem, som e conforto;
- estado operacional;
- mapa de poltronas opcional.

As informações atuais da sala são utilizadas na programação, na Bilheteria, no checkout e nos ingressos. A edição de nome ou tecnologia deve refletir nas descrições derivadas, evitando que uma sessão continue exibindo uma característica antiga da sala.

Informações históricas já materializadas em documentos podem ser preservadas quando necessário para manter a fidelidade do registro emitido.

## 9. Mapa configurável de poltronas

Uma sala pode operar com lugar livre ou com poltronas numeradas.

Quando o mapa está habilitado, o painel permite:

- configurar fileiras e colunas;
- adicionar e remover cadeiras;
- criar corredores e espaços vazios;
- editar rótulos e numeração;
- posicionar cadeiras à esquerda ou à direita do mapa;
- selecionar uma cadeira, fileira ou coluna para edição;
- alterar cor e tipo de poltrona;
- habilitar ou bloquear lugares;
- marcar lugares para cadeirantes;
- marcar poltronas destinadas a pessoas obesas;
- calcular a capacidade a partir das cadeiras ativas;
- apresentar letras laterais e numeração inferior compatível com a sala.

O mapa cadastrado é compartilhado pelo checkout e pela Bilheteria. Uma alteração relevante solicita atualização das telas conectadas. Uma cadeira com ingresso ou reserva ativa não deve ser removida silenciosamente.

## 10. Sincronização de poltronas em tempo real

O sistema utiliza comunicação em tempo real para evitar que duas pessoas concluam a compra da mesma poltrona.

Funcionamento concebido:

1. o cliente ou operador seleciona uma cadeira;
2. o servidor verifica e bloqueia a cadeira de forma atômica;
3. o primeiro solicitante recebe a reserva temporária;
4. uma tentativa concorrente é rejeitada imediatamente;
5. todas as telas conectadas à mesma sessão recebem a atualização;
6. a seleção é renovada enquanto a pessoa permanece ativa no fluxo;
7. abandono, cancelamento ou expiração libera a cadeira;
8. a confirmação do pagamento transforma a reserva em ocupação definitiva.

Estados visuais distinguem cadeira disponível, selecionada pelo próprio usuário, reservada temporariamente por outra compra e indisponível.

O bloqueio é validado novamente no fechamento do pedido. Alterar dados no navegador não permite assumir uma poltrona pertencente a outro usuário.

## 11. Tipos e preços de ingressos

O painel permite criar e administrar categorias comerciais de ingresso.

Cada tipo pode definir:

- nome;
- descrição;
- preço;
- disponibilidade;
- quantidade de ingressos gerada por unidade comercial;
- elegibilidade por sessão.

O multiplicador permite produtos como pacotes de dois ou mais ingressos. A quantidade efetiva emitida é calculada no servidor e também determina a quantidade obrigatória de poltronas.

O preço da sessão é derivado dos tipos de ingresso vinculados. Essa arquitetura evita preços diferentes entre site, Bilheteria e relatórios.

## 12. Cadastro e conta do cliente

A compra online exige uma conta autenticada. O sistema atual não permite concluir a compra pública sem cadastro.

Capacidades da conta:

- cadastro e autenticação;
- autenticação opcional com Google, quando configurada;
- verificação de e-mail;
- recuperação de senha;
- edição de nome, telefone, CPF e senha;
- alteração de e-mail com confirmação;
- consulta de pedidos e ingressos;
- separação entre ingressos futuros e arquivados;
- consulta de assinatura e benefícios do Clube;
- transferência de ingresso elegível.

A sessão de autenticação utiliza cookie protegido. E-mail, CPF ou identificador de pedido não substituem a autenticação.

### 12.1 Verificação e recuperação de acesso

O sistema gera links temporários para confirmação de e-mail e recuperação de senha. Apenas a verificação irreversível do token é armazenada, reduzindo o impacto de acesso indevido ao banco.

Há limitação de tentativas para reduzir abuso e envio excessivo. Um novo endereço de e-mail não é considerado verificado antes da confirmação. A entrega dos links depende do serviço de e-mail configurado.

## 13. Checkout online

O checkout conduz o cliente pelas etapas de ingressos, extras, pagamento e confirmação.

Regras principais:

- etapas futuras permanecem bloqueadas até que as anteriores sejam concluídas;
- a sessão é revalidada antes do pagamento;
- a quantidade real de ingressos considera os multiplicadores cadastrados;
- quando há mapa, cada ingresso exige uma poltrona válida;
- poltronas selecionadas permanecem vinculadas ao pedido ao avançar;
- extras permanecem no pedido entre as etapas;
- o backend recalcula preço, cupom, Clube, estoque e capacidade;
- pagamentos pendentes não liberam ingressos;
- sessões expiradas ou esgotadas impedem a continuação;
- reservas e cobranças expiradas deixam de manter poltronas bloqueadas;
- o resumo detalha ingressos, poltronas, extras, benefícios, créditos e descontos aplicados.

O checkout foi pensado para impedir saltos de etapa e para não confiar em totais enviados pelo navegador.

## 14. Bomboniere no checkout

O cliente pode adicionar produtos e combos disponíveis à mesma compra do ingresso.

Os produtos possuem nome, descrição, imagem local, categoria, preço, estoque, limite por pedido, disponibilidade, destaque e ordem de exibição.

Os itens pertencem ao pedido e não são duplicados em cada ingresso. O estoque e o preço são verificados novamente no servidor antes da conclusão.

Benefícios do Clube e cupons podem afetar a bomboniere quando suas regras permitirem. O resumo apresenta a origem e o valor do desconto aplicado.

## 15. Pagamentos online

Os pagamentos são integrados à solução configurada do Mercado Pago, utilizando o modelo atual de Orders.

Capacidades previstas:

- geração de Pix com QR Code e código copia e cola;
- pagamento por cartão quando habilitado;
- consulta periódica do estado do pagamento;
- confirmação por comunicação autenticada do provedor;
- tratamento de pagamento aprovado, pendente, recusado, cancelado, expirado ou reembolsado;
- proteção contra processamento duplicado;
- validação de valor pelo servidor;
- liberação de ingressos somente após aprovação válida.

Um Pix possui prazo operacional. Se não for pago dentro do período aceito, o pedido e a reserva relacionada podem expirar, impedindo pagamento tardio sobre disponibilidade antiga.

O funcionamento depende de credenciais, conta, ambiente e notificações do Mercado Pago corretamente configurados.

## 16. Bilheteria administrativa

A Bilheteria permite vendas manuais utilizando os mesmos filmes, sessões, preços, poltronas, benefícios e estoques do site.

Modos de atendimento:

- cliente cadastrado;
- cliente avulso;
- venda rápida.

Para cliente avulso, o operador pode selecionar entrega online ou impressão física. A entrega online exige um endereço de e-mail válido. Venda rápida é direcionada ao atendimento presencial e à impressão.

O operador pode:

- escolher data, filme e sessão;
- adicionar diferentes tipos e quantidades de ingresso;
- selecionar poltronas em tempo real;
- adicionar produtos da bomboniere;
- adicionar mais de uma sessão à mesma venda quando permitido;
- acompanhar um resumo fixo com cliente, filmes, itens, poltronas, quantidades e total;
- escolher dinheiro, cortesia, Pix ou cartão conforme as integrações disponíveis;
- diferenciar pagamento em débito e crédito na maquininha;
- concluir, acompanhar ou cancelar cobranças presenciais;
- emitir e imprimir ingressos.

Vendas presenciais respeitam as mesmas regras de disponibilidade e concorrência do checkout online.

## 17. Mercado Pago Point e operação presencial

Quando o Mercado Pago Point está ativo e associado a um terminal válido, a Bilheteria pode enviar cobranças presenciais ao equipamento.

O operador escolhe débito ou crédito. O pedido permanece pendente enquanto o cliente realiza o pagamento. A emissão ocorre somente após retorno processado e aprovado pelo provedor.

Recusa, cancelamento ou expiração não devem gerar ingresso válido. A confirmação repetida não deve duplicar pedidos ou ingressos.

Em vendas elegíveis, o sistema pode solicitar à Point Smart a impressão de ingressos e resumo de itens da bomboniere. Uma falha de impressão não desfaz uma venda aprovada; o painel informa o problema para nova tentativa ou impressão individual.

Essa integração depende de modelo de equipamento, conta, firmware, modo PDV e capacidades disponibilizadas pelo Mercado Pago.

## 18. Pedidos e acompanhamento de vendas

O sistema mantém o pedido como agregador de cliente, sessão, ingressos, poltronas, bomboniere, descontos, benefícios e pagamento.

O painel permite consultar pedidos e acompanhar:

- referência;
- cliente;
- origem da venda;
- itens e quantidades;
- sessão e filme;
- poltronas;
- forma de pagamento;
- valor bruto, descontos e total;
- estado operacional e financeiro;
- datas relevantes;
- observações e eventos relacionados.

Pedidos pagos, pendentes, cancelados, expirados e reembolsados são tratados separadamente. Somente operações aprovadas entram na receita realizada.

## 19. Ingressos digitais

Cada ingresso emitido pode conter:

- identificação do filme;
- data e horário;
- sala e tecnologias;
- formato e idioma;
- tipo de ingresso;
- poltrona e tipo de poltrona;
- código individual;
- QR Code;
- pedido e titular;
- estado de validade.

O ingresso fica disponível na conta do cliente e pode ser enviado por e-mail. Ingressos expirados migram para o histórico após o prazo operacional, sem desaparecer do registro do cliente.

Ingressos pendentes, cancelados, reembolsados, expirados ou já utilizados não são aceitos como válidos apenas por possuírem um QR Code.

## 20. PDF do ingresso

O sistema gera documento PDF próprio para cada ingresso.

O PDF pode incluir:

- identidade visual do Cine Cruzeiro;
- pôster local do filme;
- dados da sessão;
- poltrona em destaque na primeira página;
- QR Code;
- código individual;
- resumo necessário para apresentação na entrada.

Datas e horários visíveis utilizam o formato brasileiro. O layout foi separado dos ativos usados no site para preservar legibilidade e evitar fundos ou recortes inadequados.

## 21. E-mail de entrega do ingresso

Após a confirmação aplicável, o sistema pode enviar ao cliente uma mensagem transacional com os dados do ingresso e o PDF correspondente.

A mensagem utiliza os dados sincronizados de filme, sessão, sala e poltrona. Ela pode incluir pôster, resumo do pedido e instruções de acesso.

Mensagens transacionais são independentes das campanhas de marketing e não são bloqueadas pelo descadastro promocional quando necessárias à prestação do serviço.

O envio depende de SMTP ou provedor de webhook corretamente configurado. Falha de e-mail não altera retroativamente a validade de um ingresso já emitido.

## 22. Google Wallet

Ingressos elegíveis podem ser adicionados à Google Wallet por meio da integração oficial.

O passe utiliza dados do ingresso e mantém a identificação necessária para apresentação. A disponibilidade depende de conta emissora, classe, credenciais e aprovação válidas junto ao Google.

O Google Wallet é uma forma adicional de armazenamento do ingresso e não substitui o registro principal do servidor.

## 23. Transferência de ingressos

O titular pode transferir um ingresso elegível para outro cliente cadastrado.

A transferência somente é permitida para ingresso pago, válido, não utilizado, não expirado, não cancelado e não reembolsado.

Ao concluir:

- a titularidade é alterada de forma controlada;
- remetente, destinatário e horário são registrados;
- o código anterior deixa de representar a titularidade antiga;
- as partes podem receber mensagens transacionais.

O destinatário precisa possuir uma conta válida, evitando transferência para uma identidade não verificável.

## 24. Validação de ingressos

O painel permite validar ingressos por câmera ou digitação manual do código.

O leitor consulta o estado atual do ingresso no servidor antes de autorizar a entrada. Um ingresso já utilizado não pode ser reutilizado.

A leitura por câmera depende de conexão com o servidor, HTTPS, permissão do navegador e dispositivo compatível. O sistema atual não utiliza validação criptográfica offline autônoma.

## 25. Gestão da bomboniere

O painel administrativo permite criar, editar, organizar, ativar, desativar e excluir produtos conforme as regras de integridade.

Cada cadastro pode conter:

- nome e descrição;
- SKU interno;
- categoria;
- imagem local;
- preço e preço de comparação;
- estoque;
- limite por pedido;
- selo e destaque;
- disponibilidade;
- ordem de apresentação.

Imagens transparentes ou com fundo próprio são exibidas sem a imposição de um fundo adicional incompatível.

### 25.1 Demonstrativo financeiro da bomboniere

O painel não apresenta apenas um total isolado. Para o período selecionado, detalha:

- receita líquida aprovada;
- venda bruta antes de benefícios;
- total de descontos concedidos;
- quantidade de itens;
- quantidade de pedidos pagos;
- desconto percentual do Clube;
- produtos gratuitos do Clube;
- cupons aplicados;
- ajustes de conciliação, quando existirem;
- composição individual por produto;
- quantidade e número de pedidos por produto;
- faixa de preço unitário;
- valor bruto, descontos e valor líquido por produto;
- código do cupom quando preservado no pedido.

Somente pedidos pagos entram na receita. Pedidos pendentes, recusados, expirados ou cancelados ficam fora desse cálculo.

## 26. Cupons de desconto

O módulo de cupons permite criar regras comerciais controladas pelo servidor.

Um cupom pode definir:

- código único;
- descrição;
- desconto percentual;
- desconto de valor fixo;
- preço final promocional;
- aplicação em ingressos, bomboniere ou ambos;
- pedido mínimo;
- limite máximo de desconto;
- período de validade;
- filmes elegíveis;
- limite total de usos;
- limite por cliente;
- restrição à primeira compra;
- combinação permitida ou proibida com benefícios do Clube;
- estado ativo, expirado ou arquivado.

O cálculo exibido antes do pagamento é conferido novamente na conclusão. Um código válido no início pode ser rejeitado posteriormente se expirar, atingir limite ou perder elegibilidade antes do fechamento.

Cupons expirados deixam de ser oferecidos e são encaminhados ao histórico conforme a política do sistema. O histórico de uso pode informar cliente, data, horário, filme, pedido e economia concedida.

Quando uma campanha promocional exige um cupom correspondente, o módulo de campanhas pode criar ou vincular uma regra coerente, desde que os dados comerciais necessários estejam completos e válidos.

## 27. Clube Cine Cruzeiro

O Clube permite oferecer planos recorrentes com créditos e benefícios configuráveis.

Cada plano pode definir:

- nome e mensalidade;
- quantidade de créditos ou ingressos por ciclo;
- valor de referência por crédito;
- validade e acúmulo;
- carência e limites;
- formatos e sessões elegíveis;
- pagamento de diferença em sessões mais caras;
- desconto percentual em ingressos;
- desconto percentual na bomboniere;
- produtos gratuitos por ciclo;
- produtos excluídos de desconto;
- lista pública de benefícios;
- imagem, ordem, recomendação e estado.

Os benefícios são recalculados pelo servidor com base no plano, assinatura, ciclo, produtos e sessão reais. O navegador não define o valor final da vantagem.

## 28. Assinaturas, ciclos e créditos do Clube

A contratação recorrente utiliza cartão de crédito através do Mercado Pago quando a integração está ativa.

Uma assinatura somente se torna ativa após confirmação válida. O sistema separa assinatura, mensalidade, ciclo, crédito individual, resgate e ingresso, permitindo rastrear o uso do benefício.

Capacidades:

- ativação após aprovação;
- expiração de proposta sem pagamento;
- renovação por ciclo;
- emissão e consumo de créditos;
- reserva de crédito durante pagamento complementar;
- devolução controlada quando uma operação elegível falha ou é cancelada;
- pagamento de diferença quando permitido pelo plano;
- aplicação de desconto em ingressos e bomboniere;
- resgate de produtos gratuitos;
- cancelamento da renovação;
- manutenção dos benefícios até o fim do ciclo já pago;
- encerramento automático ao término da vigência;
- histórico de mensalidades, ciclos, créditos e resgates.

O sistema não reativa automaticamente uma cobrança cancelada pelo cliente. Uma nova contratação exige nova autorização.

## 29. Administração do Clube

O painel permite:

- criar e editar planos;
- personalizar imagens e conteúdo da página do Clube;
- pesquisar assinaturas por cliente ou plano;
- consultar estado, ciclo e créditos;
- visualizar economia gerada para o assinante;
- consultar descontos em ingressos, bomboniere e itens gratuitos;
- ajustar créditos quando a permissão administrativa permitir;
- cancelar renovação;
- atribuir assinatura manual para venda presencial, cortesia ou migração;
- separar assinaturas ativas e encerradas.

Valores contábeis configuráveis dependem de definição do cinema e de sua assessoria contábil. O sistema não cria uma classificação tributária por suposição.

## 30. Marketing e conteúdo do site

O módulo de Marketing permite administrar elementos editoriais e comerciais do site.

Capacidades:

- configurar conteúdos de destaque da página inicial;
- administrar imagens de eventos;
- criar e ordenar anúncios;
- administrar cupons;
- criar campanhas de e-mail;
- definir identidade visual usada nos envios.

As alterações foram pensadas para permitir operação pelo cinema sem edição direta de código.

## 31. Campanhas de e-mail

O sistema separa campanhas promocionais de mensagens transacionais.

O fluxo de campanha começa pelo objetivo da comunicação, e não pela escolha técnica de um template. O operador informa se deseja divulgar filme, programação, oferta, bomboniere, Clube, evento ou comunicado.

Com base no conteúdo selecionado, o sistema determina um layout compatível. Os templates continuam existindo internamente, mas a escolha principal é automatizada por regras determinísticas.

Exemplos de decisão:

- filme em breve pode utilizar layout de grande estreia;
- múltiplos filmes utilizam programação;
- cupom válido utiliza comunicação de cupom;
- promoção sem cupom utiliza promoção editorial;
- um produto utiliza destaque individual;
- vários produtos utilizam combo;
- plano específico utiliza comunicação de plano;
- público de reativação utiliza mensagem compatível com reativação;
- evento utiliza layout de evento;
- comunicação sem vínculo comercial utiliza comunicado.

O backend valida novamente a coerência antes de prévia, salvamento, teste, agendamento e envio. Um layout incompatível não deve ser aceito apenas porque foi solicitado pelo navegador.

## 32. Templates de e-mail

Os layouts existentes contemplam situações como:

- comunicado geral;
- programação;
- grande estreia;
- últimas sessões;
- promoção;
- cupom;
- produto de bomboniere;
- combo;
- plano do Clube;
- novidades do Clube;
- aniversário;
- evento;
- instruções de acesso ao ingresso;
- reativação de cliente.

Cada template define estrutura, hierarquia, imagem admitida, chamada para ação e identidade visual. Filmes, bomboniere, cupons e planos utilizam somente dados validados do catálogo correspondente.

O operador pode visualizar o resultado em formatos de computador e celular antes do envio. A prévia utiliza o mesmo conteúdo canônico destinado ao e-mail final.

## 33. Rascunhos, histórico e operação das campanhas

O painel permite:

- criar e salvar rascunhos;
- abrir rascunhos existentes;
- duplicar uma campanha como ponto de partida;
- excluir rascunhos sem histórico de envio;
- pesquisar e filtrar registros;
- separar resultados em páginas para evitar crescimento vertical excessivo;
- enviar mensagem de teste;
- agendar envio;
- cancelar campanha elegível;
- acompanhar processamento;
- consultar destinatários, tentativas, falhas e identificador do provedor;
- liberar nova tentativa manual quando a falha for conhecida e segura.

Campanhas já processadas preservam seu histórico. Uma exclusão física não deve apagar evidência de entrega ou falha.

## 34. Segmentação e consentimento de marketing

As campanhas podem utilizar públicos como:

- base elegível com consentimento;
- clientes recentes;
- clientes com compra aprovada;
- clientes inativos dentro do intervalo configurado;
- seleção manual;
- seleção manual para aniversário.

São removidos destinatários com e-mail inválido, descadastro, supressão ou incompatibilidade comercial.

O público é calculado durante a preparação e fotografado antes do envio. Ele é revalidado em lotes para impedir que uma pessoa descadastrada ou uma oferta inválida continue sendo processada.

Como o cadastro atual não possui data de nascimento confiável para toda a base, aniversário automático não é prometido. A seleção correspondente é manual até que exista dado suficiente.

Campanhas incluem mecanismo individual de descadastro. Mensagens transacionais necessárias à conta, pagamento ou ingresso seguem regras próprias.

## 35. Assistente de campanhas com Gemini

O módulo de campanhas pode utilizar o Gemini como assistente de redação e composição.

A IA pode auxiliar na criação de:

- assunto;
- texto de prévia;
- chamada superior;
- título;
- mensagem;
- botões e chamadas para ação;
- pequenas adaptações visuais permitidas pela identidade do cinema.

Antes de gerar, o sistema determina o objetivo, valida catálogo e escolhe o template por regra própria. A IA não possui autoridade final para inventar filme, produto, cupom, plano, sessão, preço, público ou condição comercial.

O contexto enviado ao Gemini é limitado ao cenário aprovado, ao briefing, ao template compatível, aos itens reais e a referências coerentes do mesmo tipo. Um rascunho de filme não deve ser usado como referência comercial de bomboniere sem relação válida.

Datas e afirmações temporais do pedido são verificadas contra sessões e estreia existentes quando houver dados suficientes. Frases como “estreia nesta semana” não devem ser confirmadas se o catálogo não sustentar essa afirmação.

Se a API do Gemini estiver indisponível, sem credencial, exceder limite, falhar ou demorar além do prazo, a geração é interrompida. O sistema não cria silenciosamente um rascunho genérico e não troca para outro provedor de IA. A revisão humana continua obrigatória antes do envio.

## 36. Fila e confiabilidade de campanhas

Campanhas agendadas e envios em massa são processados em fila durável quando o ambiente utiliza PostgreSQL.

O sistema foi pensado para:

- impedir dois trabalhadores de enviarem o mesmo destinatário simultaneamente;
- registrar cada tentativa antes de contatar o provedor;
- aplicar retentativa controlada para falhas claramente temporárias;
- preservar resultados incertos para revisão;
- recuperar trabalhos abandonados após reinício;
- impedir envio restante quando catálogo, oferta ou consentimento perder validade;
- manter rastreabilidade por campanha e destinatário.

SMTP não garante entrega exatamente uma vez em todos os cenários. Quando existe dúvida se o provedor recebeu a mensagem, o sistema evita um segundo envio automático para não duplicar a comunicação.

Aberturas e cliques somente podem ser medidos quando o provedor oferecer integração compatível. O painel não apresenta números fictícios quando essa fonte não existe.

## 37. Formulário de eventos privados

O site permite que interessados enviem uma solicitação de evento ao cinema.

Informações coletadas podem incluir nome, telefone, e-mail, tipo de evento, quantidade estimada, data, horário e mensagem.

O servidor valida os campos, utiliza proteção básica contra automação indevida, encaminha a solicitação ao atendimento configurado e pode enviar uma confirmação automática ao interessado. Quando um CRM está configurado, o lead também pode ser encaminhado.

O formulário representa uma solicitação de contato, e não uma reserva confirmada da sala.

## 38. Dashboard administrativo

O dashboard oferece visão operacional e financeira por período.

Capacidades:

- receita aprovada;
- quantidade de vendas;
- ingressos emitidos;
- ticket médio;
- comparação com período anterior;
- pagamentos aprovados, pendentes, recusados, cancelados, reembolsados e expirados;
- origem das vendas;
- formas de pagamento;
- composição entre ingressos, bomboniere e Clube;
- receita por filme;
- produtos mais vendidos;
- pedidos recentes;
- métricas do Clube;
- alertas operacionais;
- sessões ativas e em andamento;
- ocupação das salas.

Receita realizada considera somente pedidos e pagamentos aprovados. Valores pendentes são apresentados separadamente e não compõem faturamento confirmado.

Sessões já encerradas não são mostradas como próximas sessões operacionais. Sessões em andamento recebem contexto de início, término, ocupação e tempo restante.

## 39. Relatórios e conciliação financeira

O sistema separa as origens do valor para evitar que um total agregado seja interpretado incorretamente.

Os cálculos distinguem:

- ingresso;
- bomboniere;
- assinatura do Clube;
- desconto do Clube;
- crédito do Clube;
- item gratuito;
- cupom;
- pagamento aprovado;
- pagamento pendente;
- cancelamento, expiração e reembolso.

O painel também pode gerar relatório tabular do dashboard para análise externa.

Os relatórios representam os dados operacionais registrados na plataforma. Conciliação bancária definitiva, escrituração e classificação tributária continuam dependendo dos extratos dos provedores e da orientação contábil do cinema.

## 40. Contas administrativas e permissões

O painel diferencia perfis de acesso:

- proprietário, com controle amplo e integrações sensíveis;
- gerente, voltado à gestão diária;
- operador, voltado à Bilheteria, consulta e validação permitidas.

As permissões são verificadas no servidor. Ocultar um botão não substitui a autorização real.

O proprietário pode administrar integrantes da equipe, enquanto contas de clientes são tratadas separadamente. O sistema impede que um formulário comum converta silenciosamente um cliente em administrador ou altere o tipo de conta de maneira incompatível.

## 41. Autenticação em duas etapas

Contas administrativas podem utilizar autenticação em duas etapas baseada em aplicativo autenticador.

Capacidades:

- configuração por conta;
- confirmação antes da ativação;
- códigos de recuperação de uso único;
- renovação dos códigos;
- política administrativa que pode exigir proteção adicional da equipe;
- segredo armazenado de forma criptografada;
- códigos de recuperação armazenados apenas como verificação irreversível.

A disponibilidade da autenticação em duas etapas não elimina a necessidade de senha forte, controle de dispositivos e revogação de acessos desligados da equipe.

## 42. Logs e auditoria

O painel mantém histórico de eventos relevantes da aplicação e das ações administrativas.

Os registros podem incluir:

- nível de severidade;
- categoria e evento;
- identificador de correlação;
- ator;
- entidade alterada;
- data e horário;
- origem técnica da requisição;
- resultado;
- metadados sanitizados;
- estado anterior e posterior em mutações relevantes.

Senhas, tokens completos e segredos de integrações não devem ser registrados.

Os logs possuem retenção configurável. Eles auxiliam investigação e suporte, mas não substituem ferramentas externas de observabilidade, auditoria legal ou monitoramento de infraestrutura quando essas forem exigidas contratualmente.

## 43. Central de integrações

O painel permite configurar e testar integrações suportadas.

Integrações contempladas:

- Mercado Pago para pagamentos, recorrência e Point;
- Google para autenticação;
- Google Wallet para passes de ingresso;
- TMDB para catálogo de filmes;
- SMTP ou webhook para e-mails;
- Gemini para assistência às campanhas;
- CRM para encaminhamento de contatos e eventos.

Campos sensíveis são armazenados protegidos e apresentados de forma mascarada. O teste de uma integração verifica a conexão possível naquele momento, mas não constitui garantia de disponibilidade futura do fornecedor.

## 44. Aplicativo administrativo para Windows

O Cine Cruzeiro possui uma versão desktop do painel para Windows, desenvolvida em C++ e integrada à interface administrativa oficial.

Capacidades:

- mesma autenticação, permissões e dados do painel web;
- sessão isolada no perfil local do aplicativo;
- suporte a WebSockets e poltronas em tempo real;
- acesso à câmera para leitura de QR Code;
- downloads, uploads, relatórios e impressão;
- tela cheia;
- reconexão após falha da interface incorporada;
- bloqueio de múltiplas instâncias no mesmo terminal;
- abertura de links externos no navegador padrão;
- diagnóstico local de inicialização e conexão;
- atualização automática versionada;
- inventário de dispositivos do computador.

O aplicativo não replica as regras comerciais. Ele funciona como uma interface nativa conectada ao mesmo backend, garantindo que mudanças de preço, sessão, permissão ou disponibilidade sejam respeitadas.

## 45. Detecção de dispositivos locais

O aplicativo Windows pode identificar nomes amigáveis de:

- impressoras instaladas;
- impressora padrão;
- câmeras e leitores reconhecidos pelo Windows;
- portas de comunicação;
- monitores;
- ambiente necessário para exibição do painel.

Essa descoberta serve para facilitar configuração e diagnóstico. A presença de um equipamento não garante integração automática com seu protocolo. Equipamentos que exigem SDK, driver proprietário, licença, comunicação serial específica ou homologação demandam integração própria.

Números de série e conteúdo de páginas não são coletados pelo inventário padrão.

## 46. Atualização do aplicativo Windows

O aplicativo consulta periodicamente a existência de uma versão mais recente.

Quando uma atualização é encontrada:

- os arquivos são baixados para área local controlada;
- a integridade é conferida por hash;
- o operador é informado;
- a instalação exige confirmação;
- o aplicativo substitui os componentes versionados e reinicia.

A atualização depende de conexão, acesso ao servidor de distribuição e permissão do Windows para gravar os arquivos do aplicativo.

## 47. Armazenamento de imagens e arquivos

Filmes publicados, produtos da bomboniere, planos e demais mídias administrativas utilizam armazenamento local persistente.

O armazenamento foi separado das versões de aplicação para que uma atualização do sistema não apague imagens enviadas pelo cinema.

Uploads são validados por tipo e tamanho. Referências externas são evitadas nos cadastros publicados quando a mídia precisa permanecer disponível para site, e-mail, PDF ou histórico.

Anexos de campanha ficam em área privada e possuem limites de quantidade, tamanho e retenção.

## 48. Banco de dados e integridade

O ambiente de produção utiliza PostgreSQL como banco principal.

São persistidos, conforme o módulo:

- usuários e acessos;
- filmes, salas e sessões;
- mapas e reservas de poltronas;
- pedidos, pagamentos e ingressos;
- bomboniere e estoques;
- planos, assinaturas, ciclos e créditos;
- cupons e utilizações;
- campanhas, destinatários e tentativas;
- preferências de marketing;
- integrações e configurações;
- logs e auditoria.

Alterações estruturais utilizam migrações versionadas. O armazenamento alternativo em arquivo existe para desenvolvimento e testes específicos, mas não oferece todas as garantias de fila e concorrência do ambiente PostgreSQL.

## 49. Segurança da aplicação

Controles implementados incluem:

- sessões protegidas por cookie não acessível ao código comum da página;
- controle de acesso por perfil e permissão;
- autenticação em duas etapas administrativa;
- armazenamento seguro de senhas;
- tokens temporários armazenados de forma irreversível;
- limitação de tentativas em áreas sensíveis;
- validação de origem;
- cabeçalhos defensivos;
- criptografia de credenciais de integração;
- mascaramento de segredos no painel;
- validação autenticada das notificações de pagamento;
- processamento idempotente;
- validação de preço, desconto, estoque e capacidade no servidor;
- validação de formato e tamanho de uploads;
- sanitização de HTML de campanhas;
- auditoria de operações administrativas;
- banco de dados de produção separado do código publicado.

A segurança depende também da proteção das contas, dispositivos, e-mails, chaves, domínio, servidor e fornecedores externos. O cinema deve comunicar imediatamente suspeitas de comprometimento.

## 50. Disponibilidade, recuperação e publicação

A aplicação é publicada em versões isoladas. Dados persistentes e uploads ficam separados da versão executável.

Esse modelo permite:

- validar uma nova versão antes da ativação;
- alternar a versão ativa de forma controlada;
- preservar arquivos enviados;
- restaurar versão anterior quando necessário;
- manter processos de frontend e backend supervisionados;
- executar verificações de saúde após a publicação.

Há recursos para backup, restauração e retenção operacional. Frequência, prazo de retenção, objetivo de recuperação, monitoramento contínuo e nível de serviço somente constituem obrigação contratual quando definidos expressamente em cláusula própria.

Documentação, arquivos de desenvolvimento, testes e materiais auxiliares não precisam ser publicados na VPS para o funcionamento da aplicação.

## 51. Testes e controle de qualidade

O projeto possui verificações automatizadas para áreas críticas, incluindo:

- autenticação e autorização;
- segurança administrativa;
- cálculo de cupons;
- fluxo do Clube;
- cálculo financeiro da bomboniere;
- duração e ciclo de sessões;
- imagens locais de filmes;
- documentos de ingresso;
- concorrência de poltronas;
- integração Point;
- campanhas e Gemini;
- webhooks de pagamento;
- concorrência em PostgreSQL;
- aplicativo Windows;
- fluxos essenciais da aplicação.

Testes reduzem risco de regressão, mas não garantem ausência absoluta de defeitos. Alterações de fornecedores, navegadores, sistemas operacionais, regras comerciais e infraestrutura podem exigir nova homologação.

## 52. Identidade visual e experiência

A interface utiliza a identidade do Cine Cruzeiro, com fundo escuro, alto contraste e dourado como destaque principal.

O sistema foi pensado para:

- destacar filmes e sessões reais;
- manter controles administrativos compactos;
- facilitar leitura repetida de dados;
- evitar excesso de decisões técnicas para o operador;
- utilizar ícones reconhecíveis;
- preservar acessibilidade básica;
- evitar rolagem horizontal indevida;
- manter coerência entre site, checkout, e-mails e painel.

Classificações indicativas utilizam cor e identificação visual correspondentes. Duração e classificação são exibidas com separação legível.

São utilizados títulos estruturados, textos alternativos quando aplicáveis, nomes acessíveis para controles relevantes, estados de foco e contraste compatível com o tema. Esses cuidados constituem uma base de acessibilidade, mas não representam certificação formal de conformidade integral com uma norma específica sem auditoria contratada para esse fim.

## 53. Recursos expressamente não incluídos no estado atual

Não fazem parte da capacidade atual, salvo contratação e desenvolvimento adicional:

- compra online sem cadastro de cliente;
- carrinho genérico para acumular sessões fora do fluxo atual de compra;
- emissão automática do antigo sistema de notas fiscais removido;
- classificação tributária definida automaticamente sem orientação contábil;
- validação criptográfica offline de ingressos;
- compatibilidade universal com qualquer impressora, leitor ou equipamento PDV;
- funcionamento de pagamento sem disponibilidade do Mercado Pago;
- funcionamento da IA quando o Gemini estiver indisponível;
- geração de fatos comerciais inventados pela IA;
- rastreamento garantido de abertura e clique sem suporte do provedor de e-mail;
- identificação automática de aniversariantes sem data de nascimento confiável;
- reserva automática de evento privado a partir do formulário;
- garantia de entrega de e-mail quando o provedor rejeitar ou bloquear a mensagem;
- garantia de operação de recursos Google sem credenciais e aprovação válidas.

## 54. Responsabilidades operacionais do cinema

Compete ao Cine Cruzeiro, conforme aplicável:

- manter dados de filmes, salas, preços e sessões corretos;
- revisar informações importadas de terceiros;
- manter credenciais e contas externas válidas;
- definir regras comerciais de cupons e planos;
- revisar campanhas e conteúdos produzidos com IA;
- obter consentimento e respeitar solicitações de descadastro;
- controlar contas e permissões da equipe;
- utilizar senhas fortes e autenticação em duas etapas;
- conferir pagamentos e conciliação com os provedores;
- seguir orientação contábil e fiscal própria;
- manter equipamentos, drivers e conexão em condições de uso;
- comunicar falhas e incidentes com informações suficientes para análise.

## 55. Alterações e evolução de escopo

Correções destinadas a fazer uma funcionalidade contratada cumprir sua regra descrita são diferentes de novas capacidades.

São exemplos de evolução sujeita a análise própria:

- novo provedor de pagamento;
- nova plataforma de IA;
- integração com protocolo proprietário de hardware;
- emissão fiscal completa;
- aplicativo para outro sistema operacional;
- novo modelo de assinatura;
- novo canal de comunicação;
- alterações estruturais em checkout ou Bilheteria;
- relatórios contábeis adicionais;
- rastreamento avançado de campanhas;
- operação em múltiplas unidades ou empresas.

Toda mudança deve considerar impacto em dados existentes, segurança, integrações, homologação, treinamento e infraestrutura.

## 56. Critério geral de aceite

Uma funcionalidade descrita neste anexo é considerada operacional quando:

- pode ser utilizada por um perfil autorizado;
- respeita as regras centrais do servidor;
- persiste ou consulta os dados esperados;
- apresenta estado de sucesso, pendência ou erro de forma compreensível;
- mantém coerência com os módulos dependentes;
- não depende de credencial externa ausente;
- passa pelas verificações aplicáveis ao seu fluxo.

Falha ou indisponibilidade exclusiva de serviço externo não caracteriza, por si só, defeito da regra interna da aplicação, desde que o sistema trate o resultado corretamente e não simule uma conclusão inexistente.

## 57. Observação para incorporação contratual

Este documento descreve o estado funcional da plataforma na data de sua revisão. Para incorporação ao contrato, recomenda-se vinculá-lo a uma versão ou data de entrega e complementar, em cláusulas próprias, os itens comerciais que não pertencem ao código: suporte, horários de atendimento, hospedagem, domínio, custos de terceiros, manutenção evolutiva, prazo de correção, backups, retenção, disponibilidade e responsabilidades sobre dados pessoais.

O texto deve ser revisado pelas partes e, quando necessário, por assessoria jurídica e contábil antes da assinatura.
