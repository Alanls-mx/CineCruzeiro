import { WhatsAppProviderType } from '@prisma/client';
import { WhatsAppProvider } from './whatsapp-provider.interface.js';
import { EvolutionWhatsAppProvider } from './evolution/evolution-whatsapp.provider.js';
import { MockWhatsAppProvider } from './mock/mock-whatsapp.provider.js';
import { env } from '../../../config/env.js';

export class WhatsAppProviderFactory {
  private static evolutionProviderInstance: EvolutionWhatsAppProvider | null = null;
  private static mockProviderInstance: MockWhatsAppProvider | null = null;

  static getProvider(type: WhatsAppProviderType = WhatsAppProviderType.EVOLUTION): WhatsAppProvider {
    if (type === WhatsAppProviderType.MOCK || env.NODE_ENV === 'test') {
      if (!this.mockProviderInstance) {
        this.mockProviderInstance = new MockWhatsAppProvider();
      }
      return this.mockProviderInstance;
    }

    if (type === WhatsAppProviderType.EVOLUTION) {
      if (!this.evolutionProviderInstance) {
        this.evolutionProviderInstance = new EvolutionWhatsAppProvider();
      }
      return this.evolutionProviderInstance;
    }

    throw new Error(`WhatsApp provider '${type}' is not yet supported`);
  }

  static getMockProvider(): MockWhatsAppProvider {
    if (!this.mockProviderInstance) {
      this.mockProviderInstance = new MockWhatsAppProvider();
    }
    return this.mockProviderInstance;
  }
}
