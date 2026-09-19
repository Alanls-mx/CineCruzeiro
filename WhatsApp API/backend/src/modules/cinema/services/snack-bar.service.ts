import { prisma } from '../../../database/prisma.js';
import { Product, ProductCategory } from '@prisma/client';

export class SnackBarService {
  async getProductsByCategory(companyId: string, category?: ProductCategory): Promise<Product[]> {
    return prisma.product.findMany({
      where: {
        companyId,
        category: category || undefined,
        isAvailable: true,
      },
      orderBy: {
        price: 'asc',
      },
    });
  }

  async getCategories(companyId: string): Promise<{ category: ProductCategory; count: number }[]> {
    const products = await prisma.product.findMany({
      where: { companyId, isAvailable: true },
      select: { category: true },
    });

    const counts = new Map<ProductCategory, number>();
    for (const p of products) {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([category, count]) => ({
      category,
      count,
    }));
  }

  async getProductById(companyId: string, productId: string): Promise<Product | null> {
    return prisma.product.findFirst({
      where: { id: productId, companyId },
    });
  }
}
