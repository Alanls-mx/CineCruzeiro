"use client";

import React, { useState, useEffect } from "react";
import { AdminUser, AdminRole } from "@/types/admin";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { setupAdmin2fa, enableAdmin2fa, disableAdmin2fa, generateAdmin2faRecoveryCodes } from "@/services/adminApi";
import { Users, Shield, Key, Plus, Edit2, Trash2, CheckCircle, ShieldCheck, AlertTriangle } from "lucide-react";

export default function UsersModule() {
  const { content, saveContent } = useAdminData();
  const { user: currentUser, isOwner, isAdminOrOwner } = useAdminAuth();
  const users = content?.users || [];

  const [activeTab, setActiveTab] = useState<"users" | "security">("users");

  // User modal
  const [editingUser, setEditingUser] = useState<Partial<AdminUser> | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // 2FA Setup state for current user
  const [setupData, setSetupData] = useState<{ qrCodeDataUrl?: string; secret: string; provisioningUri: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [settingUp2fa, setSettingUp2fa] = useState(false);

  const handleOpenAddUser = () => {
    setEditingUser({
      id: `admin-${Date.now()}`,
      name: "",
      email: "",
      role: "operator",
      active: true,
      permissions: ["movies.view", "orders.view", "sessions.view"],
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.email) return;

    const finalUser = editingUser as AdminUser;
    const exists = users.some((u) => u.id === finalUser.id);
    let updatedUsers: AdminUser[];

    if (exists) {
      updatedUsers = users.map((u) => (u.id === finalUser.id ? finalUser : u));
    } else {
      updatedUsers = [...users, finalUser];
    }

    const success = await saveContent({ users: updatedUsers }, "Usuário salvo com sucesso.");
    if (success) {
      setIsUserModalOpen(false);
      setEditingUser(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      alert("Você não pode excluir sua própria conta.");
      return;
    }
    if (!window.confirm("Deseja realmente remover este usuário administrativo?")) return;
    const updated = users.filter((u) => u.id !== userId);
    await saveContent({ users: updated }, "Usuário removido.");
  };

  // 2FA Actions
  const handleStart2faSetup = async () => {
    setSettingUp2fa(true);
    try {
      const res = await setupAdmin2fa();
      setSetupData(res);
    } catch (err: any) {
      alert(err.message || "Erro ao iniciar 2FA.");
    } finally {
      setSettingUp2fa(false);
    }
  };

  const handleConfirm2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData || !twoFactorCode) return;
    try {
      const res = await enableAdmin2fa(twoFactorCode, setupData.secret);
      setRecoveryCodes(res.recoveryCodes || []);
      setSetupData(null);
      setTwoFactorCode("");
      alert("Autenticação em duas etapas ativada com sucesso!");
    } catch (err: any) {
      alert(err.message || "Código incorreto.");
    }
  };

  const handleDisable2fa = async () => {
    const code = prompt("Informe seu código 2FA atual para confirmar a desativação:");
    if (!code) return;
    try {
      await disableAdmin2fa(code);
      alert("2FA desativado.");
    } catch (err: any) {
      alert(err.message || "Erro ao desativar.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-400" />
            Contas e Segurança
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gerencie operadores do painel, permissões de acesso e autenticação em 2 etapas (2FA).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "users"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Operadores
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "security"
                ? "bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Key className="w-4 h-4" />
            2FA e Segurança
          </button>
        </div>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {isAdminOrOwner && (
            <div className="flex justify-end">
              <button
                onClick={handleOpenAddUser}
                className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Novo Operador
              </button>
            </div>
          )}

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase font-black text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Nome / E-mail</th>
                    <th className="py-3.5 px-4">Função (Role)</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">2FA</th>
                    <th className="py-3.5 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">{user.name || "Sem nome"}</div>
                        <div className="text-[11px] text-slate-400">{user.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold uppercase text-yellow-300">
                        {user.role}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            user.active
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {user.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            user.twoFactorEnabled
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {user.twoFactorEnabled ? "Protegido (2FA)" : "Não configurado"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingUser({ ...user });
                              setIsUserModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdminOrOwner && user.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & 2FA */}
      {activeTab === "security" && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">Autenticação em Duas Etapas (2FA/TOTP)</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Adicione uma camada extra de proteção à sua conta exigindo um código gerado pelo aplicativo no seu smartphone.
                </p>
              </div>
            </div>

            {!setupData && (
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStart2faSetup}
                  disabled={settingUp2fa}
                  className="px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs transition"
                >
                  {settingUp2fa ? "Iniciando..." : "Configurar Novo 2FA"}
                </button>
                <button
                  type="button"
                  onClick={handleDisable2fa}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 font-bold text-xs transition"
                >
                  Desativar 2FA
                </button>
              </div>
            )}

            {setupData && (
              <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-sm font-black text-white">1. Escaneie o QR Code</h4>
                <p className="text-xs text-slate-400">
                  Abra o Google Authenticator ou Authy e aponte a câmera para o código abaixo:
                </p>

                {setupData.qrCodeDataUrl && (
                  <div className="flex justify-center p-4 bg-white rounded-xl w-fit mx-auto">
                    <img src={setupData.qrCodeDataUrl} alt="2FA QR Code" className="w-44 h-44" />
                  </div>
                )}

                <p className="text-center font-mono text-xs text-yellow-400">
                  Chave manual: {setupData.secret}
                </p>

                <form onSubmit={handleConfirm2fa} className="space-y-3 pt-3 border-t border-slate-800">
                  <label className="block text-xs font-bold text-slate-300">
                    2. Digite o código de 6 dígitos gerado:
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    className="w-full text-center font-mono text-xl font-bold py-2 rounded-xl bg-slate-900 border border-slate-700 text-yellow-400 focus:outline-none focus:border-yellow-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSetupData(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs"
                    >
                      Ativar e Salvar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {recoveryCodes.length > 0 && (
              <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3">
                <h4 className="font-black text-emerald-300 text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Códigos de Recuperação
                </h4>
                <p className="text-xs text-slate-300">
                  Guarde estes códigos em local seguro. Cada código pode ser usado uma única vez caso perca seu celular.
                </p>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-xl font-mono text-xs text-yellow-400">
                  {recoveryCodes.map((c, i) => (
                    <span key={i}>{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-black text-white">Configurar Operador</h4>
              <button onClick={() => setIsUserModalOpen(false)} className="p-1 text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editingUser.name || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Função / Perfil</label>
                <select
                  value={editingUser.role || "operator"}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as AdminRole })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                >
                  <option value="owner">Proprietário (Owner)</option>
                  <option value="admin">Administrador (Admin)</option>
                  <option value="operator">Operador (Gerência)</option>
                  <option value="cashier">Caixa / Bilheteiro</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300">Cancelar</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-yellow-400 text-slate-950 text-xs font-black">Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
