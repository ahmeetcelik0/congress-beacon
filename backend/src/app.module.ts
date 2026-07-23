import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { CongressModule } from './congress/congress.module';
import { HallModule } from './hall/hall.module';
import { BeaconModule } from './beacon/beacon.module';
import { HallBeaconModule } from './hall-beacon/hall-beacon.module';
import { MobileModule } from './mobile/mobile.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ObservationsModule } from './observations/observations.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TrackingHealthModule } from './tracking-health/tracking-health.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SessionModule } from './session/session.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    CongressModule,
    HallModule,
    BeaconModule,
    HallBeaconModule,
    MobileModule,
    AuthModule,
    DevicesModule,
    ObservationsModule,
    AttendanceModule,
    AdminAuthModule,
    TrackingHealthModule,
    ReportsModule,
    NotificationsModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
