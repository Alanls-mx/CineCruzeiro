"use client";

import React, { useState } from "react";
import { Movie, Session } from "@/types";
import { useAdminData } from "@/contexts/AdminDataContext";
import { Calendar, Plus, Edit2, Trash2, Clock, Film, Monitor } from "lucide-react";

export default function SessionsModule() {
  const { content, saveContent } = useAdminData();
  const movies = content?.movies || [];
  const rooms = content?.rooms || [];

  const [selectedMovieId, setSelectedMovieId] = useState<string>(movies[0]?.id || "");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<{
    movieId: string;
    session: Partial<Session>;
  } | null>(null);

  const activeMovie = movies.find((m) => m.id === selectedMovieId) || movies[0];

  const handleOpenAdd = () => {
    if (!activeMovie) return;
    setEditingSession({
      movieId: activeMovie.id,
      session: {
        id: `sessao-${Date.now()}`,
        time: "19:00",
        date: new Date().toISOString().slice(0, 10),
        format: "2D Dublado",
        room: rooms[0]?.name || "Sala 1",
        priceFull: 24,
        priceHalf: 12,
        status: "available",
      },
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (movieId: string, session: Session) => {
    setEditingSession({
      movieId,
      session: { ...session },
    });
    setIsModalOpen(true);
  };

  const handleDeleteSession = async (movieId: string, sessionId: string) => {
    if (!window.confirm("Deseja realmente remover esta sessão?")) return;
    const updatedMovies = movies.map((m) => {
      if (m.id !== movieId) return m;
      return {
        ...m,
        sessions: (m.sessions || []).filter((s) => s.id !== sessionId),
      };
    });
    await saveContent({ movies: updatedMovies }, "Sessão removida com sucesso.");
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !editingSession.session.time) return;

    const { movieId, session } = editingSession;
    const targetMovie = movies.find((m) => m.id === movieId);
    if (!targetMovie) return;

    const existingIndex = (targetMovie.sessions || []).findIndex((s) => s.id === session.id);
    let updatedSessions: Session[];

    if (existingIndex >= 0) {
      updatedSessions = targetMovie.sessions.map((s, idx) =>
        idx === existingIndex ? (session as Session) : s
      );
    } else {
      updatedSessions = [...(targetMovie.sessions || []), session as Session];
    }

    const updatedMovies = movies.map((m) =>
      m.id === movieId ? { ...m, sessions: updatedSessions } : m
    );

    const success = await saveContent({ movies: updatedMovies }, "Sessão salva com sucesso.");
    if (success) {
      setIsModalOpen(false);
      setEditingSession(null);
    }
  };

  const money = (val = 0) =>
    Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-400" />
            Programação e Sessões
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Agende horários, salas, formatos (2D/3D) e preços de ingressos por filme.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          disabled={!activeMovie}
          className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 disabled:opacity-50 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Sessão
        </button>
      </div>

      {/* Movies Selector Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {movies.map((movie) => (
          <button
            key={movie.id}
            onClick={() => setSelectedMovieId(movie.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 ${
              (activeMovie?.id === movie.id)
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "bg-slate-900/80 border border-slate-800 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{movie.title}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeMovie?.id === movie.id ? "bg-slate-950 text-yellow-400" : "bg-slate-800 text-slate-400"
              }`}
            >
              {movie.sessions?.length || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Sessions Grid for Active Movie */}
      {activeMovie && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-white">{activeMovie.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Duração: {activeMovie.duration} • Classificação: {activeMovie.rating} anos
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {activeMovie.sessions && activeMovie.sessions.length > 0 ? (
              activeMovie.sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-mono font-black text-yellow-400 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {sess.time}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {sess.format}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-slate-500" />
                      <span>{sess.room}</span>
                      {sess.date && <span>• {sess.date}</span>}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        Inteira: <strong className="text-white">{money(sess.priceFull)}</strong>
                      </span>
                      <span className="text-slate-400">
                        Meia: <strong className="text-white">{money(sess.priceHalf)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-800/60">
                    <button
                      onClick={() => handleOpenEdit(activeMovie.id, sess)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                      title="Editar Sessão"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(activeMovie.id, sess.id)}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
                      title="Excluir Sessão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs font-bold">
                Nenhuma sessão agendada para este filme. Clique em Nova Sessão para começar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit / Add Session Modal */}
      {isModalOpen && editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                Configurar Sessão
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Filme</label>
                <select
                  value={editingSession.movieId}
                  onChange={(e) => setEditingSession({ ...editingSession, movieId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                >
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Horário</label>
                  <input
                    type="time"
                    required
                    value={editingSession.session.time || "19:00"}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        session: { ...editingSession.session, time: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Data (Opcional)</label>
                  <input
                    type="date"
                    value={editingSession.session.date || ""}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        session: { ...editingSession.session, date: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Formato</label>
                  <select
                    value={editingSession.session.format || "2D Dublado"}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        session: { ...editingSession.session, format: e.target.value as any },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="2D Dublado">2D Dublado</option>
                    <option value="2D Legendado">2D Legendado</option>
                    <option value="3D Dublado">3D Dublado</option>
                    <option value="3D Legendado">3D Legendado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Sala</label>
                  <select
                    value={editingSession.session.room || rooms[0]?.name || "Sala 1"}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        session: { ...editingSession.session, room: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Preço Inteira (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingSession.session.priceFull || 24}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        session: { ...editingSession.session, priceFull: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Preço Meia (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editingSession.session.priceHalf || 12}
                    onChange={(e) =>
                      setEditingSession({
                        ...editingSession,
                        session: { ...editingSession.session, priceHalf: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
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
                  Salvar Sessão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
