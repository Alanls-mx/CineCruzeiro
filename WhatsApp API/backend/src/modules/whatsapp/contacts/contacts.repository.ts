import { prisma } from '../../../database/prisma.js';
import { Contact } from '@prisma/client';

export class ContactsRepository {
  async findOrCreate(companyId: string, phone: string, name?: string): Promise<Contact> {
    const contact = await prisma.contact.upsert({
      where: {
        companyId_phone: {
          companyId,
          phone,
        },
      },
      update: {
        lastSeenAt: new Date(),
        name: name || undefined,
      },
      create: {
        companyId,
        phone,
        name: name || phone,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });

    return contact;
  }

  async findById(companyId: string, id: string): Promise<Contact | null> {
    return prisma.contact.findFirst({
      where: { id, companyId },
    });
  }

  async findByPhone(companyId: string, phone: string): Promise<Contact | null> {
    return prisma.contact.findUnique({
      where: {
        companyId_phone: {
          companyId,
          phone,
        },
      },
    });
  }
}
