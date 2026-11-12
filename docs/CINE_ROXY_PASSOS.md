# Cine Roxy · Passos, MG

## Identidade e conteúdo

- Instância: `cine-roxy`, rota `/projects/cine-roxy`.
- Identidade nova: monograma `R`, wordmark vetorial e paleta vermelho, creme e preto. Os SVG estão em `public/images/cine-roxy/`; `node scripts/prepare-roxy-brand-assets.cjs` gera os formatos de legado usados pelo Admin e pelos PDFs.
- A fotografia da sala foi obtida da página [O Cine Roxy](https://www.cineroxypassos.com.br/sobre). É apresentada como imagem do cinema, sem ser descrita como registro da inauguração.
- A página do próprio cinema informa que José Figueiredo inaugurou o Cine Roxy em 22/11/1945 com *Por Quem os Sinos Dobram*. A [Prefeitura de Passos](https://www.passos.mg.gov.br/historia-de-passos) registra um Cine Rex em 1939, descrito como atual Cine Roxy. O texto curto da marca usa 1945, a data de inauguração do Roxy atribuída pelo cinema.
- Endereço e CEP: [Cine Roxy](https://www.cineroxypassos.com.br/home), Praça Monsenhor Messias Bragança, 178, Centro, Passos–MG, 37900-084.
- A página mantém a composição de hero, catálogo, navegação e rodapé das demais instalações. A página inicial usa os mesmos componentes de destaque e grade de filmes do Cine Cruzeiro; mudam apenas logotipo, paleta e bordas. O filme em destaque vem do catálogo da instalação.

## Instalação

O Cine Roxy usa PostgreSQL, diretório `shared`, portas, segredos e processos PM2 próprios. Por solicitação do proprietário, a instalação recebe uma cópia de dados do Cine Cruzeiro, incluindo histórico e credenciais do mesmo recebedor. A cópia não altera a origem. Referências de marca e URLs de assets devem apontar para o Roxy, segredos criptografados devem ser recriptografados com a chave da instalação e operações pendentes da origem não podem ser repetidas na cópia. O backend não opera em `PAYMENTS_MODE=test` em URL pública.

O script `scripts/apply-instance-brand.mjs` aplica os nomes e caminhos da instalação em uma cópia da release. `branding/cine-roxy/` contém os assets para `public/` e `backend/public/`. O build usa `NEXT_PUBLIC_CINEMA_SLUG=cine-roxy`, `NEXT_PUBLIC_BASE_PATH=/projects/cine-roxy` e `NEXT_PUBLIC_SITE_URL=https://lumixengine.com/projects/cine-roxy`.
