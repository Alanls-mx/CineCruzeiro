import { PrismaClient, MovieRating, RoomType, AudioType, SessionFormat, ProductCategory, WhatsAppProviderType } from '@prisma/client';
import { WhatsAppProviderFactory } from '../src/modules/whatsapp/providers/whatsapp-provider.factory.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting LumixEngine seed...');

  // 1. Create or update Company: Cine Cruzeiro
  const company = await prisma.company.upsert({
    where: { slug: 'cine-cruzeiro' },
    update: {
      name: 'Cine Cruzeiro',
      isActive: true,
    },
    create: {
      name: 'Cine Cruzeiro',
      slug: 'cine-cruzeiro',
      isActive: true,
    },
  });

  console.log(`🎬 Company ready: ${company.name} (${company.id})`);

  // 2. Default WhatsApp Settings
  await prisma.whatsAppSettings.upsert({
    where: { companyId: company.id },
    update: {
      welcomeMessage: 'Olá! 👋 Bem-vindo ao Cine Cruzeiro. Como podemos te ajudar hoje?',
    },
    create: {
      companyId: company.id,
      autoReplyEnabled: true,
      welcomeMessage: 'Olá! 👋 Bem-vindo ao Cine Cruzeiro. Como podemos te ajudar hoje?',
      fallbackMessage: 'Desculpe, não consegui entender essa opção. Escolha uma das alternativas abaixo:',
      outOfHoursMessage: 'Nosso atendimento humano está fechado no momento (Seg-Dom das 13h às 22h), mas você pode consultar a programação e os ingressos normalmente!',
      workingHours: {
        monday: { start: '13:00', end: '22:00', enabled: true },
        tuesday: { start: '13:00', end: '22:00', enabled: true },
        wednesday: { start: '13:00', end: '22:00', enabled: true },
        thursday: { start: '13:00', end: '22:00', enabled: true },
        friday: { start: '13:00', end: '23:00', enabled: true },
        saturday: { start: '13:00', end: '23:00', enabled: true },
        sunday: { start: '13:00', end: '22:00', enabled: true },
      },
      autoCloseMinutes: 60,
      debounceDelayMs: 3000,
      humanSupportEnabled: true,
      showProgramming: true,
      showTickets: true,
      showSnackBar: true,
      maxFallbackCount: 3,
    },
  });

  // 3. Default WhatsApp Instance
  const webhookEndpoint = process.env.EVOLUTION_WEBHOOK_URL
    || (process.env.APP_URL ? `${process.env.APP_URL}/webhooks/evolution` : 'http://localhost:3333/webhooks/evolution');

  await prisma.whatsAppInstance.upsert({
    where: { instanceName: 'cine-cruzeiro-whatsapp' },
    update: {
      webhookUrl: webhookEndpoint,
    },
    create: {
      companyId: company.id,
      instanceName: 'cine-cruzeiro-whatsapp',
      provider: WhatsAppProviderType.EVOLUTION,
      status: 'DISCONNECTED',
      webhookUrl: webhookEndpoint,
    },
  });

  // Provision in Evolution API gateway if reachable
  try {
    const provider = WhatsAppProviderFactory.getProvider(WhatsAppProviderType.EVOLUTION);
    await provider.createInstance({
      instanceName: 'cine-cruzeiro-whatsapp',
      webhookUrl: webhookEndpoint,
    });
    console.log('📱 Provisioned "cine-cruzeiro-whatsapp" on Evolution API');
  } catch (err: any) {
    console.log('ℹ️ Evolution API provisioning note:', err.message);
  }

  // 4. Clean previous dynamic seed records for idempotent rerun
  await prisma.orderItem.deleteMany({ where: { order: { companyId: company.id } } });
  await prisma.ticket.deleteMany({ where: { order: { companyId: company.id } } });
  await prisma.order.deleteMany({ where: { companyId: company.id } });
  await prisma.session.deleteMany({ where: { companyId: company.id } });
  await prisma.product.deleteMany({ where: { companyId: company.id } });
  await prisma.movie.deleteMany({ where: { companyId: company.id } });
  await prisma.room.deleteMany({ where: { companyId: company.id } });

  // 5. Create Cinema Rooms
  const room1 = await prisma.room.create({
    data: {
      companyId: company.id,
      name: 'Sala 1 - Laser 4K',
      capacity: 180,
      type: RoomType.STANDARD,
    },
  });

  const room2 = await prisma.room.create({
    data: {
      companyId: company.id,
      name: 'Sala 2 - IMAX Experience',
      capacity: 250,
      type: RoomType.IMAX,
    },
  });

  const room3 = await prisma.room.create({
    data: {
      companyId: company.id,
      name: 'Sala 3 - VIP Prime Lounge',
      capacity: 80,
      type: RoomType.VIP,
    },
  });

  // 5. Create Movies
  const movieSuperman = await prisma.movie.create({
    data: {
      companyId: company.id,
      title: 'Superman',
      description: 'O herói de Metrópolis enfrenta um novo desafio moral e cósmico na reconstrução do mundo moderno.',
      durationMinutes: 150,
      rating: MovieRating.AGE_12,
      genre: 'Ação / Ficção Científica',
      isActive: true,
    },
  });

  const movieDivertidaMente = await prisma.movie.create({
    data: {
      companyId: company.id,
      title: 'Divertida Mente 2',
      description: 'Riley agora é uma adolescente e novas emoções como Ansiedade e Vergonha assumem a sala de controle.',
      durationMinutes: 96,
      rating: MovieRating.L,
      genre: 'Animação / Família',
      isActive: true,
    },
  });

  const movieDeadpool = await prisma.movie.create({
    data: {
      companyId: company.id,
      title: 'Deadpool & Wolverine',
      description: 'A dupla improvável se une em uma missão insana pelas linhas temporais do multiverso.',
      durationMinutes: 128,
      rating: MovieRating.AGE_18,
      genre: 'Ação / Comédia',
      isActive: true,
    },
  });

  // 6. Create Sessions for Today and Tomorrow
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today sessions
  await prisma.session.createMany({
    data: [
      {
        companyId: company.id,
        movieId: movieSuperman.id,
        roomId: room2.id,
        startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 14:00
        endTime: new Date(today.getTime() + 16.5 * 60 * 60 * 1000),
        audioType: AudioType.DUBBED,
        format: SessionFormat.D3D,
        price: 38.0,
        availableSeats: 120,
      },
      {
        companyId: company.id,
        movieId: movieSuperman.id,
        roomId: room2.id,
        startTime: new Date(today.getTime() + 18 * 60 * 60 * 1000), // 18:00
        endTime: new Date(today.getTime() + 20.5 * 60 * 60 * 1000),
        audioType: AudioType.SUBTITLED,
        format: SessionFormat.D3D,
        price: 42.0,
        availableSeats: 85,
      },
      {
        companyId: company.id,
        movieId: movieSuperman.id,
        roomId: room3.id,
        startTime: new Date(today.getTime() + 21 * 60 * 60 * 1000), // 21:00
        endTime: new Date(today.getTime() + 23.5 * 60 * 60 * 1000),
        audioType: AudioType.SUBTITLED,
        format: SessionFormat.D2D,
        price: 55.0,
        availableSeats: 30,
      },
      {
        companyId: company.id,
        movieId: movieDivertidaMente.id,
        roomId: room1.id,
        startTime: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 15:00
        endTime: new Date(today.getTime() + 16.6 * 60 * 60 * 1000),
        audioType: AudioType.DUBBED,
        format: SessionFormat.D2D,
        price: 28.0,
        availableSeats: 150,
      },
      {
        companyId: company.id,
        movieId: movieDeadpool.id,
        roomId: room1.id,
        startTime: new Date(today.getTime() + 19.5 * 60 * 60 * 1000), // 19:30
        endTime: new Date(today.getTime() + 21.6 * 60 * 60 * 1000),
        audioType: AudioType.SUBTITLED,
        format: SessionFormat.D2D,
        price: 32.0,
        availableSeats: 90,
      },
      // Tomorrow sessions
      {
        companyId: company.id,
        movieId: movieSuperman.id,
        roomId: room2.id,
        startTime: new Date(tomorrow.getTime() + 16 * 60 * 60 * 1000), // 16:00
        endTime: new Date(tomorrow.getTime() + 18.5 * 60 * 60 * 1000),
        audioType: AudioType.DUBBED,
        format: SessionFormat.D3D,
        price: 38.0,
        availableSeats: 210,
      },
      {
        companyId: movieDivertidaMente.companyId,
        movieId: movieDivertidaMente.id,
        roomId: room1.id,
        startTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000), // 14:00
        endTime: new Date(tomorrow.getTime() + 15.6 * 60 * 60 * 1000),
        audioType: AudioType.DUBBED,
        format: SessionFormat.D2D,
        price: 28.0,
        availableSeats: 170,
      },
    ],
  });

  // 7. Create Bomboniere Products
  await prisma.product.createMany({
    data: [
      {
        companyId: company.id,
        name: 'Pipoca Grande Salgada com Manteiga',
        description: 'Balde de 150g com milho especial estourado na manteiga de cinema.',
        category: ProductCategory.POPCORN,
        price: 26.0,
        stock: 500,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Pipoca Doce Caramelo Crocante',
        description: 'Balde de 160g de pipoca coberta com caramelo artesanal crocante.',
        category: ProductCategory.POPCORN,
        price: 29.0,
        stock: 300,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Coca-Cola 700ml',
        description: 'Refrigerante gelado servido no copo temático com gelo.',
        category: ProductCategory.BEVERAGE,
        price: 14.0,
        stock: 1000,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Água Mineral Crystal 500ml',
        description: 'Sem gás ou com gás.',
        category: ProductCategory.BEVERAGE,
        price: 7.0,
        stock: 800,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Super Combo Casal',
        description: '1 Pipoca Grande Mista/Salgada + 2 Refrigerantes 700ml + 1 M&Ms 120g.',
        category: ProductCategory.COMBO,
        price: 64.9,
        stock: 250,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Combo Individual Prime',
        description: '1 Pipoca Média + 1 Refrigerante 500ml + 1 Balinha Fini.',
        category: ProductCategory.COMBO,
        price: 42.0,
        stock: 300,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Chocolate M&Ms Amendoim 120g',
        description: 'Chocolate ao leite com amendoim crocante em embalagem prática.',
        category: ProductCategory.CANDY,
        price: 16.0,
        stock: 200,
        isAvailable: true,
      },
      {
        companyId: company.id,
        name: 'Balas Fini Tubes Morango Ácido 80g',
        description: 'Tubes recheados com sabor morango e toque cítrico.',
        category: ProductCategory.CANDY,
        price: 10.0,
        stock: 400,
        isAvailable: true,
      },
    ],
  });

  console.log('✅ Seed completed successfully! Cine Cruzeiro ready.');
}

main()
  .catch((e) => {
    console.error('❌ Error executing seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
