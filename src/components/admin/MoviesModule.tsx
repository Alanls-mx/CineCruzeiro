"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Movie, AgeRating } from "@/types";
import { useAdminData } from "@/contexts/AdminDataContext";
import { searchTmdbMovies, fetchTmdbMovieDetails, uploadAdminImage } from "@/services/adminApi";
import { Plus, Edit2, Trash2, Search, Film, Sparkles, X, Check, Eye, EyeOff } from "lucide-react";

export default function MoviesModule() {
  const { content, saveContent } = useAdminData();
  const movies = content?.movies || [];

  const [editingMovie, setEditingMovie] = useState<Partial<Movie> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // TMDB Search Modal state
  const [isTmdbOpen, setIsTmdbOpen] = useState(false);
  const [tmdbQuery, setTmdbQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingBackdrop, setUploadingBackdrop] = useState(false);

  const filteredMovies = movies.filter((m) => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (searchTerm && !m.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingMovie({
      id: `filme-${Date.now()}`,
      title: "",
      synopsis: "",
      duration: "2h 00m",
      genre: ["Ação"],
      rating: "14",
      posterUrl: "",
      backdropUrl: "",
      status: "now_playing",
      tag: "Em Breve",
      sessions: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (movie: Movie) => {
    setEditingMovie({ ...movie });
    setIsModalOpen(true);
  };

  const handleDelete = async (movieId: string) => {
    if (!window.confirm("Deseja realmente remover este filme da programação?")) return;
    const updated = movies.filter((m) => m.id !== movieId);
    await saveContent({ movies: updated }, "Filme removido com sucesso.");
  };

  const handleSaveMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMovie || !editingMovie.title) return;

    let updatedList: Movie[];
    const exists = movies.some((m) => m.id === editingMovie.id);
    if (exists) {
      updatedList = movies.map((m) => (m.id === editingMovie.id ? (editingMovie as Movie) : m));
    } else {
      updatedList = [...movies, editingMovie as Movie];
    }

    const success = await saveContent({ movies: updatedList }, "Filme salvo com sucesso.");
    if (success) {
      setIsModalOpen(false);
      setEditingMovie(null);
    }
  };

  const handleTmdbSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmdbQuery.trim()) return;
    setTmdbLoading(true);
    try {
      const res = await searchTmdbMovies(tmdbQuery);
      setTmdbResults(res);
    } catch {
      setTmdbResults([]);
    } finally {
      setTmdbLoading(false);
    }
  };

  const handleSelectTmdb = async (tmdbMovie: any) => {
    try {
      const details = await fetchTmdbMovieDetails(tmdbMovie.id);
      const durationHours = details.runtime ? Math.floor(details.runtime / 60) : 2;
      const durationMins = details.runtime ? details.runtime % 60 : 0;
      const genres = details.genres ? details.genres.map((g: any) => g.name) : ["Ação"];

      setEditingMovie((prev) => ({
        ...prev,
        title: details.title || tmdbMovie.title,
        originalTitle: details.original_title,
        synopsis: details.overview || tmdbMovie.overview || "",
        duration: `${durationHours}h ${durationMins.toString().padStart(2, "0")}m`,
        genre: genres,
        posterUrl: tmdbMovie.poster_path ? `https://image.tmdb.org/t/p/w780${tmdbMovie.poster_path}` : prev?.posterUrl || "",
        backdropUrl: tmdbMovie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbMovie.backdrop_path}` : prev?.backdropUrl || "",
        releaseDate: details.release_date || tmdbMovie.release_date,
      }));
      setIsTmdbOpen(false);
    } catch (err) {
      alert("Erro ao importar metadados do TMDB.");
    }
  };

  const handleImageUpload = async (file: File, type: "poster" | "backdrop") => {
    const isPoster = type === "poster";
    if (isPoster) setUploadingPoster(true);
    else setUploadingBackdrop(true);

    try {
      const res = await uploadAdminImage(file);
      setEditingMovie((prev) => ({
        ...prev,
        [isPoster ? "posterUrl" : "backdropUrl"]: res.url,
      }));
    } catch (err) {
      alert("Erro no upload da imagem.");
    } finally {
      if (isPoster) setUploadingPoster(false);
      else setUploadingBackdrop(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar filmes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-yellow-400"
          >
            <option value="all">Todos os status</option>
            <option value="now_playing">Em cartaz</option>
            <option value="upcoming">Em breve</option>
            <option value="hidden">Oculto</option>
          </select>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Novo Filme
        </button>
      </div>

      {/* Movies Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredMovies.map((movie) => (
          <div
            key={movie.id}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col group"
          >
            <div className="relative aspect-[2/3] w-full bg-slate-950">
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Film className="w-10 h-10" />
                  <span className="text-xs">Sem pôster</span>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-3 left-3">
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                    movie.status === "now_playing"
                      ? "bg-emerald-500/80 text-white"
                      : movie.status === "upcoming"
                      ? "bg-blue-500/80 text-white"
                      : "bg-slate-800/80 text-slate-400"
                  }`}
                >
                  {movie.status === "now_playing" ? "Em Cartaz" : movie.status === "upcoming" ? "Em Breve" : "Oculto"}
                </span>
              </div>

              {/* Tag Badge */}
              {movie.tag && (
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-400 text-slate-950">
                    {movie.tag}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-black text-white text-base leading-snug line-clamp-1">{movie.title}</h3>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 font-medium">
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-yellow-400 font-black text-[10px] border border-yellow-400/20">
                    {movie.rating}
                  </span>
                  <span>{movie.duration}</span>
                  <span>•</span>
                  <span className="truncate">{Array.isArray(movie.genre) ? movie.genre.join(", ") : movie.genre}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4">
                <span className="text-xs text-slate-500 font-bold">
                  {movie.sessions?.length || 0} sessões ativas
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(movie)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                    title="Editar Filme"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(movie.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 transition"
                    title="Excluir Filme"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Movie Modal */}
      {isModalOpen && editingMovie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-yellow-400" />
                {movies.some((m) => m.id === editingMovie.id) ? "Editar Filme" : "Novo Filme"}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTmdbOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Importar do TMDB
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveMovie} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Título</label>
                  <input
                    type="text"
                    required
                    value={editingMovie.title || ""}
                    onChange={(e) => setEditingMovie({ ...editingMovie, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Título Original</label>
                  <input
                    type="text"
                    value={editingMovie.originalTitle || ""}
                    onChange={(e) => setEditingMovie({ ...editingMovie, originalTitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Duração</label>
                  <input
                    type="text"
                    value={editingMovie.duration || ""}
                    onChange={(e) => setEditingMovie({ ...editingMovie, duration: e.target.value })}
                    placeholder="2h 15m"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Classificação</label>
                  <select
                    value={editingMovie.rating || "14"}
                    onChange={(e) => setEditingMovie({ ...editingMovie, rating: e.target.value as AgeRating })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="L">Livre (L)</option>
                    <option value="10">10 anos</option>
                    <option value="12">12 anos</option>
                    <option value="14">14 anos</option>
                    <option value="16">16 anos</option>
                    <option value="18">18 anos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editingMovie.status || "now_playing"}
                    onChange={(e) => setEditingMovie({ ...editingMovie, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="now_playing">Em Cartaz</option>
                    <option value="upcoming">Em Breve</option>
                    <option value="hidden">Oculto</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Gêneros (separados por vírgula)</label>
                <input
                  type="text"
                  value={Array.isArray(editingMovie.genre) ? editingMovie.genre.join(", ") : editingMovie.genre || ""}
                  onChange={(e) =>
                    setEditingMovie({
                      ...editingMovie,
                      genre: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Ação, Ficção Científica, Aventura"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Sinopse</label>
                <textarea
                  rows={3}
                  value={editingMovie.synopsis || ""}
                  onChange={(e) => setEditingMovie({ ...editingMovie, synopsis: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">URL do Pôster</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingMovie.posterUrl || ""}
                      onChange={(e) => setEditingMovie({ ...editingMovie, posterUrl: e.target.value })}
                      placeholder="https://... ou /images/..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                    />
                    <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer border border-slate-700 flex items-center justify-center">
                      {uploadingPoster ? "..." : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "poster")}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">URL do Backdrop (Fundo)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingMovie.backdropUrl || ""}
                      onChange={(e) => setEditingMovie({ ...editingMovie, backdropUrl: e.target.value })}
                      placeholder="https://... ou /images/..."
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                    />
                    <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer border border-slate-700 flex items-center justify-center">
                      {uploadingBackdrop ? "..." : "Upload"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "backdrop")}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">ID do Trailer no YouTube</label>
                  <input
                    type="text"
                    value={editingMovie.trailerYoutubeId || ""}
                    onChange={(e) => setEditingMovie({ ...editingMovie, trailerYoutubeId: e.target.value })}
                    placeholder="Ex: dQw4w9WgXcQ"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Tag Promocional</label>
                  <select
                    value={editingMovie.tag || ""}
                    onChange={(e) => setEditingMovie({ ...editingMovie, tag: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="">Sem tag</option>
                    <option value="Pré-Estreia">Pré-Estreia</option>
                    <option value="Estreia">Estreia</option>
                    <option value="Destaque da Semana">Destaque da Semana</option>
                    <option value="Últimos Dias">Últimos Dias</option>
                    <option value="Em Breve">Em Breve</option>
                    <option value="Sessão Família">Sessão Família</option>
                    <option value="Clássico">Clássico</option>
                    <option value="Reexibição">Reexibição</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black transition shadow-lg shadow-yellow-400/20"
                >
                  Salvar Filme
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TMDB Search Modal */}
      {isTmdbOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Buscar Filme no TMDB
              </h4>
              <button
                onClick={() => setIsTmdbOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTmdbSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Avatar, Gladiador, Interestelar..."
                value={tmdbQuery}
                onChange={(e) => setTmdbQuery(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
              />
              <button
                type="submit"
                disabled={tmdbLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {tmdbLoading ? "Buscando..." : "Buscar"}
              </button>
            </form>

            <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-slate-800/60">
              {tmdbResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectTmdb(item)}
                  className="pt-2 flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition"
                >
                  <div className="w-12 h-16 bg-slate-950 rounded overflow-hidden flex-shrink-0 relative">
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-600">N/A</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-white text-sm truncate">{item.title}</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.release_date ? new Date(item.release_date).getFullYear() : "—"}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.overview}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
