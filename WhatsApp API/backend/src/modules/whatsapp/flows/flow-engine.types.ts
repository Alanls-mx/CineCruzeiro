import { WhatsAppProvider } from '../providers/whatsapp-provider.interface.js';
import { IncomingWhatsAppMessage } from '../webhooks/webhooks.types.js';

export interface FlowSession {
  companyId: string;
  companyName: string;
  contactId: string;
  phone: string;
  contactName: string;
  conversationId: string;
  currentFlow: string;
  currentState: string;
  context: Record<string, any>;
  instanceName: string;
}

export interface FlowActionResult {
  nextFlow?: string;
  nextState?: string;
  nextMode?: import('@prisma/client').ConversationMode;
  contextUpdate?: Record<string, any>;
  resetFallbackCount?: boolean;
  handled: boolean;
}

export interface FlowState {
  name: string;
  onEnter?: (session: FlowSession, provider: WhatsAppProvider) => Promise<void>;
  onMessage: (
    session: FlowSession,
    message: IncomingWhatsAppMessage,
    provider: WhatsAppProvider
  ) => Promise<FlowActionResult>;
}

export interface Flow {
  id: string;
  initialState: string;
  states: Map<string, FlowState>;
}
