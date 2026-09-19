import { prisma } from '../../../database/prisma.js';
import { Movie } from '@prisma/client';
import { CommercialCatalogService } from './commercial-catalog.service.js';

export class MovieService {
  private readonly catalogService = CommercialCatalogService.getInstance();

  async listActiveMovies(companyId: string): Promise<Movie[]> {
    try {
      await this.catalogService.getCatalog();
    } catch {
      // ignore
    }
    return prisma.movie.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        title: 'asc',
      },
    });
  }

  async getMovieById(companyId: string, movieId: string): Promise<Movie | null> {
    return prisma.movie.findFirst({
      where: {
        id: movieId,
        companyId,
      },
    });
  }
}
