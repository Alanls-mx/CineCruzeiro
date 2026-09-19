import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.company.updateMany({
    data: {
      name: 'Cine Cruzeiro',
    },
  });
  console.log('Updated companies count:', res.count);

  const settings = await prisma.whatsAppSettings.findMany();
  for (const s of settings) {
    if (s.welcomeMessage && s.welcomeMessage.includes('Cine Estação')) {
      await prisma.whatsAppSettings.update({
        where: { id: s.id },
        data: {
          welcomeMessage: s.welcomeMessage.replace(/Cine Estação/g, 'Cine Cruzeiro'),
        },
      });
      console.log('Updated welcomeMessage for settings id:', s.id);
    }
  }

  const companies = await prisma.company.findMany();
  console.log('Current companies in DB:', companies);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
