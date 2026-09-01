"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SystemLogEntry } from "@/types/admin";
import { fetchAdminLogs, cleanAdminLogs } from "@/services/adminApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Activity, Search, RefreshCw, Trash2, AlertCircle, AlertTriangle, Info } from "lucide-react";

export default function LogsModule() {
  const { isOwner } = useAdminAuth();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminLogs({
        level: levelFilter !== "all" ? levelFilter : undefined,
        search: searchTerm || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, searchTerm]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleCleanLogs = async () => {
    if (!window.confirm("Deseja limpar registros de logs com mais de 30 dias?")) return;
    try {
      const res = await cleanAdminLogs(30);
      alert(res.message || "Logs antigos limpos com sucesso.");
      void loadLogs();
    } catch (err: any) {
      alert(err.message || "Erro ao limpar logs.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-yellow-400" />
            Logs de Auditoria e Sistema
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Trilha de auditoria de eventos de segurança, pagamentos, mutações administrativas e webhooks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={handleCleanLogs}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Antigos (30d)
            </button>
          )}
          <button
            onClick={() => void loadLogs()}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Filtrar por mensagem, evento ou IP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
          />
        </div>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-yellow-400"
        >
          <option value="all">Todos os níveis</option>
          <option value="info">Info</option>
          <option value="warn">Avisos (Warn)</option>
          <option value="error">Erros (Error)</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] uppercase font-black text-slate-400 tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Nível</th>
                <th className="py-3.5 px-4">Evento</th>
                <th className="py-3.5 px-4">Mensagem / Detalhes</th>
                <th className="py-3.5 px-4">Ator / IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs text-slate-300">
              {logs.length > 0 ? (
                logs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-slate-800/40 font-mono">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                          log.level === "error"
                            ? "bg-rose-500/20 text-rose-300"
                            : log.level === "warn"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {log.level === "error" ? (
                          <AlertCircle className="w-3 h-3" />
                        ) : log.level === "warn" ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Info className="w-3 h-3" />
                        )}
                        {log.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-yellow-300">{log.event}</td>
                    <td className="py-3 px-4 text-slate-200 font-sans">{log.message}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {log.actorEmail || log.ip || "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 text-xs font-bold font-sans">
                    {loading ? "Carregando registros de logs..." : "Nenhum log encontrado para os filtros selecionados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
