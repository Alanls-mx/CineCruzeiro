"use client";

import React, { useState } from "react";
import { CinemaRoom, RoomSeat, RoomSeatRow, RoomSeatType, RoomSeatLayout } from "@/types/admin";
import { useAdminData } from "@/contexts/AdminDataContext";
import { Plus, Edit2, Trash2, LayoutGrid, Check, Accessibility, CircleUserRound, ShieldAlert, Monitor } from "lucide-react";

export default function RoomsModule() {
  const { content, saveContent } = useAdminData();
  const rooms = content?.rooms || [];

  const [selectedRoom, setSelectedRoom] = useState<CinemaRoom | null>(rooms[0] || null);
  const [editingRoom, setEditingRoom] = useState<CinemaRoom | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Seat selection state in Designer
  const [selectedSeat, setSelectedSeat] = useState<RoomSeat | null>(null);

  const defaultSeatTypes: RoomSeatType[] = [
    { id: "standard", name: "Padrão", color: "#2563eb" },
    { id: "vip", name: "VIP", color: "#facc15" },
    { id: "sofa", name: "Sofá Premium", color: "#e11d48" },
  ];

  const handleOpenAdd = () => {
    const newRoom: CinemaRoom = {
      id: `sala-${Date.now()}`,
      name: `Sala ${rooms.length + 1}`,
      capacity: 64,
      seatSelectionEnabled: true,
      layout: {
        enabled: true,
        screenLabel: "TELA",
        seatTypes: defaultSeatTypes,
        rows: Array.from({ length: 8 }, (_, rIdx) => {
          const rowLabel = String.fromCharCode(65 + rIdx); // A, B, C...
          return {
            id: `row-${rowLabel}`,
            label: rowLabel,
            seats: Array.from({ length: 8 }, (_, sIdx) => ({
              id: `${rowLabel}${sIdx + 1}`,
              label: `${rowLabel}${sIdx + 1}`,
              typeId: "standard",
              enabled: true,
              aisleAfter: sIdx === 3,
              accessibility: "",
            })),
          };
        }),
      },
    };
    setEditingRoom(newRoom);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (room: CinemaRoom) => {
    setEditingRoom(JSON.parse(JSON.stringify(room)));
    setSelectedSeat(null);
    setIsModalOpen(true);
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (rooms.length <= 1) {
      alert("O cinema precisa de pelo menos uma sala cadastrada.");
      return;
    }
    if (!window.confirm("Deseja realmente remover esta sala?")) return;
    const updated = rooms.filter((r) => r.id !== roomId);
    await saveContent({ rooms: updated }, "Sala removida com sucesso.");
    if (selectedRoom?.id === roomId) {
      setSelectedRoom(updated[0] || null);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editingRoom.name) return;

    // Calculate capacity based on enabled seats if layout enabled
    let capacity = editingRoom.capacity;
    if (editingRoom.seatSelectionEnabled && editingRoom.layout?.rows) {
      capacity = editingRoom.layout.rows.reduce(
        (total, row) => total + row.seats.filter((s) => s.enabled !== false).length,
        0
      );
    }

    const finalRoom = { ...editingRoom, capacity };
    const exists = rooms.some((r) => r.id === finalRoom.id);
    let updatedRooms: CinemaRoom[];

    if (exists) {
      updatedRooms = rooms.map((r) => (r.id === finalRoom.id ? finalRoom : r));
    } else {
      updatedRooms = [...rooms, finalRoom];
    }

    const success = await saveContent({ rooms: updatedRooms }, "Sala salva com sucesso.");
    if (success) {
      setSelectedRoom(finalRoom);
      setIsModalOpen(false);
      setEditingRoom(null);
    }
  };

  // Seat Designer Helpers
  const generateNewGrid = (numRows: number, numCols: number, aisleCol: number) => {
    if (!editingRoom) return;
    const newRows: RoomSeatRow[] = Array.from({ length: numRows }, (_, rIdx) => {
      const rowLabel = String.fromCharCode(65 + rIdx);
      return {
        id: `row-${rowLabel}`,
        label: rowLabel,
        seats: Array.from({ length: numCols }, (_, cIdx) => ({
          id: `${rowLabel}${cIdx + 1}`,
          label: `${rowLabel}${cIdx + 1}`,
          typeId: "standard",
          enabled: true,
          aisleAfter: cIdx === aisleCol - 1,
          accessibility: "",
        })),
      };
    });

    setEditingRoom({
      ...editingRoom,
      layout: {
        ...(editingRoom.layout || { enabled: true, seatTypes: defaultSeatTypes }),
        enabled: true,
        rows: newRows,
      },
    });
    setSelectedSeat(null);
  };

  const toggleSeatStatus = (rowId: string, seatId: string) => {
    if (!editingRoom?.layout?.rows) return;
    const nextRows = editingRoom.layout.rows.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        seats: row.seats.map((seat) => {
          if (seat.id !== seatId) return seat;
          const updatedSeat = { ...seat, enabled: seat.enabled === false ? true : false };
          if (selectedSeat?.id === seat.id) setSelectedSeat(updatedSeat);
          return updatedSeat;
        }),
      };
    });
    setEditingRoom({
      ...editingRoom,
      layout: { ...editingRoom.layout, rows: nextRows },
    });
  };

  const updateSelectedSeatAccessibility = (acc: "" | "wheelchair" | "obese") => {
    if (!selectedSeat || !editingRoom?.layout?.rows) return;
    const nextRows = editingRoom.layout.rows.map((row) => ({
      ...row,
      seats: row.seats.map((s) => (s.id === selectedSeat.id ? { ...s, accessibility: acc } : s)),
    }));
    const updated = { ...selectedSeat, accessibility: acc };
    setSelectedSeat(updated);
    setEditingRoom({
      ...editingRoom,
      layout: { ...editingRoom.layout, rows: nextRows },
    });
  };

  const updateSelectedSeatType = (typeId: string) => {
    if (!selectedSeat || !editingRoom?.layout?.rows) return;
    const nextRows = editingRoom.layout.rows.map((row) => ({
      ...row,
      seats: row.seats.map((s) => (s.id === selectedSeat.id ? { ...s, typeId } : s)),
    }));
    const updated = { ...selectedSeat, typeId };
    setSelectedSeat(updated);
    setEditingRoom({
      ...editingRoom,
      layout: { ...editingRoom.layout, rows: nextRows },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-yellow-400" />
            Salas e Mapa de Poltronas
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure capacidade, plantas de assentos interativos, acessibilidade e corredores.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Nova Sala
        </button>
      </div>

      {/* Rooms List / Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                selectedRoom?.id === room.id
                  ? "bg-slate-800/90 border-yellow-400/80 shadow-lg shadow-yellow-400/10"
                  : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                <h3 className="font-black text-white text-base">{room.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="font-bold text-yellow-400">{room.capacity} lugares</span>
                  <span>•</span>
                  <span>{room.seatSelectionEnabled ? "Lugar Marcado" : "Lugar Livre"}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleOpenEdit(room)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Editar Sala e Mapa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteRoom(room.id)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 transition"
                  title="Excluir Sala"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Room Seat Map Preview */}
        <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-white">{selectedRoom?.name || "Selecione uma sala"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capacidade total: <strong className="text-yellow-400">{selectedRoom?.capacity || 0}</strong> poltronas
                </p>
              </div>
              {selectedRoom && (
                <button
                  onClick={() => handleOpenEdit(selectedRoom)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar Mapa
                </button>
              )}
            </div>

            {selectedRoom?.seatSelectionEnabled && selectedRoom.layout?.rows ? (
              <div className="space-y-6">
                {/* Curved Cinema Screen */}
                <div className="flex flex-col items-center">
                  <div className="w-3/4 h-2 bg-gradient-to-r from-transparent via-yellow-400 to-transparent rounded-full shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                    {selectedRoom.layout.screenLabel || "TELA"}
                  </span>
                </div>

                {/* Seats Grid */}
                <div className="overflow-x-auto pb-4">
                  <div className="min-w-fit flex flex-col items-center gap-2">
                    {selectedRoom.layout.rows.map((row) => (
                      <div key={row.id} className="flex items-center gap-2">
                        <span className="w-6 text-xs font-black text-slate-400 text-center">{row.label}</span>
                        <div className="flex items-center gap-1.5">
                          {row.seats.map((seat) => (
                            <React.Fragment key={seat.id}>
                              <div
                                className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center text-[9px] font-black border transition ${
                                  seat.enabled === false
                                    ? "bg-slate-950 border-slate-900 text-slate-700 opacity-40"
                                    : seat.accessibility === "wheelchair"
                                    ? "bg-blue-600 border-blue-400 text-white"
                                    : seat.accessibility === "obese"
                                    ? "bg-purple-600 border-purple-400 text-white"
                                    : "bg-slate-800 border-slate-700 text-slate-300"
                                }`}
                                title={`${seat.label} ${seat.accessibility ? `(${seat.accessibility})` : ""}`}
                              >
                                {seat.accessibility === "wheelchair" ? (
                                  <Accessibility className="w-3.5 h-3.5" />
                                ) : seat.accessibility === "obese" ? (
                                  <CircleUserRound className="w-3.5 h-3.5" />
                                ) : (
                                  <span>{seat.label}</span>
                                )}
                              </div>
                              {seat.aisleAfter && <span className="w-4" />}
                            </React.Fragment>
                          ))}
                        </div>
                        <span className="w-6 text-xs font-black text-slate-400 text-center">{row.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 text-sm font-bold">
                Esta sala está configurada para sessões com lugares livres (sem mapa marcado).
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit / Designer Modal */}
      {isModalOpen && editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-yellow-400" />
                Configurar Sala e Designer de Poltronas
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nome da Sala</label>
                  <input
                    type="text"
                    required
                    value={editingRoom.name}
                    onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Tipo de Lugar</label>
                  <select
                    value={editingRoom.seatSelectionEnabled ? "marked" : "free"}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        seatSelectionEnabled: e.target.value === "marked",
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="marked">Lugar Marcado (Mapa de Poltronas)</option>
                    <option value="free">Lugar Livre (Sem assento)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Texto da Tela</label>
                  <input
                    type="text"
                    value={editingRoom.layout?.screenLabel || "TELA"}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        layout: {
                          ...(editingRoom.layout || { enabled: true, seatTypes: defaultSeatTypes, rows: [] }),
                          screenLabel: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              {/* Generator Controls */}
              {editingRoom.seatSelectionEnabled && (
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-bold text-slate-300">Gerador Rápido de Grade:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateNewGrid(8, 8, 4)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-slate-200"
                      >
                        8x8 (64 lugares)
                      </button>
                      <button
                        type="button"
                        onClick={() => generateNewGrid(10, 12, 6)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-slate-200"
                      >
                        10x12 (120 lugares)
                      </button>
                      <button
                        type="button"
                        onClick={() => generateNewGrid(12, 16, 8)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-slate-200"
                      >
                        12x16 (192 lugares)
                      </button>
                    </div>
                  </div>

                  {/* Interactive Seat Editor */}
                  <div className="overflow-x-auto p-4 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col items-center">
                    <div className="w-1/2 h-1.5 bg-yellow-400/80 rounded-full mb-6" />

                    <div className="min-w-fit flex flex-col items-center gap-2">
                      {editingRoom.layout?.rows?.map((row) => (
                        <div key={row.id} className="flex items-center gap-2">
                          <span className="w-5 text-xs font-black text-slate-500">{row.label}</span>
                          <div className="flex items-center gap-1.5">
                            {row.seats.map((seat) => (
                              <React.Fragment key={seat.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSeat(seat)}
                                  onDoubleClick={() => toggleSeatStatus(row.id, seat.id)}
                                  className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center text-[9px] font-black border transition ${
                                    selectedSeat?.id === seat.id
                                      ? "ring-2 ring-yellow-400 scale-110 z-10"
                                      : ""
                                  } ${
                                    seat.enabled === false
                                      ? "bg-slate-950 border-slate-900 text-slate-700 opacity-40"
                                      : seat.accessibility === "wheelchair"
                                      ? "bg-blue-600 border-blue-400 text-white"
                                      : seat.accessibility === "obese"
                                      ? "bg-purple-600 border-purple-400 text-white"
                                      : "bg-slate-800 border-slate-700 text-slate-200 hover:border-yellow-400/60"
                                  }`}
                                >
                                  {seat.accessibility === "wheelchair" ? (
                                    <Accessibility className="w-3.5 h-3.5" />
                                  ) : seat.accessibility === "obese" ? (
                                    <CircleUserRound className="w-3.5 h-3.5" />
                                  ) : (
                                    <span>{seat.label}</span>
                                  )}
                                </button>
                                {seat.aisleAfter && <span className="w-4" />}
                              </React.Fragment>
                            ))}
                          </div>
                          <span className="w-5 text-xs font-black text-slate-500">{row.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Selected Seat Properties Panel */}
                  {selectedSeat && (
                    <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-black text-yellow-400 uppercase tracking-wider">
                          Poltrona Selecionada: {selectedSeat.label}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Status: {selectedSeat.enabled === false ? "Bloqueada" : "Ativa"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateSelectedSeatAccessibility("")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            !selectedSeat.accessibility ? "bg-yellow-400 text-slate-950" : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          Padrão
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedSeatAccessibility("wheelchair")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            selectedSeat.accessibility === "wheelchair"
                              ? "bg-blue-500 text-white"
                              : "bg-slate-700 text-blue-300"
                          }`}
                        >
                          <Accessibility className="w-3.5 h-3.5" />
                          Cadeirante
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelectedSeatAccessibility("obese")}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            selectedSeat.accessibility === "obese"
                              ? "bg-purple-500 text-white"
                              : "bg-slate-700 text-purple-300"
                          }`}
                        >
                          <CircleUserRound className="w-3.5 h-3.5" />
                          Obeso
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                  Salvar Sala
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
