import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  console.log(
    messages.map((m) => ({
      id: m.id,
      content: m.content,
      sender: m.sender,
      direction: m.direction,
      externalMessageId: m.externalMessageId,
      createdAt: m.createdAt,
    }))
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
