import { Decimal } from '@prisma/client/runtime/library';

export type TicketCategory = 'FULL' | 'HALF';

export interface TicketPricingOption {
  type: TicketCategory;
  name: string;
  description: string;
  multiplier: number;
  price: number;
}

export class TicketPricingService {
  /**
   * Returns available ticket pricing options based on session base price
   */
  getPricingOptions(sessionPrice: number | Decimal): TicketPricingOption[] {
    const base = Number(sessionPrice);
    return [
      {
        type: 'FULL',
        name: 'Inteira',
        description: 'Ingresso individual padrão',
        multiplier: 1.0,
        price: Number(base.toFixed(2)),
      },
      {
        type: 'HALF',
        name: 'Meia-Entrada',
        description: 'Estudantes, jovens até 29 anos, idosos e PCD',
        multiplier: 0.5,
        price: Number((base * 0.5).toFixed(2)),
      },
    ];
  }

  /**
   * Calculates ticket price for a specific category
   */
  calculatePrice(sessionPrice: number | Decimal, category: TicketCategory): number {
    const base = Number(sessionPrice);
    if (category === 'HALF') {
      return Number((base * 0.5).toFixed(2));
    }
    return Number(base.toFixed(2));
  }

  /**
   * Normalizes customer input to TicketCategory
   */
  normalizeTicketCategory(input?: string, selectionId?: string): TicketCategory | null {
    const raw = (selectionId || input || '').toUpperCase().trim();
    if (raw === 'TICKET_FULL' || raw === 'FULL' || raw === 'INTEIRA') return 'FULL';
    if (raw === 'TICKET_HALF' || raw === 'HALF' || raw === 'MEIA') return 'HALF';

    const cleaned = (input || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (cleaned === '1' || cleaned === '1️⃣' || cleaned.includes('inteira') || cleaned === 'padrao') {
      return 'FULL';
    }
    if (cleaned === '2' || cleaned === '2️⃣' || cleaned.includes('meia') || cleaned.includes('estudante') || cleaned.includes('idoso')) {
      return 'HALF';
    }

    return null;
  }
}
