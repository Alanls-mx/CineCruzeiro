import { redisClient } from '../../queue/redis.js';
import { logger } from '../../config/logger.js';

export class MessageDebouncer {
  /**
   * Appends text to a debounce buffer in Redis.
   * If messages arrive within delayMs, they are grouped.
   */
  static async appendMessage(
    companyId: string,
    phone: string,
    text: string,
    debounceDelayMs: number
  ): Promise<void> {
    const key = `debounce:${companyId}:${phone}`;
    try {
      await redisClient.rpush(key, text);
      // Set expire in seconds (at least 5s)
      const ttlSec = Math.max(Math.ceil((debounceDelayMs * 2) / 1000), 5);
      await redisClient.expire(key, ttlSec);
    } catch (error: any) {
      logger.warn({ error: error.message, companyId, phone }, 'Debounce append failed');
    }
  }

  /**
   * Reads and flushes the debounced buffer for a phone number.
   */
  static async flushMessages(companyId: string, phone: string): Promise<string[]> {
    const key = `debounce:${companyId}:${phone}`;
    try {
      const messages = await redisClient.lrange(key, 0, -1);
      await redisClient.del(key);
      return messages;
    } catch (error: any) {
      logger.error({ error: error.message, companyId, phone }, 'Debounce flush failed');
      return [];
    }
  }
}
