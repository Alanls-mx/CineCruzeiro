"use client";

import React, { useState } from "react";
import { ConcessionItem } from "@/types";
import { useAdminData } from "@/contexts/AdminDataContext";
import { uploadAdminImage } from "@/services/adminApi";
import { ShoppingBag, Plus, Edit2, Trash2, Search, Coffee, Tag } from "lucide-react";

export default function ConcessionsModule() {
  const { content, saveContent } = useAdminData();
  const concessions = content?.concessions || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<ConcessionItem> | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const filteredItems = concessions.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleOpenAdd = () => {
    setEditingItem({
      id: `item-${Date.now()}`,
      name: "",
      description: "",
      price: 15,
      category: "pipoca",
      active: true,
      imageUrl: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ConcessionItem) => {
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!window.confirm("Deseja realmente remover este produto da bomboniere?")) return;
    const updated = concessions.filter((i) => i.id !== itemId);
    await saveContent({ concessions: updated }, "Produto removido com sucesso.");
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name) return;

    const exists = concessions.some((i) => i.id === editingItem.id);
    let updatedList: ConcessionItem[];

    if (exists) {
      updatedList = concessions.map((i) => (i.id === editingItem.id ? (editingItem as ConcessionItem) : i));
    } else {
      updatedList = [...concessions, editingItem as ConcessionItem];
    }

    const success = await saveContent({ concessions: updatedList }, "Produto salvo com sucesso.");
    if (success) {
      setIsModalOpen(false);
      setEditingItem(null);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const res = await uploadAdminImage(file);
      setEditingItem((prev) => ({ ...prev, imageUrl: res.url }));
    } catch {
      alert("Erro ao fazer upload da imagem.");
    } finally {
      setUploadingImage(false);
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
            <ShoppingBag className="w-5 h-5 text-yellow-400" />
            Produtos da Bomboniere
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Cadastre pipocas, bebidas, doces e combos com fotos e preços.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { id: "all", label: "Todos" },
            { id: "combo", label: "Combos" },
            { id: "pipoca", label: "Pipocas" },
            { id: "bebida", label: "Bebidas" },
            { id: "doce", label: "Doces" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === cat.id
                  ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div className="relative aspect-video w-full bg-slate-950">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-1">
                  <Coffee className="w-8 h-8" />
                  <span className="text-[10px]">Sem imagem</span>
                </div>
              )}

              <div className="absolute top-2.5 left-2.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-900/80 text-yellow-400 border border-yellow-400/30 backdrop-blur-md">
                  {item.category}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-2">
              <div>
                <h3 className="font-black text-white text-base leading-snug">{item.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-lg font-black text-yellow-400 font-mono">{money(item.price)}</span>
                  {Number(item.compareAt || 0) > 0 && (
                    <span className="text-xs text-slate-500 line-through ml-2 font-mono">
                      {money(Number(item.compareAt))}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    title="Editar Produto"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
                    title="Excluir Produto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-yellow-400" />
                {concessions.some((i) => i.id === editingItem.id) ? "Editar Produto" : "Novo Produto"}
              </h4>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Nome do Item</label>
                <input
                  type="text"
                  required
                  value={editingItem.name || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="Ex: Pipoca Média Salgada"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Categoria</label>
                  <select
                    value={editingItem.category || "pipoca"}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="pipoca">Pipoca</option>
                    <option value="bebida">Bebida</option>
                    <option value="combo">Combo</option>
                    <option value="doce">Doce</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Preço (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={editingItem.price || 0}
                    onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={editingItem.description || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="Ex: Pipoca quentinha feita na hora com manteiga especial..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">URL da Foto</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingItem.imageUrl || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                    placeholder="https://... ou /images/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                  <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer border border-slate-700 flex items-center justify-center">
                    {uploadingImage ? "..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    />
                  </label>
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
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
