import { describe, it, expect } from 'vitest';
import { TicketPricingService } from './ticket-pricing.service.js';

describe('TicketPricingService', () => {
  const service = new TicketPricingService();

  it('should calculate full and half ticket prices accurately', () => {
    const options = service.getPricingOptions(50.0);
    expect(options).toHaveLength(2);

    const full = options.find((o) => o.type === 'FULL');
    expect(full?.price).toBe(50.0);
    expect(full?.name).toBe('Inteira');

    const half = options.find((o) => o.type === 'HALF');
    expect(half?.price).toBe(25.0);
    expect(half?.name).toBe('Meia-Entrada');
  });

  it('should calculate specific category prices', () => {
    expect(service.calculatePrice(38.0, 'FULL')).toBe(38.0);
    expect(service.calculatePrice(38.0, 'HALF')).toBe(19.0);
    expect(service.calculatePrice(55.0, 'HALF')).toBe(27.5);
  });

  it('should normalize user text and selectionId to ticket category', () => {
    expect(service.normalizeTicketCategory('1')).toBe('FULL');
    expect(service.normalizeTicketCategory('1️⃣')).toBe('FULL');
    expect(service.normalizeTicketCategory('inteira')).toBe('FULL');
    expect(service.normalizeTicketCategory('', 'TICKET_FULL')).toBe('FULL');

    expect(service.normalizeTicketCategory('2')).toBe('HALF');
    expect(service.normalizeTicketCategory('2️⃣')).toBe('HALF');
    expect(service.normalizeTicketCategory('meia')).toBe('HALF');
    expect(service.normalizeTicketCategory('meia entrada')).toBe('HALF');
    expect(service.normalizeTicketCategory('estudante')).toBe('HALF');
    expect(service.normalizeTicketCategory('', 'TICKET_HALF')).toBe('HALF');

    expect(service.normalizeTicketCategory('pipoca')).toBeNull();
  });
});
