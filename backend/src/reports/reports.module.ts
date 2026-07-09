import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AdminAuthModule, AttendanceModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
