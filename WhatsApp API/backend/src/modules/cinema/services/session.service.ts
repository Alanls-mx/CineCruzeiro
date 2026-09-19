import { prisma } from '../../../database/prisma.js';
import { Session, SessionStatus } from '@prisma/client';

export class SessionService {
  async getSessionsByDate(companyId: string, date: Date, movieId?: string) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.session.findMany({
      where: {
        companyId,
        movieId: movieId || undefined,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: SessionStatus.SCHEDULED,
      },
      include: {
        movie: true,
        room: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  async getMoviesWithSessionsByDate(companyId: string, date: Date) {
    const sessions = await this.getSessionsByDate(companyId, date);
    const movieMap = new Map<string, { movie: any; sessionsCount: number }>();

    for (const s of sessions) {
      if (!movieMap.has(s.movie.id)) {
        movieMap.set(s.movie.id, {
          movie: s.movie,
          sessionsCount: 0,
        });
      }
      movieMap.get(s.movie.id)!.sessionsCount++;
    }

    return Array.from(movieMap.values());
  }

  async getSessionById(companyId: string, sessionId: string) {
    return prisma.session.findFirst({
      where: {
        id: sessionId,
        companyId,
      },
      include: {
        movie: true,
        room: true,
      },
    });
  }
}
