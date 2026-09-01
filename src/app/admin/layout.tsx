"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminDataProvider, useAdminData } from "@/contexts/AdminDataContext";
import {
  TrendingUp,
  Film,
  LayoutGrid,
  Calendar,
  ShoppingCart,
  ShoppingBag,
  Tag,
  Crown,
  Users,
  Link2,
  Activity,
  LogOut,
  RefreshCw,
  Menu,
  X,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isOwner } = useAdminAuth();
  const { saveStatus, statusMessage, refreshContent, toasts, removeToast } = useAdminData();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // If on /admin/login, render children directly without the dashboard shell
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#060a12] text-white">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">Carregando painel...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: TrendingUp },
    { id: "movies", label: "Filmes", icon: Film },
    { id: "rooms", label: "Salas", icon: LayoutGrid },
    { id: "sessions", label: "Ingressos", icon: Calendar },
    { id: "orders", label: "Bilheteria", icon: ShoppingCart },
    { id: "concessions", label: "Bomboniere", icon: ShoppingBag },
    { id: "marketing", label: "Marketing", icon: Tag },
    { id: "club", label: "Clube", icon: Crown },
    { id: "users", label: "Contas", icon: Users },
    ...(isOwner ? [{ id: "integrations", label: "Integrações", icon: Link2 }] : []),
    { id: "logs", label: "Logs", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col font-sans selection:bg-yellow-400/30 selection:text-yellow-200">
      {/* Topbar */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0b132b]/80 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/admin" className="flex items-center gap-3">
            <div className="relative w-28 h-8">
              <Image src="/images/logo-display.webp" alt="Cine Cruzeiro" fill className="object-contain" priority />
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
              Admin
            </span>
          </Link>
        </div>

        {/* Top Status & User Actions */}
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
              saveStatus === "saving"
                ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                : saveStatus === "error"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                saveStatus === "saving"
                  ? "bg-blue-400 animate-pulse"
                  : saveStatus === "error"
                  ? "bg-rose-400"
                  : "bg-emerald-400"
              }`}
            />
            <span>{statusMessage}</span>
          </div>

          <button
            onClick={() => void refreshContent(true)}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900/80 border border-slate-800 hover:bg-slate-800 transition"
            title="Sincronizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${saveStatus === "saving" ? "animate-spin" : ""}`} />
          </button>

          {/* User Profile Info */}
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800">
            <div className="text-right">
              <div className="text-xs font-bold text-white leading-tight">{user.name || user.email}</div>
              <div className="text-[10px] text-yellow-400 font-bold uppercase">{user.role}</div>
            </div>
            {user.twoFactorEnabled && (
              <span title="2FA Ativado">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </span>
            )}
          </div>

          <button
            onClick={() => void logout()}
            className="p-2 text-slate-400 hover:text-rose-300 rounded-xl bg-slate-900/80 border border-slate-800 hover:bg-rose-950/40 hover:border-rose-900/60 transition"
            title="Sair do painel"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex min-h-[calc(100vh-64px)]">
        {/* Desktop Sidebar */}
        <aside className="w-64 border-r border-slate-800/80 bg-[#080d1a]/80 backdrop-blur-md hidden md:flex flex-col justify-between p-4 sticky top-16 h-[calc(100vh-64px)]">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  const query = new URLSearchParams(window.location.search);
                  query.set("tab", item.id);
                  router.push(`/admin?${query.toString()}`);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition text-left ${
                  (new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("tab") || "dashboard") === item.id
                    ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-500">
            <span className="font-bold text-slate-400 block">Cine Cruzeiro v2.0</span>
            Painel Administrativo React
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-md flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-[#0b132b]">
              <span className="font-black text-sm text-yellow-400 uppercase tracking-wider">Navegação</span>
              <button onClick={() => setMobileNavOpen(false)} className="p-2 text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const query = new URLSearchParams(window.location.search);
                    query.set("tab", item.id);
                    router.push(`/admin?${query.toString()}`);
                    setMobileNavOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 transition"
                >
                  <item.icon className="w-5 h-5 text-yellow-400" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Page Content Container */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Floating Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border flex items-start gap-3 transition transform animate-in slide-in-from-bottom-2 ${
              toast.type === "success"
                ? "bg-slate-900 border-emerald-500/40 text-emerald-300"
                : toast.type === "error"
                ? "bg-slate-900 border-rose-500/40 text-rose-300"
                : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
            )}
            <div className="text-xs font-bold leading-relaxed">{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminDataProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </AdminDataProvider>
    </AdminAuthProvider>
  );
}
