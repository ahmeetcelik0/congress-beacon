// KALICI yardimci betik - yeni bir panel yoneticisi olusturmak/mevcut birinin
// sifresini sifirlamak icin production'da da elle calistirilir (upsert,
// tekrar calistirmak guvenli). Once derle, sonra derlenmis JS'i calistir
// ("npx ts-node scripts/..." DEGIL - Prisma'nin ozel cikti yolu ts-node'un
// CJS transpilasyonuyla runtime'da cozumlenemiyor):
//   npm run build && node dist/scripts/create-admin.js <email> <sifre> [isim]
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error(
      'Kullanim: npx ts-node scripts/create-admin.ts <email> <sifre> [isim]',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
  });

  const passwordHash = await hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name: name ?? email },
    create: { email, passwordHash, name: name ?? email },
  });

  console.log(`Admin kullanici hazir: ${admin.email} (id: ${admin.id})`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
