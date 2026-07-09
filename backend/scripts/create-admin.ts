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
