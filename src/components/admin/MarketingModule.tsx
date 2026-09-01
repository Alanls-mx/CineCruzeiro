"use client";

import React, { useState } from "react";
import { MarketingBanner, MarketingCoupon } from "@/types/admin";
import { useAdminData } from "@/contexts/AdminDataContext";
import { uploadAdminImage } from "@/services/adminApi";
import { Tag, Plus, Edit2, Trash2, Image as ImageIcon, CheckCircle, Percent } from "lucide-react";

export default function MarketingModule() {
  const { content, saveContent } = useAdminData();
  const coupons = content?.coupons || [];
  const banners = content?.banners || [];

  const [activeTab, setActiveTab] = useState<"coupons" | "banners">("coupons");

  // Coupon state
  const [editingCoupon, setEditingCoupon] = useState<Partial<MarketingCoupon> | null>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);

  // Banner state
  const [editingBanner, setEditingBanner] = useState<Partial<MarketingBanner> | null>(null);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Coupon handlers
  const handleOpenAddCoupon = () => {
    setEditingCoupon({
      id: `cupom-${Date.now()}`,
      code: "",
      type: "percent",
      value: 10,
      active: true,
      validUntil: "",
    });
    setIsCouponModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoupon || !editingCoupon.code) return;

    const code = editingCoupon.code.trim().toUpperCase();
    const finalCoupon = { ...editingCoupon, code } as MarketingCoupon;
    const exists = coupons.some((c) => c.id === finalCoupon.id);
    let updatedCoupons: MarketingCoupon[];

    if (exists) {
      updatedCoupons = coupons.map((c) => (c.id === finalCoupon.id ? finalCoupon : c));
    } else {
      updatedCoupons = [...coupons, finalCoupon];
    }

    const success = await saveContent({ coupons: updatedCoupons }, "Cupom salvo com sucesso.");
    if (success) {
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm("Deseja realmente remover este cupom?")) return;
    const updated = coupons.filter((c) => c.id !== couponId);
    await saveContent({ coupons: updated }, "Cupom removido.");
  };

  // Banner handlers
  const handleOpenAddBanner = () => {
    setEditingBanner({
      id: `banner-${Date.now()}`,
      title: "",
      subtitle: "",
      imageUrl: "",
      linkUrl: "",
      active: true,
      sortOrder: banners.length + 1,
    });
    setIsBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner || !editingBanner.title) return;

    const finalBanner = editingBanner as MarketingBanner;
    const exists = banners.some((b) => b.id === finalBanner.id);
    let updatedBanners: MarketingBanner[];

    if (exists) {
      updatedBanners = banners.map((b) => (b.id === finalBanner.id ? finalBanner : b));
    } else {
      updatedBanners = [...banners, finalBanner];
    }

    const success = await saveContent({ banners: updatedBanners }, "Banner salvo com sucesso.");
    if (success) {
      setIsBannerModalOpen(false);
      setEditingBanner(null);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    if (!window.confirm("Deseja realmente remover este banner?")) return;
    const updated = banners.filter((b) => b.id !== bannerId);
    await saveContent({ banners: updated }, "Banner removido.");
  };

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    try {
      const res = await uploadAdminImage(file);
      setEditingBanner((prev) => ({ ...prev, imageUrl: res.url }));
    } catch {
      alert("Erro ao fazer upload da imagem.");
    } finally {
      setUploadingBanner(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-yellow-400" />
            Marketing e Promoções
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie cupons de desconto para clientes e banners promocionais na home.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("coupons")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "coupons"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Percent className="w-4 h-4" />
            Cupons de Desconto
          </button>
          <button
            onClick={() => setActiveTab("banners")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "banners"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Banners do Site
          </button>
        </div>
      </div>

      {/* TAB 1: COUPONS */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleOpenAddCoupon}
              className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-yellow-400/20"
            >
              <Plus className="w-4 h-4" />
              Novo Cupom
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-black text-yellow-400 px-2.5 py-1 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
                      {coupon.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        coupon.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {coupon.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-bold">
                    Desconto:{" "}
                    <strong className="text-white">
                      {coupon.type === "percent" ? `${coupon.value}%` : `R$ ${coupon.value.toFixed(2)}`}
                    </strong>
                  </p>

                  {coupon.validUntil && (
                    <p className="text-[11px] text-slate-500">
                      Válido até: {new Date(coupon.validUntil).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      setEditingCoupon({ ...coupon });
                      setIsCouponModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    title="Editar Cupom"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
                    title="Excluir Cupom"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: BANNERS */}
      {activeTab === "banners" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleOpenAddBanner}
              className="px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-yellow-400/20"
            >
              <Plus className="w-4 h-4" />
              Novo Banner
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="relative aspect-[21/9] w-full bg-slate-950">
                  {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-white text-sm">{banner.title}</h4>
                    {banner.subtitle && <p className="text-xs text-slate-400 mt-0.5">{banner.subtitle}</p>}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingBanner({ ...banner });
                        setIsBannerModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coupon Modal */}
      {isCouponModalOpen && editingCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-yellow-400" />
                Configurar Cupom
              </h4>
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Código do Cupom</label>
                <input
                  type="text"
                  required
                  placeholder="EX: PROMO10"
                  value={editingCoupon.code || ""}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-mono font-bold text-yellow-400 uppercase tracking-wider focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Tipo de Desconto</label>
                  <select
                    value={editingCoupon.type || "percent"}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                  >
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor Fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={editingCoupon.value || 0}
                    onChange={(e) => setEditingCoupon({ ...editingCoupon, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Válido Até (Opcional)</label>
                <input
                  type="date"
                  value={editingCoupon.validUntil || ""}
                  onChange={(e) => setEditingCoupon({ ...editingCoupon, validUntil: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black transition"
                >
                  Salvar Cupom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Banner Modal */}
      {isBannerModalOpen && editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-yellow-400" />
                Configurar Banner
              </h4>
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={editingBanner.title || ""}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Subtítulo / Descrição</label>
                <input
                  type="text"
                  value={editingBanner.subtitle || ""}
                  onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Imagem do Banner</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingBanner.imageUrl || ""}
                    onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })}
                    placeholder="https://... ou /images/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                  />
                  <label className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer border border-slate-700 flex items-center justify-center">
                    {uploadingBanner ? "..." : "Upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Link de Destino</label>
                <input
                  type="text"
                  placeholder="/filmes ou https://..."
                  value={editingBanner.linkUrl || ""}
                  onChange={(e) => setEditingBanner({ ...editingBanner, linkUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black transition"
                >
                  Salvar Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
