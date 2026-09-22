const { renderMovieTemplate } = require("./movie");
const { renderClub, renderConcession, renderOnlineTicket } = require("./commercial");

const FORMATS = ["feed_portrait", "square", "story"];
const MOVIE_STYLES = ["cinematic", "impact", "clean", "minimal"];
const movieFields = ["movie", "title", "subtitle", "date", "auxiliaryText", "cta", "image", "advanced", "caption"];

const V2_TEMPLATES = Object.freeze([
  { id: "movie-premiere", name: "Estreia", type: "movie", category: "FILMES", description: "Data de estreia com impacto cinematográfico.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: movieFields, requirements: { movie: true }, render: renderMovieTemplate },
  { id: "movie-highlight", name: "Filme em destaque", type: "movie", category: "FILMES", description: "Título e sessões com a imagem em primeiro plano.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: movieFields, requirements: { movie: true }, render: renderMovieTemplate },
  { id: "movie-price", name: "Ingresso + preço", type: "movie", category: "FILMES", description: "Preço real com estado próprio quando indisponível.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: [...movieFields.slice(0, 3), "price", ...movieFields.slice(4)], requirements: { movie: true }, render: renderMovieTemplate },
  { id: "movie-presale", name: "Pré-venda", type: "movie", category: "FILMES", description: "Abertura antecipada de vendas com data e chamada.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: movieFields, requirements: { movie: true }, render: renderMovieTemplate },
  { id: "online-ticket", name: "Compra online", type: "institutional", category: "VENDAS", description: "Passos simples para comprar ingresso digital.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: ["title", "subtitle", "auxiliaryText", "cta", "image", "advanced", "caption"], requirements: {}, render: renderOnlineTicket },
  { id: "concession-combo", name: "Produto ou combo", type: "concession", category: "BOMBONIERE", description: "Imagem, composição e preço cadastrados.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: ["concession", "title", "subtitle", "price", "auxiliaryText", "cta", "image", "advanced", "caption"], requirements: { concession: true }, render: renderConcession },
  { id: "club-plan", name: "Plano do clube", type: "club", category: "CLUBE", description: "Benefícios e mensalidade do plano selecionado.", formats: FORMATS, variants: MOVIE_STYLES, styles: MOVIE_STYLES, fields: ["clubPlan", "title", "subtitle", "price", "auxiliaryText", "cta", "image", "advanced", "caption"], requirements: { clubPlan: true }, render: renderClub }
]);

function templateById(id) {
  const normalized = id === "cinema-club" ? "club-plan" : id;
  return V2_TEMPLATES.find((template) => template.id === normalized) || V2_TEMPLATES[0];
}

module.exports = { FORMATS, MOVIE_STYLES, V2_TEMPLATES, templateById };
