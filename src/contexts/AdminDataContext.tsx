"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AdminContentData } from "@/types/admin";
import { fetchAdminContent, saveAdminContent } from "@/services/adminApi";
import { useAdminAuth } from "./AdminAuthContext";

export type SaveStatus = "saved" | "saving" | "error" | "idle";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface AdminDataContextValue {
  content: AdminContentData | null;
  loading: boolean;
  saveStatus: SaveStatus;
  statusMessage: string;
  toasts: ToastItem[];
  refreshContent: (silent?: boolean) => Promise<void>;
  saveContent: (updated: Partial<AdminContentData>, successMessage?: string) => Promise<boolean>;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAdminAuth();
  const [content, setContent] = useState<AdminContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Pronto");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshContent = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    setSaveStatus("saving");
    setStatusMessage("Carregando...");
    try {
      const data = await fetchAdminContent();
      setContent(data);
      setSaveStatus("saved");
      setStatusMessage("Salvo");
    } catch (err) {
      setSaveStatus("error");
      setStatusMessage("Erro ao sincronizar");
      const msg = err instanceof Error ? err.message : "Erro ao carregar dados.";
      addToast(msg, "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    if (user) {
      void refreshContent();
    } else {
      setContent(null);
      setLoading(false);
    }
  }, [user, refreshContent]);

  const saveContent = useCallback(
    async (updated: Partial<AdminContentData>, successMessage = "Alterações salvas com sucesso."): Promise<boolean> => {
      setSaveStatus("saving");
      setStatusMessage("Salvando...");
      try {
        await saveAdminContent(updated);
        setContent((prev) => (prev ? { ...prev, ...updated } : (updated as AdminContentData)));
        setSaveStatus("saved");
        setStatusMessage("Salvo");
        addToast(successMessage, "success");
        return true;
      } catch (err) {
        setSaveStatus("error");
        setStatusMessage("Erro ao salvar");
        const msg = err instanceof Error ? err.message : "Erro ao salvar alterações.";
        addToast(msg, "error");
        return false;
      }
    },
    [addToast]
  );

  return (
    <AdminDataContext.Provider
      value={{
        content,
        loading,
        saveStatus,
        statusMessage,
        toasts,
        refreshContent,
        saveContent,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }
  return context;
}
