import { prisma } from '../../../database/prisma.js';
import { logger } from '../../../config/logger.js';

export class IdempotencyService {
  /**
   * Attempts to register the event atomically.
   * Returns `true` if this is the first time seeing the event (should process).
   * Returns `false` if the event was already processed (should discard).
   */
  async registerEvent(
    companyId: string,
    provider: string,
    eventId: string,
    eventType: string
  ): Promise<boolean> {
    try {
      await prisma.processedEvent.create({
        data: {
          companyId,
          provider,
          eventId,
          eventType,
        },
      });
      return true;
    } catch (error: any) {
      // Prisma unique constraint violation (P2002)
      if (error.code === 'P2002') {
        logger.info(
          { companyId, provider, eventId, eventType },
          'Duplicate webhook event detected and discarded'
        );
        return false;
      }
      logger.error(
        { error: error.message, companyId, eventId },
        'Error checking webhook idempotency'
      );
      throw error;
    }
  }
}
