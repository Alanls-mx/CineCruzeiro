import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/database/prisma.js';
import { FastifyInstance } from 'fastify';

describe('WhatsApp Instances API (Multi-tenant)', () => {
  let app: FastifyInstance;
  let companyId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Fetch Cine Estação created by seed
    const company = await prisma.company.findUnique({
      where: { slug: 'cine-estacao' },
    });
    expect(company).toBeDefined();
    companyId = company!.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should reject request without x-company-id header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/whatsapp/instances',
    });

    expect(response.statusCode).toBe(401);
    const json = response.json();
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('should list instances for company', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/whatsapp/instances',
      headers: {
        'x-company-id': companyId,
      },
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(1);
  });

  it('should create a new mock instance for company', async () => {
    const uniqueName = `cine-unit-test-${Date.now()}`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/instances',
      headers: {
        'x-company-id': companyId,
      },
      payload: {
        instanceName: uniqueName,
        provider: 'MOCK',
      },
    });

    expect(response.statusCode).toBe(201);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.instance.instanceName).toBe(uniqueName);
    expect(json.data.instance.companyId).toBe(companyId);

    // Delete created instance to keep test clean
    await prisma.whatsAppInstance.delete({
      where: { id: json.data.instance.id },
    });
  });
});
