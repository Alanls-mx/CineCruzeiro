import { describe, it, expect, beforeEach } from 'vitest';
import { MockWhatsAppProvider } from '../../src/modules/whatsapp/providers/mock/mock-whatsapp.provider.js';

describe('WhatsAppProvider Abstraction', () => {
  let provider: MockWhatsAppProvider;

  beforeEach(() => {
    provider = new MockWhatsAppProvider();
    provider.clear();
  });

  it('should create an instance and return a QR code', async () => {
    const result = await provider.createInstance({
      instanceName: 'test-instance',
      webhookUrl: 'http://localhost:3333/webhooks/evolution',
    });

    expect(result.instanceName).toBe('test-instance');
    expect(result.qrcode?.base64).toBeDefined();
    expect(result.qrcode?.code).toBeDefined();
  });

  it('should send a text message and record it in sent messages', async () => {
    const result = await provider.sendText({
      instanceName: 'test-instance',
      to: '5511988887777',
      text: 'Olá! Teste LumixEngine.',
    });

    expect(result.status).toBe('SENT');
    expect(result.messageId).toBeDefined();

    const lastMsg = provider.getLastMessage('5511988887777');
    expect(lastMsg).toBeDefined();
    expect(lastMsg?.payload).toBe('Olá! Teste LumixEngine.');
  });

  it('should handle sendButtons and sendList', async () => {
    await provider.sendButtons({
      instanceName: 'test-instance',
      to: '5511988887777',
      title: 'Menu Principal',
      description: 'Escolha uma opção:',
      buttons: [
        { id: 'PROGRAMMING', displayText: '🎬 Programação' },
        { id: 'BUY_TICKET', displayText: '🎟️ Ingressos' },
      ],
    });

    expect(provider.sentMessages.length).toBe(1);
    expect(provider.sentMessages[0].type).toBe('buttons');

    await provider.sendList({
      instanceName: 'test-instance',
      to: '5511988887777',
      title: 'Filmes',
      description: 'Em cartaz',
      buttonText: 'Ver Filmes',
      sections: [
        {
          title: 'Destaques',
          rows: [{ id: 'MOVIE_1', title: 'Superman' }],
        },
      ],
    });

    expect(provider.sentMessages.length).toBe(2);
    expect(provider.sentMessages[1].type).toBe('list');
  });

  it('should throw WhatsAppProviderError when shouldFail is true', async () => {
    provider.shouldFail = true;

    await expect(
      provider.sendText({
        instanceName: 'test-instance',
        to: '5511988887777',
        text: 'Erro esperado',
      })
    ).rejects.toThrow('Simulated WhatsApp Provider Failure');
  });
});
