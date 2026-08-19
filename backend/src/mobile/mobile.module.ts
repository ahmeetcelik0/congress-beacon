import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AuthModule } from '../auth/auth.module';

// AuthModule, Faz 5'te eklenen katilimci-korumali okuma uclari
// (JwtAuthGuard + ActiveCongressGuard) icin gerekli - /mobile/bootstrap
// bunlardan bagimsiz, guardsiz kalmaya devam eder.
@Module({
  imports: [AuthModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
