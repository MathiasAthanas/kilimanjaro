import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.performanceEngineConfig.findFirst();
  if (!existing) {
    await prisma.performanceEngineConfig.create({
      data: {
        updatedBy: 'seed',
      },
    });
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });