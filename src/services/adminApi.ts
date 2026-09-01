import {
  AdminContentData,
  AdminDashboardData,
  AdminIntegrationsStatus,
  AdminUser,
  ClubSubscription,
  SystemLogEntry,
} from "@/types/admin";
import { TicketOrder } from "@/types";

const PRODUCTION_BASE_PATH = process.env.NODE_ENV === "production" ? "/projects/cinecruzeiro" : "";
const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || PRODUCTION_BASE_PATH).replace(/\/+$/, "");

function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function parseErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const obj = payload as { error?: { message?: string } | string; message?: string };
    if (obj.error && typeof obj.error === "object" && obj.error.message) return obj.error.message;
    if (typeof obj.error === "string") return obj.error;
    if (obj.message) return obj.message;
  }
  return fallback;
}

export async function adminLogin(email: string, password: string) {
  const res = await adminFetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    throw new Error(parseErrorMessage(data, "E-mail ou senha inválidos."));
  }
  return data as { user?: AdminUser; challenge?: string; requiresTwoFactor?: boolean; message?: string };
}

export async function adminLogin2fa(code: string, challenge: string) {
  const res = await adminFetch(`${API_BASE}/api/admin/login/2fa`, {
    method: "POST",
    body: JSON.stringify({ code, challenge }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Código de autenticação inválido."));
  }
  return data as { user: AdminUser };
}

export async function fetchAdminMe(): Promise<AdminUser | null> {
  const res = await adminFetch(`${API_BASE}/api/admin/me`, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return (data.user || null) as AdminUser | null;
}

export async function adminLogout() {
  await adminFetch(`${API_BASE}/api/admin/logout`, { method: "POST" }).catch(() => null);
}

export async function fetchAdminDashboard(period = "today", from = "", to = ""): Promise<AdminDashboardData> {
  const params = new URLSearchParams({ period });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await adminFetch(`${API_BASE}/api/admin/dashboard?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Desculpe, erro interno no servidor ao carregar o dashboard."));
  }
  return data as AdminDashboardData;
}

export async function fetchAdminContent(): Promise<AdminContentData> {
  const res = await adminFetch(`${API_BASE}/api/admin/content`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Desculpe, erro interno no servidor ao carregar os dados."));
  }
  return data as AdminContentData;
}

export async function saveAdminContent(content: Partial<AdminContentData>) {
  const res = await adminFetch(`${API_BASE}/api/admin/content`, {
    method: "POST",
    body: JSON.stringify(content),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Desculpe, erro interno no servidor ao salvar alterações."));
  }
  return data;
}

export async function fetchAdminSubscriptions(): Promise<ClubSubscription[]> {
  const res = await adminFetch(`${API_BASE}/api/admin/subscriptions`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao listar assinaturas."));
  }
  return (data.subscriptions || data || []) as ClubSubscription[];
}

export async function assignAdminSubscription(input: { customerEmail: string; planId: string; courtesy?: boolean }) {
  const res = await adminFetch(`${API_BASE}/api/admin/subscriptions/assign`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Não foi possível atribuir o plano ao cliente."));
  }
  return data;
}

export async function fetchAdminLogs(filters: { level?: string; search?: string; limit?: number } = {}): Promise<SystemLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.level) params.set("level", filters.level);
  if (filters.search) params.set("search", filters.search);
  if (filters.limit) params.set("limit", String(filters.limit));
  const res = await adminFetch(`${API_BASE}/api/admin/system-logs?${params.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao carregar logs."));
  }
  return (data.logs || data || []) as SystemLogEntry[];
}

export async function cleanAdminLogs(retentionDays = 30) {
  const res = await adminFetch(`${API_BASE}/api/admin/system-logs/clean`, {
    method: "POST",
    body: JSON.stringify({ retentionDays }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao limpar registros de logs antigos."));
  }
  return data as { deleted: number; message: string };
}

export async function fetchAdminIntegrations(): Promise<AdminIntegrationsStatus> {
  const res = await adminFetch(`${API_BASE}/api/admin/integrations`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao consultar integrações."));
  }
  return (data.integrations || data) as AdminIntegrationsStatus;
}

export async function sendTestEmail(toEmail: string) {
  const res = await adminFetch(`${API_BASE}/api/admin/integrations/email/test`, {
    method: "POST",
    body: JSON.stringify({ to: toEmail }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Falha ao enviar e-mail de teste."));
  }
  return data;
}

export async function fetchAdmin2faStatus() {
  const res = await adminFetch(`${API_BASE}/api/admin/2fa/status`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return data as { enabled: boolean; adminTwoFactorRequired?: boolean };
}

export async function setupAdmin2fa() {
  const res = await adminFetch(`${API_BASE}/api/admin/2fa/setup`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao iniciar configuração do 2FA."));
  }
  return data as { qrCodeDataUrl?: string; secret: string; provisioningUri: string };
}

export async function enableAdmin2fa(code: string, secret: string) {
  const res = await adminFetch(`${API_BASE}/api/admin/2fa/enable`, {
    method: "POST",
    body: JSON.stringify({ code, secret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Código incorreto ao ativar o 2FA."));
  }
  return data as { recoveryCodes: string[]; message: string };
}

export async function disableAdmin2fa(code: string) {
  const res = await adminFetch(`${API_BASE}/api/admin/2fa/disable`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Não foi possível desativar o 2FA."));
  }
  return data;
}

export async function generateAdmin2faRecoveryCodes() {
  const res = await adminFetch(`${API_BASE}/api/admin/2fa/recovery-codes`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao gerar novos códigos de recuperação."));
  }
  return data as { recoveryCodes: string[]; message: string };
}

export async function searchTmdbMovies(query: string) {
  const res = await adminFetch(`${API_BASE}/api/admin/tmdb/search?q=${encodeURIComponent(query)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseErrorMessage(data, "Erro ao buscar no TMDB."));
  return (data.results || []) as Array<{
    id: number;
    title: string;
    overview: string;
    release_date: string;
    poster_path: string;
    backdrop_path: string;
  }>;
}

export async function fetchTmdbMovieDetails(tmdbId: number) {
  const res = await adminFetch(`${API_BASE}/api/admin/tmdb/movie/${tmdbId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseErrorMessage(data, "Erro ao buscar detalhes no TMDB."));
  return data;
}

export async function uploadAdminImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`${API_BASE}/api/admin/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseErrorMessage(data, "Erro ao fazer upload da imagem."));
  }
  return data as { url: string };
}
