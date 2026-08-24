import { Movie } from "@/types";

export const FEATURED_MOVIE: Movie = {
  id: "duna-parte-2",
  title: "Duna: Parte 2",
  originalTitle: "Dune: Part Two",
  synopsis:
    "Paul Atreides se une a Chani e aos Fremen enquanto busca vingança contra os conspiradores que destruíram sua família. Diante de uma escolha entre o amor de sua vida e o destino do universo, ele luta para evitar um futuro terrível que só ele pode prever.",
  duration: "2h 46m",
  genre: ["Ficção Científica", "Aventura", "Ação"],
  rating: "14",
  posterUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop",
  backdropUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop",
  trailerYoutubeId: "Way9Dexny3w",
  isHighlight: true,
  tag: "Destaque da Semana",
  sessions: [
    {
      id: "duna-1",
      time: "16:00",
      format: "2D Dublado",
      room: "Sala Cruzeiro (Laser 4K)",
      priceFull: 10.0,
      priceHalf: 10.0,
      status: "available",
    },
    {
      id: "duna-2",
      time: "19:15",
      format: "2D Legendado",
      room: "Sala Cruzeiro (Laser 4K)",
      priceFull: 10.0,
      priceHalf: 10.0,
      status: "filling_fast",
    },
    {
      id: "duna-3",
      time: "22:15",
      format: "2D Legendado",
      room: "Sala Cruzeiro (Laser 4K)",
      priceFull: 10.0,
      priceHalf: 10.0,
      status: "available",
    },
  ],
};

export const MOVIES_NOW_PLAYING: Movie[] = [
  FEATURED_MOVIE,
  {
    id: "divertida-mente-2",
    title: "Divertida Mente 2",
    originalTitle: "Inside Out 2",
    synopsis:
      "A mente da recém-adolescente Riley passa por uma reforma repentina para abrir espaço para novas emoções: Ansiedade, Inveja, Tédio e Vergonha chegam para bagunçar a sede.",
    duration: "1h 36m",
    genre: ["Animação", "Família", "Comédia"],
    rating: "L",
    posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1920&auto=format&fit=crop",
    trailerYoutubeId: "VWavstJydZU",
    tag: "Sessão Família",
    sessions: [
      {
        id: "dm2-1",
        time: "14:00",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10.0,
        priceHalf: 10.0,
        status: "available",
      },
      {
        id: "dm2-2",
        time: "16:15",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10.0,
        priceHalf: 10.0,
        status: "available",
      },
    ],
  },
  {
    id: "deadpool-e-wolverine",
    title: "Deadpool & Wolverine",
    originalTitle: "Deadpool & Wolverine",
    synopsis:
      "Wolverine está se recuperando quando cruza com o desbocado Deadpool. Juntos, eles formam uma equipe improvável para derrotar um inimigo em comum e salvar o multiverso.",
    duration: "2h 08m",
    genre: ["Ação", "Comédia", "Super-Herói"],
    rating: "18",
    posterUrl: "https://images.unsplash.com/photo-1568876694728-451bbf694b83?q=80&w=800&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1920&auto=format&fit=crop",
    trailerYoutubeId: "73_1biulkYk",
    tag: "Estreia",
    sessions: [
      {
        id: "dw-1",
        time: "18:30",
        format: "2D Dublado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10.0,
        priceHalf: 10.0,
        status: "filling_fast",
      },
      {
        id: "dw-2",
        time: "21:00",
        format: "2D Legendado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10.0,
        priceHalf: 10.0,
        status: "available",
      },
    ],
  },
  {
    id: "coringa-delirio-a-dois",
    title: "Coringa: Delírio a Dois",
    originalTitle: "Joker: Folie à Deux",
    synopsis:
      "Arthur Fleck está internado no Hospital Estadual de Arkham aguardando julgamento pelos seus crimes. Enquanto lida com sua dupla identidade, Arthur encontra não apenas o verdadeiro amor, mas a música que sempre esteve nele.",
    duration: "2h 18m",
    genre: ["Drama", "Suspense", "Música"],
    rating: "16",
    posterUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1920&auto=format&fit=crop",
    trailerYoutubeId: "_OKAwz2NiJs",
    tag: "Últimos Dias",
    sessions: [
      {
        id: "coringa-1",
        time: "19:00",
        format: "2D Legendado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10.0,
        priceHalf: 10.0,
        status: "available",
      },
      {
        id: "coringa-2",
        time: "21:45",
        format: "2D Legendado",
        room: "Sala Cruzeiro (Laser 4K)",
        priceFull: 10.0,
        priceHalf: 10.0,
        status: "available",
      },
    ],
  },
];

export const UPCOMING_MOVIES: Movie[] = [
  {
    id: "gladiador-2",
    title: "Gladiador II",
    originalTitle: "Gladiator II",
    synopsis:
      "Anos após testemunhar a morte do reverenciado herói Maximus pelas mãos de seu tio, Lucius deve entrar no Coliseu após sua casa ser conquistada pelos imperadores tirânicos que agora lideram Roma.",
    duration: "2h 28m",
    genre: ["Ação", "Épico", "Drama"],
    rating: "16",
    posterUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=800&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1920&auto=format&fit=crop",
    tag: "Em Breve",
    sessions: [],
  },
  {
    id: "wicked",
    title: "Wicked: Parte 1",
    originalTitle: "Wicked",
    synopsis:
      "A história não contada das bruxas de Oz. Elphaba, uma jovem incompreendida por causa de sua pele verde incomum, e Glinda, uma jovem popular e privilegiada, se encontram na Universidade de Shiz.",
    duration: "2h 40m",
    genre: ["Fantasia", "Musical", "Aventura"],
    rating: "L",
    posterUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop",
    backdropUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1920&auto=format&fit=crop",
    tag: "Em Breve",
    sessions: [],
  },
];

export const CINEMA_DIFFERENTIATORS = [
  {
    title: "Sem Filas Intermináveis",
    description:
      "Escolha o filme, chame no WhatsApp, pague com Pix e receba o ingresso digital na hora. Sem baixar apps pesados.",
    icon: "Clock",
    highlight: "30s no celular",
  },
  {
    title: "Preço Justo de Bairro",
    description:
      "Ingresso promocional permanente por apenas R$ 10,00. Sem taxas abusivas de conveniência que encarecem o seu passeio.",
    icon: "BadgePercent",
    highlight: "Taxa Zero no Pix",
  },
  {
    title: "Pipoca Quentinha e Artesanal",
    description:
      "Milho selecionado, estourado na manteiga de verdade e combos que não custam o preço de um jantar.",
    icon: "Popcorn",
    highlight: "Combo a R$ 21",
  },
  {
    title: "Ocupação por Ordem de Chegada",
    description:
      "Ambiente democrático e acolhedor. Chegue 15 minutos antes, escolha seu lugar preferido sem custo extra de cadeira VIP.",
    icon: "Armchair",
    highlight: "Sala Cruzeiro 4K Laser",
  },
];
