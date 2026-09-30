const POSTER_BRANDS = Object.freeze({
  "cine-estacao-amparo": {
    signature: "/images/social-studio/signatures/cine-estacao-amparo-white-3d.png",
    website: "www.cineestacaoamparo.com.br"
  },
  "cinemax-piraju": {
    signature: "/images/social-studio/signatures/cinemax-piraju-white-3d.png",
    website: "www.cinemaxpiraju.com.br"
  },
  "cine-gama": {
    signature: "/images/social-studio/signatures/cine-gama-white-3d.png",
    website: "www.cinegama.com.br"
  },
  "cinemania-cosmopolis": {
    signature: "/images/social-studio/signatures/cinemania-cosmopolis-white-3d.png",
    website: "www.cinemaniacosmopolis.com.br"
  }
});

function studioPosterBrand(slug) {
  return POSTER_BRANDS[String(slug || "")] || null;
}

module.exports = { studioPosterBrand };
