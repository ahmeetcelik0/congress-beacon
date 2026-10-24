import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AnalizDefteriService } from './analiz-defteri/analiz-defteri.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [AdminAuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, AnalizDefteriService],
})
export class ReportsModule {}
