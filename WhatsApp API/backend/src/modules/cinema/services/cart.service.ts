import { TicketCategory, TicketPricingService } from './ticket-pricing.service.js';

export interface TicketCartItem {
  movieId: string;
  movieTitle: string;
  sessionId: string;
  sessionTime: string;
  sessionDate: string;
  dateLabel?: string;
  roomName: string;
  format: string;
  audioType: string;
  ticketType: TicketCategory;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SnackCartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  ticketItem?: TicketCartItem;
  snackItems: SnackCartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

export class CartService {
  constructor(private readonly pricingService = new TicketPricingService()) {}

  /**
   * Retrieves or initializes cart from session context
   */
  getCart(context: Record<string, any>): Cart {
    if (!context.cart) {
      context.cart = {
        snackItems: [],
        subtotal: 0,
        discount: 0,
        total: 0,
      };
    }
    return context.cart as Cart;
  }

  /**
   * Sets ticket item into cart and recalculates totals
   */
  setTicketItem(
    context: Record<string, any>,
    item: Omit<TicketCartItem, 'totalPrice'>
  ): Cart {
    const cart = this.getCart(context);
    const totalPrice = Number((item.unitPrice * item.quantity).toFixed(2));

    cart.ticketItem = {
      ...item,
      totalPrice,
    };

    this.recalculateTotals(cart);
    return cart;
  }

  /**
   * Clears cart from context
   */
  clearCart(context: Record<string, any>): void {
    delete context.cart;
  }

  /**
   * Recalculates subtotal, discount and total
   */
  recalculateTotals(cart: Cart): void {
    let subtotal = 0;

    if (cart.ticketItem) {
      subtotal += cart.ticketItem.totalPrice;
    }

    if (cart.snackItems && Array.isArray(cart.snackItems)) {
      for (const snack of cart.snackItems) {
        subtotal += snack.totalPrice;
      }
    }

    cart.subtotal = Number(subtotal.toFixed(2));
    cart.discount = cart.discount || 0;
    cart.total = Number(Math.max(0, cart.subtotal - cart.discount).toFixed(2));
  }
}
