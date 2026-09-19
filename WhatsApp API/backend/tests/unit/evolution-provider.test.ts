import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { EvolutionWhatsAppProvider } from '../../src/modules/whatsapp/providers/evolution/evolution-whatsapp.provider.js';

vi.mock('axios');

describe('EvolutionWhatsAppProvider Self-Healing & Resilience', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance);
  });

  it('should auto-provision instance when Evolution returns 404 instance does not exist', async () => {
    const provider = new EvolutionWhatsAppProvider('http://localhost:8080', 'test-key');

    // 1. sendText fails with 404 "does not exist"
    mockAxiosInstance.post.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { message: ['The "cine-test" instance does not exist'] },
      },
    });

    // 2. createInstance succeeds
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { instance: { id: 'inst-1', status: 'created' } },
    });

    // 3. getConnectionStatus returns connecting (not yet scanned)
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: { instance: { state: 'connecting' } },
    });

    const result = await provider.sendText({
      instanceName: 'cine-test',
      to: '5511999998888',
      text: 'Olá Cine!',
    });

    expect(result.status).toBe('PENDING');
    expect(result.messageId).toContain('pending_');
    // Verify createInstance was triggered
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/instance/create', expect.objectContaining({
      instanceName: 'cine-test',
    }));
  });

  it('should handle Connection Closed gracefully by recording message as PENDING', async () => {
    const provider = new EvolutionWhatsAppProvider('http://localhost:8080', 'test-key');

    // sendText fails with 400 Connection Closed
    mockAxiosInstance.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { message: 'Connection Closed' },
      },
    });

    // getConnectionStatus confirms state is close
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: { instance: { state: 'close' } },
    });

    const result = await provider.sendText({
      instanceName: 'cine-test',
      to: '5511999998888',
      text: 'Olá Cine!',
    });

    expect(result.status).toBe('PENDING');
    expect(result.messageId).toContain('pending_');
  });

  it('should successfully send text message when instance is open', async () => {
    const provider = new EvolutionWhatsAppProvider('http://localhost:8080', 'test-key');

    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        key: { id: 'evo_msg_123' },
      },
    });

    const result = await provider.sendText({
      instanceName: 'cine-test',
      to: '5511999998888',
      text: 'Olá Cine!',
    });

    expect(result.status).toBe('SENT');
    expect(result.messageId).toBe('evo_msg_123');
  });
});
