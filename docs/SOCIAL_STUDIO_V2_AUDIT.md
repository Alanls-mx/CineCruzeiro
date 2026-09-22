# Auditoria e migração do Social Studio V2

## MANTER

- Página administrativa, navegação, autenticação e permissões.
- Integrações com filmes, sessões, ingressos, bomboniere, Clube e branding.
- Upload seguro, storage existente, histórico e geração de legenda.
- Catálogo editorial e posts prontos.
- Ações de visualizar, duplicar, baixar e excluir.

## REAPROVEITAR

- Entidades e contratos existentes; nenhuma entidade `SocialMovie` ou cadastro paralelo foi criado.
- Contexto do servidor e carregador seguro de imagens.
- Persistência em `settings.socialStudioPosts`.
- Campos de composição e ajustes do editor.
- Renderer legado apenas para compatibilidade e funções auxiliares ainda úteis.

## ADAPTAR

- Registro de templates para definições estruturadas com formatos, estilos, campos, requisitos e função de renderização.
- Histórico para registrar `rendererVersion` e autor sem migrar nem reprocessar registros antigos.
- Preview para debounce de 300 ms, abort de requisições superadas e cache.
- Campanha para usar a API interna e salvar três layouts independentes.
- Recomendação visual por gênero com substituição manual.

## SUBSTITUIR

- Montagem SVG hardcoded do renderer principal pelo pipeline React + Satori + Sharp.
- Cálculo repetido de assets por caches LRU/TTL.
- Cores fixas pela paleta derivada da imagem com fallback institucional.
- Regras tipográficas isoladas por auto-fit centralizado.
- Condições espalhadas por um registry e componentes reutilizáveis.

## REMOVER

Nada legado foi apagado nesta fase. A V2 virou padrão para novas artes, enquanto os arquivos e registros antigos permanecem visualizáveis e baixáveis. A remoção futura do renderer anterior só deve ocorrer após confirmar ausência de consumidores.

## Arquitetura final

- Engine determinística: `backend/services/social-studio/engine`.
- Componentes: `backend/services/social-studio/components`.
- Templates: `backend/services/social-studio/templates`.
- Serviço de campanha: `backend/services/social-studio/services/campaignService.js`.
- Tipos: `backend/services/social-studio/types/index.d.ts`.
- Fachada de migração: `backend/services/socialStudioEngineService.js`.
- Interface: `backend/public/social-studio.js` e `backend/public/social-studio.css`.
- API e persistência: `backend/server.js`.
- Testes: `tests/social-studio-v2.test.mjs` e `tests/social-studio.test.mjs`.

## Decisões técnicas

Satori é compatível com o projeto porque os templates usam um subconjunto controlado de React/CSS, fontes locais e layouts determinísticos. Sharp já fazia parte da aplicação e continua responsável por rasterização, compressão, enquadramento e análise de pixels. Puppeteer não foi adicionado.

O Satori recebe uma árvore React e produz SVG; o Sharp converte esse SVG para PNG ou JPG nas dimensões exatas. Cada formato chama o template com métricas próprias. O resultado não depende de IA.

## Desempenho medido

Em fixture local controlada, o primeiro post levou 359,5 ms, a repetição com caches aquecidos levou 208,8 ms e a campanha paralela de Feed, quadrado e Story concluiu em 397,5 ms. O crescimento de RSS observado durante a medição foi de 75,9 MB. As métricas de cada render continuam disponíveis no retorno interno para acompanhamento em produção.

## Migração

1. V2 convive com os helpers e registros legados.
2. Novas prévias, posts e campanhas usam V2.
3. Novos registros recebem `rendererVersion: "v2"`.
4. Registros antigos preservam URL, download e visualização.
5. Nenhuma arte antiga é regenerada automaticamente.

## Pendências futuras possíveis

- Carrosséis com páginas coordenadas.
- Agendamento e publicação em redes sociais.
- Filas de render para campanhas em grande volume.
- Geração opcional de copy por IA, mantendo layout e branding determinísticos.
- Mais famílias de templates para produto individual e promoção de bomboniere.

## Garantia de isolamento

**O módulo de e-mail não foi alterado.**
