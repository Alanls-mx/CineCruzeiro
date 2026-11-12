# Cine Roxy · Passos, MG

## Identidade e conteúdo

- Instância: `cine-roxy`, rota `/projects/cine-roxy`.
- Identidade nova: monograma `R`, wordmark vetorial e paleta vermelho, creme e preto. Os SVG estão em `public/images/cine-roxy/`; `node scripts/prepare-roxy-brand-assets.cjs` gera os formatos de legado usados pelo Admin e pelos PDFs.
- A fotografia da sala foi obtida da página [O Cine Roxy](https://www.cineroxypassos.com.br/sobre). É apresentada como imagem do cinema, sem ser descrita como registro da inauguração.
- A página do próprio cinema informa que José Figueiredo inaugurou o Cine Roxy em 22/11/1945 com *Por Quem os Sinos Dobram*. A [Prefeitura de Passos](https://www.passos.mg.gov.br/historia-de-passos) registra um Cine Rex em 1939, descrito como atual Cine Roxy. A página pública usa apenas a data de inauguração do Roxy atribuída pelo cinema.
- Endereço e CEP: [Cine Roxy](https://www.cineroxypassos.com.br/home), Praça Monsenhor Messias Bragança, 178, Centro, Passos–MG, 37900-084.
- Enquanto a nova instância não tiver sessões e contratos de pagamento configurados, a página pública mostra a história e direciona para a [programação publicada no AdoroCinema](https://www.adorocinema.com/programacao/cinema-F0894/). Não anuncia ingressos vendidos pela nova instância.

## Instalação

O Cine Roxy usa PostgreSQL, diretório `shared`, portas, segredos e processos PM2 próprios. Não copiar banco, chaves de pagamento, pedidos, sessões ou credenciais de outro cinema. O backend não deve operar em `PAYMENTS_MODE=test` em uma URL pública. O catálogo inicia vazio, sem vendas. Antes de habilitar venda online, configurar provedor, sessão, preço, sala e canais de suporte do próprio Cine Roxy e validar o fluxo com os responsáveis.

O script `scripts/apply-instance-brand.mjs` aplica os nomes e caminhos da instalação em uma cópia da release. `branding/cine-roxy/` contém os assets para `public/` e `backend/public/`. O build usa `NEXT_PUBLIC_CINEMA_SLUG=cine-roxy`, `NEXT_PUBLIC_BASE_PATH=/projects/cine-roxy` e `NEXT_PUBLIC_SITE_URL=https://lumixengine.com/projects/cine-roxy`.
