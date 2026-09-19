/**
 * Intent Normalizer for LumixEngine WhatsApp Automation
 * 
 * Centralizes input sanitization, accent removal, keycap emoji conversion,
 * and canonical intent identification (PROGRAMMING, BUY_TICKET, SNACK_BAR, etc.)
 */

export enum StandardIntent {
  MAIN_MENU = 'MAIN_MENU',
  PROGRAMMING = 'PROGRAMMING',
  BUY_TICKET = 'BUY_TICKET',
  SNACK_BAR = 'SNACK_BAR',
  HUMAN_SUPPORT = 'HUMAN_SUPPORT',
  BACK = 'BACK',
  CANCEL = 'CANCEL',
  CONFIRM = 'CONFIRM',
}

export class IntentNormalizer {
  /**
   * Cleans text by converting to lowercase, removing accents and keycap emojis
   */
  static clean(text?: string): string {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/0️⃣/g, '0')
      .replace(/1️⃣/g, '1')
      .replace(/2️⃣/g, '2')
      .replace(/3️⃣/g, '3')
      .replace(/4️⃣/g, '4')
      .replace(/5️⃣/g, '5')
      .replace(/6️⃣/g, '6')
      .replace(/7️⃣/g, '7')
      .replace(/8️⃣/g, '8')
      .replace(/9️⃣/g, '9')
      .replace(/[^\p{L}\p{N}\s]/gu, '') // remove punctuation/symbols
      .toLowerCase()
      .trim();
  }

  /**
   * Safely extracts a 1-based index from user input (e.g. "1", "2", "0")
   */
  static parseIndex(text?: string, max?: number): number | null {
    const cleaned = this.clean(text);
    const num = parseInt(cleaned, 10);
    if (isNaN(num)) return null;
    if (max !== undefined && (num < 0 || num > max)) return null;
    return num;
  }

  /**
   * Identifies global intents (Navigation, Menu, Cancel, Human Support)
   */
  static matchGlobalIntent(text?: string, selectionId?: string): StandardIntent | null {
    const rawSelection = (selectionId || '').toUpperCase().trim();
    if (rawSelection === 'MAIN_MENU') return StandardIntent.MAIN_MENU;
    if (rawSelection === 'SUPPORT' || rawSelection === 'HUMAN_SUPPORT') return StandardIntent.HUMAN_SUPPORT;
    if (rawSelection === 'BACK' || rawSelection === 'BACK_TO_MENU') return StandardIntent.BACK;
    if (rawSelection === 'CANCEL') return StandardIntent.CANCEL;

    const cleaned = this.clean(text);
    if (!cleaned) return null;

    // Back / Cancel
    if (cleaned === '0' || cleaned === 'voltar' || cleaned === 'back' || cleaned === 'anterior' || cleaned === 'retornar') {
      return StandardIntent.BACK;
    }
    if (cleaned === 'cancelar' || cleaned === 'cancela' || cleaned === 'sair' || cleaned === 'parar') {
      return StandardIntent.CANCEL;
    }

    // Main Menu / Greetings
    if (
      ['menu', 'inicio', 'iniciar', 'comecar', 'oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'].includes(cleaned) ||
      cleaned.startsWith('oi ') ||
      cleaned.startsWith('ola ') ||
      cleaned.startsWith('menu')
    ) {
      return StandardIntent.MAIN_MENU;
    }

    // Human Support
    if (
      cleaned === '4' ||
      cleaned.includes('atendente') ||
      cleaned.includes('humano') ||
      cleaned.includes('falar com') ||
      cleaned.includes('suporte')
    ) {
      return StandardIntent.HUMAN_SUPPORT;
    }

    return null;
  }

  /**
   * Identifies Main Menu options
   */
  static matchMainMenuIntent(text?: string, selectionId?: string): StandardIntent | null {
    const global = this.matchGlobalIntent(text, selectionId);
    if (global) return global;

    const rawSelection = (selectionId || '').toUpperCase().trim();
    if (rawSelection === 'PROGRAMMING') return StandardIntent.PROGRAMMING;
    if (rawSelection === 'BUY_TICKET') return StandardIntent.BUY_TICKET;
    if (rawSelection === 'SNACK_BAR') return StandardIntent.SNACK_BAR;

    const cleaned = this.clean(text);

    // 1. Programming
    if (
      cleaned === '1' ||
      cleaned.includes('programacao') ||
      cleaned.includes('filme') ||
      cleaned.includes('cartaz') ||
      cleaned.includes('horario')
    ) {
      return StandardIntent.PROGRAMMING;
    }

    // 2. Buy Tickets
    if (
      cleaned === '2' ||
      cleaned.includes('ingresso') ||
      cleaned.includes('comprar') ||
      cleaned.includes('ticket') ||
      cleaned.includes('sessao')
    ) {
      return StandardIntent.BUY_TICKET;
    }

    // 3. Snack Bar
    if (
      cleaned === '3' ||
      cleaned.includes('bomboniere') ||
      cleaned.includes('pipoca') ||
      cleaned.includes('combo') ||
      cleaned.includes('bebida') ||
      cleaned.includes('doce') ||
      cleaned.includes('refrigerante') ||
      cleaned.includes('snack')
    ) {
      return StandardIntent.SNACK_BAR;
    }

    return null;
  }
}
