import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Database ready!');
  console.log('');
  console.log('To get started:');
  console.log('  1. Open http://localhost:3000');
  console.log('  2. Click "Get Started" to create an account');
  console.log('  3. Check the API terminal for your magic link');
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
