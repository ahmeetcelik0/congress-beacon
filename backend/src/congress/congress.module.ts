import { Module } from '@nestjs/common';
import { CongressController } from './congress.controller';
import { CongressService } from './congress.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [AdminAuthModule, UploadsModule],
  controllers: [CongressController],
  providers: [CongressService],
  exports: [CongressService],
})
export class CongressModule {}
