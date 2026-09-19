import { env } from '../../../config/env.js';
import { Cart } from './cart.service.js';

export interface CreateOrderFromCartInput {
  companyId: string;
  contactId: string;
  conversationId?: string;
  cart: Cart;
}

/**
 * WhatsApp is a guided entry point, not a second checkout. It never reserves
 * seats or records a local order: the customer finishes on the Cine Cruzeiro
 * checkout, where availability, promotions and payment are authoritative.
 */
export class OrderService {
  getCheckoutUrl(sessionId: string): string {
    const base = env.CHECKOUT_BASE_URL.replace(/\/+$/, '');
    return `${base}/checkout/${encodeURIComponent(sessionId)}?origin=whatsapp`;
  }

  async createOrderFromCart(input: CreateOrderFromCartInput): Promise<{ checkoutUrl: string }> {
    const sessionId = String(input.cart.ticketItem?.sessionId || '').trim();
    if (!sessionId) throw new Error('A sessão selecionada não está mais disponível.');
    return { checkoutUrl: this.getCheckoutUrl(sessionId) };
  }
}
