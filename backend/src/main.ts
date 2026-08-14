import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { UPLOADS_ROOT } from './uploads/uploads.service';

async function bootstrap() {
  // Faz 8'de gercek cihazda HTTP 413 alindi: Express'in varsayilan JSON govde
  // siniri ~100KB, kalici gozlem kuyrugundan gelen buyuk batch'ler (500 kayit
  // ~375KB) bunu asiyordu - istemci tarafinda batch boyutu 50'ye dusurulerek
  // gecici cozuldu (bkz. docs/decisions.md "Faz 8"). Bu faz zaten backend'e
  // dokundugu icin kalici cozum burada: govde siniri 2MB'a cikarilir, mobil
  // tarafta batch boyutu buna gore yeniden yukseltilir (bkz. Faz 9 talimati
  // §1). `bodyParser: false` + `useBodyParser(...)`: Nest'in KENDI varsayilan
  // parser kaydini devre disi birakip ayni parser'i ISTENEN limitle ELLE
  // kaydetmenin resmi yolu (bkz. NestExpressApplication.useBodyParser).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '2mb' });
  app.useBodyParser('urlencoded', { limit: '2mb', extended: true });
  // Yerel gelistirmede (Berke ve Ahmet icin) hicbir sey degismesin diye prefix
  // yalnizca API_PREFIX ortam degiskeni verildiginde devreye girer (production'da 'api').
  const apiPrefix = process.env.API_PREFIX;
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  // Yuklenen gorseller icin statik dosya sunumu. setGlobalPrefix() statik
  // varliklara OTOMATIK uygulanmaz - bu yuzden ayni prefix'i burada elle
  // tekrarliyoruz. Boylece production'da dosyalar /api/uploads/... altinda
  // servis edilir ve Caddy'nin zaten var olan `/api/*` -> backend kuralinin
  // KAPSAMINA girer, Caddyfile'a ayrica bir `/uploads/*` kurali eklemeye
  // gerek kalmaz (bkz. docs/decisions.md).
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: apiPrefix ? `/${apiPrefix}/uploads` : '/uploads',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
