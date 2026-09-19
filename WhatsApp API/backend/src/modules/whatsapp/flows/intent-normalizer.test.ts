import { describe, it, expect } from 'vitest';
import { IntentNormalizer, StandardIntent } from './intent-normalizer.js';

describe('IntentNormalizer', () => {
  const testCases = [
    // Programming
    { input: '1', expected: StandardIntent.PROGRAMMING },
    { input: '1️⃣', expected: StandardIntent.PROGRAMMING },
    { input: 'programação', expected: StandardIntent.PROGRAMMING },
    { input: 'programacao', expected: StandardIntent.PROGRAMMING },
    { input: 'PROGRAMMING', selectionId: 'PROGRAMMING', expected: StandardIntent.PROGRAMMING },
    { input: 'ver filmes', expected: StandardIntent.PROGRAMMING },
    { input: 'quais os filmes em cartaz?', expected: StandardIntent.PROGRAMMING },

    // Tickets
    { input: '2', expected: StandardIntent.BUY_TICKET },
    { input: '2️⃣', expected: StandardIntent.BUY_TICKET },
    { input: 'ingressos', expected: StandardIntent.BUY_TICKET },
    { input: 'comprar ingresso', expected: StandardIntent.BUY_TICKET },
    { input: 'BUY_TICKET', selectionId: 'BUY_TICKET', expected: StandardIntent.BUY_TICKET },

    // Snack Bar
    { input: '3', expected: StandardIntent.SNACK_BAR },
    { input: '3️⃣', expected: StandardIntent.SNACK_BAR },
    { input: 'bomboniere', expected: StandardIntent.SNACK_BAR },
    { input: 'pipocas', expected: StandardIntent.SNACK_BAR },
    { input: 'SNACK_BAR', selectionId: 'SNACK_BAR', expected: StandardIntent.SNACK_BAR },

    // Human Support
    { input: '4', expected: StandardIntent.HUMAN_SUPPORT },
    { input: 'atendente', expected: StandardIntent.HUMAN_SUPPORT },
    { input: 'falar com atendente', expected: StandardIntent.HUMAN_SUPPORT },
    { input: 'humano', expected: StandardIntent.HUMAN_SUPPORT },
    { input: 'SUPPORT', selectionId: 'SUPPORT', expected: StandardIntent.HUMAN_SUPPORT },

    // Global: Back
    { input: '0', expected: StandardIntent.BACK },
    { input: '0️⃣', expected: StandardIntent.BACK },
    { input: 'voltar', expected: StandardIntent.BACK },
    { input: 'back', expected: StandardIntent.BACK },
    { input: 'anterior', expected: StandardIntent.BACK },

    // Global: Cancel
    { input: 'cancelar', expected: StandardIntent.CANCEL },
    { input: 'sair', expected: StandardIntent.CANCEL },

    // Global: Main Menu
    { input: 'menu', expected: StandardIntent.MAIN_MENU },
    { input: 'início', expected: StandardIntent.MAIN_MENU },
    { input: 'ola', expected: StandardIntent.MAIN_MENU },
    { input: 'olá!', expected: StandardIntent.MAIN_MENU },
    { input: 'bom dia', expected: StandardIntent.MAIN_MENU },
  ];

  testCases.forEach((tc) => {
    it(`should map "${tc.input}" to ${tc.expected}`, () => {
      const result = IntentNormalizer.matchMainMenuIntent(tc.input, tc.selectionId);
      expect(result).toBe(tc.expected);
    });
  });

  it('should parse numbered indexes accurately', () => {
    expect(IntentNormalizer.parseIndex('1', 5)).toBe(1);
    expect(IntentNormalizer.parseIndex('3️⃣', 5)).toBe(3);
    expect(IntentNormalizer.parseIndex('10', 5)).toBeNull();
    expect(IntentNormalizer.parseIndex('abc', 5)).toBeNull();
  });
});
