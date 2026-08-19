import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ActiveCongressGuard } from './active-congress.guard';
import { ThrottleByTargetGuard } from './throttle-by-target.guard';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    // Iki isimli izleyici: 'perMinute' (dk 1) + 'perHour' (saat 5) -
    // register-request/forgot-password bu ikisini birlikte kullanir; login
    // yalnizca 'perMinute'i (limit 10'a override edilerek) kullanir, bkz.
    // auth.controller.ts.
    ThrottlerModule.forRoot([
      { name: 'perMinute', ttl: 60_000, limit: 1 },
      { name: 'perHour', ttl: 3_600_000, limit: 5 },
    ]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    ActiveCongressGuard,
    ThrottleByTargetGuard,
  ],
  exports: [JwtAuthGuard, ActiveCongressGuard, JwtModule],
})
export class AuthModule {}
