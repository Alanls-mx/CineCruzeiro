export interface Company {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface WhatsAppInstance {
  id: string;
  companyId: string;
  instanceName: string;
  phoneNumber?: string;
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
  provider: 'EVOLUTION' | 'MOCK';
  connectedAt?: string;
  disconnectedAt?: string;
}

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  profilePicture?: string | null;
  lastSeenAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  externalMessageId?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sender: 'CUSTOMER' | 'BOT' | 'AGENT' | 'SYSTEM';
  type: 'TEXT' | 'BUTTON' | 'LIST' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';
  content: string;
  metadata?: Record<string, any>;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  createdAt: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  contactId: string;
  status: 'OPEN' | 'CLOSED' | 'WAITING';
  mode: 'BOT' | 'HUMAN' | 'PAUSED';
  currentFlow?: string;
  currentState?: string;
  unreadCount: number;
  lastMessageAt: string;
  createdAt?: string;
  startedAt?: string;
  contact: Contact;
  context?: {
    assignedAgent?: {
      userId: string;
      userName: string;
    } | null;
    [key: string]: unknown;
  };
  messages?: Message[];
}

export interface AdminUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  effectivePermissions: string[];
}

export interface AssignableUser {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export interface WhatsAppSettings {
  id: string;
  companyId: string;
  autoReplyEnabled: boolean;
  welcomeMessage: string;
  fallbackMessage: string;
  outOfHoursMessage: string;
  workingHours: Record<string, { start: string; end: string; enabled: boolean }>;
  autoCloseMinutes: number;
  debounceDelayMs: number;
  humanSupportEnabled: boolean;
  showProgramming: boolean;
  showTickets: boolean;
  showSnackBar: boolean;
  maxFallbackCount: number;
}
