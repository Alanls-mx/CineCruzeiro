/**
 * AI Intent Provider Interface (FASE 12 Foundation)
 * Prepared for future integration with LLMs (OpenAI, Gemini, Anthropic, Ollama).
 * 
 * CRITICAL RULE: AI ONLY interprets intent and parameters.
 * It NEVER invents movies, prices, showtimes, seats, or inventory.
 * Real data is ALWAYS queried from LumixEngine business services.
 */

export enum RecognizedIntent {
  CHECK_PROGRAMMING = 'CHECK_PROGRAMMING',
  BUY_TICKET = 'BUY_TICKET',
  CHECK_PRICE = 'CHECK_PRICE',
  SNACK_BAR = 'SNACK_BAR',
  HUMAN_SUPPORT = 'HUMAN_SUPPORT',
  GREETING = 'GREETING',
  UNKNOWN = 'UNKNOWN',
}

export interface IntentExtractionResult {
  intent: RecognizedIntent;
  confidence: number; // 0.0 to 1.0
  parameters: {
    movieTitle?: string;
    date?: string; // e.g. '2026-09-19' or 'hoje'
    quantity?: number;
    category?: string;
  };
  rawPrompt: string;
}

export interface AIIntentProvider {
  detectIntent(userText: string, context?: Record<string, any>): Promise<IntentExtractionResult>;
}
