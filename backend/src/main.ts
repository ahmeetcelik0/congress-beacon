import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Yerel gelistirmede (Berke ve Ahmet icin) hicbir sey degismesin diye prefix
  // yalnizca API_PREFIX ortam degiskeni verildiginde devreye girer (production'da 'api').
  if (process.env.API_PREFIX) {
    app.setGlobalPrefix(process.env.API_PREFIX);
  }
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
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
