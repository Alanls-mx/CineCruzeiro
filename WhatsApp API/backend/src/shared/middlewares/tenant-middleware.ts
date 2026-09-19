import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../database/prisma.js';
import { ForbiddenError, NotFoundError } from '../errors/app-error.js';
import { env } from '../../config/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    company?: {
      id: string;
      name: string;
      slug: string;
    };
  }
}

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const company = await prisma.company.findUnique({
    where: { slug: env.CINE_COMPANY_SLUG },
    select: { id: true, name: true, slug: true, isActive: true },
  });

  if (!company) {
    throw new NotFoundError(`Company '${env.CINE_COMPANY_SLUG}' not found`);
  }

  if (!company.isActive) {
    throw new ForbiddenError(`Company '${company.name}' is inactive`);
  }

  request.company = company;
}
