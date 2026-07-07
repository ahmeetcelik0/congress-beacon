import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { CongressModule } from './congress/congress.module';
import { HallModule } from './hall/hall.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    CongressModule,
    HallModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
