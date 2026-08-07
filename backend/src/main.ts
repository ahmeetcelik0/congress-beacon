import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { UPLOADS_ROOT } from './uploads/uploads.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
