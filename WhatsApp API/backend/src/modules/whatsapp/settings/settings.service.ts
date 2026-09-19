import { prisma } from '../../../database/prisma.js';
import { UpdateSettingsInput } from './settings.schema.js';

export class SettingsService {
  async getSettings(companyId: string) {
    let settings = await prisma.whatsAppSettings.findUnique({
      where: { companyId },
    });

    if (!settings) {
      settings = await prisma.whatsAppSettings.create({
        data: {
          companyId,
        },
      });
    }

    return settings;
  }

  async updateSettings(companyId: string, input: UpdateSettingsInput) {
    return prisma.whatsAppSettings.upsert({
      where: { companyId },
      update: input,
      create: {
        companyId,
        ...input,
      },
    });
  }
}
