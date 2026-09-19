import type { Company, Conversation, Message, WhatsAppInstance, WhatsAppSettings } from '../types/index.js';

const API_BASE =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? '/projects/cinecruzeiro/api/admin/whatsapp'
        : 'http://localhost:3333');

async function request<T>(path: string, options: RequestInit = {}, _companyId?: string): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();
  let body = options.body;

  // For POST/PUT/PATCH with body, ensure JSON header
  if (body) {
    headers.set('Content-Type', 'application/json');
  } else if (['POST', 'PUT', 'PATCH'].includes(method)) {
    // Send empty JSON object to satisfy Fastify JSON content parser
    body = JSON.stringify({});
    headers.set('Content-Type', 'application/json');
  }

  // The Cine Cruzeiro backend supplies the fixed tenant identity and internal
  // service credential. Browser-provided company identifiers are never trusted.

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.message || 'Erro na requisição');
  }

  return json.data;
}

export const api = {
  // Companies
  getCompanies: () => request<Company[]>('/api/companies'),

  // Instances
  getInstances: (companyId: string) => request<WhatsAppInstance[]>('/api/whatsapp/instances', {}, companyId),
  createInstance: (companyId: string, instanceName: string) =>
    request<{ instance: WhatsAppInstance; qrcode?: { base64?: string; code?: string } }>(
      '/api/whatsapp/instances',
      {
        method: 'POST',
        body: JSON.stringify({ instanceName, provider: 'EVOLUTION' }),
      },
      companyId
    ),
  connectInstance: (companyId: string, id: string) =>
    request<{ instanceId: string; status: string; qrcode?: { base64?: string; code?: string } }>(
      `/api/whatsapp/instances/${id}/connect`,
      { method: 'POST' },
      companyId
    ),
  getQrCode: (companyId: string, id: string) =>
    request<{ instanceId: string; status: string; qrcode?: { base64?: string; code?: string } }>(
      `/api/whatsapp/instances/${id}/qrcode`,
      {},
      companyId
    ),
  getStatus: (companyId: string, id: string) =>
    request<WhatsAppInstance>(`/api/whatsapp/instances/${id}/status`, {}, companyId),
  disconnectInstance: (companyId: string, id: string) =>
    request<{ success: boolean }>(`/api/whatsapp/instances/${id}/disconnect`, { method: 'POST' }, companyId),
  deleteInstance: (companyId: string, id: string) =>
    request<{ success: boolean }>(`/api/whatsapp/instances/${id}`, { method: 'DELETE' }, companyId),

  // Conversations
  getConversations: (companyId: string, status?: string) =>
    request<Conversation[]>(`/api/whatsapp/conversations${status ? `?status=${status}` : ''}`, {}, companyId),
  getMessages: (companyId: string, conversationId: string) =>
    request<Message[]>(`/api/whatsapp/conversations/${conversationId}/messages`, {}, companyId),
  sendMessage: (
    companyId: string,
    conversationId: string,
    payload: string | { text?: string; type?: string; mediaUrl?: string; fileName?: string }
  ) => {
    const body = typeof payload === 'string' ? { text: payload } : payload;
    return request<Message>(
      `/api/whatsapp/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      companyId
    );
  },
  takeoverConversation: (companyId: string, conversationId: string) =>
    request<Conversation>(`/api/whatsapp/conversations/${conversationId}/takeover`, { method: 'POST' }, companyId),
  releaseConversation: (companyId: string, conversationId: string) =>
    request<Conversation>(`/api/whatsapp/conversations/${conversationId}/release`, { method: 'POST' }, companyId),
  closeConversation: (companyId: string, conversationId: string) =>
    request<Conversation>(`/api/whatsapp/conversations/${conversationId}/close`, { method: 'POST' }, companyId),

  // WhatsApp Status / Stories
  publishStatus: (
    companyId: string,
    params: {
      type: 'text' | 'image' | 'video';
      text?: string;
      content?: string;
      mediaUrl?: string;
      caption?: string;
      backgroundColor?: string;
      font?: number;
    }
  ) =>
    request<{ success: boolean; messageId: string }>(
      '/api/whatsapp/status',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      companyId
    ),
  syncProfilePicture: (companyId: string, contactId: string) =>
    request<{ profilePictureUrl: string | null }>(
      `/api/whatsapp/contacts/${contactId}/sync-profile-picture`,
      { method: 'POST' },
      companyId
    ),

  // Settings
  getSettings: (companyId: string) => request<WhatsAppSettings>('/api/whatsapp/settings', {}, companyId),
  updateSettings: (companyId: string, settings: Partial<WhatsAppSettings>) =>
    request<WhatsAppSettings>(
      '/api/whatsapp/settings',
      {
        method: 'PUT',
        body: JSON.stringify(settings),
      },
      companyId
    ),

  // Real Cinema Domain Data
  getMovies: (companyId: string) => request<any[]>('/api/cinema/movies', {}, companyId),
  getSessions: (companyId: string) => request<any[]>('/api/cinema/sessions', {}, companyId),
  getProducts: (companyId: string) => request<any[]>('/api/cinema/products', {}, companyId),
  getRooms: (companyId: string) => request<any[]>('/api/cinema/rooms', {}, companyId),

  // Realtime Events (SSE)
  createEventSource: (_companyId: string) => {
    return new EventSource(`${API_BASE}/api/whatsapp/events`);
  },
};
