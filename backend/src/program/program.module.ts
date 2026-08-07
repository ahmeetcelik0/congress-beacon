import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ProgramRoleMatchingService } from './program-role-matching.service';
import { PresentationsController } from './presentations/presentations.controller';
import { PresentationsService } from './presentations/presentations.service';
import { ProgramRolesController } from './program-roles/program-roles.controller';
import { ProgramRolesService } from './program-roles/program-roles.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [PresentationsController, ProgramRolesController],
  providers: [
    PresentationsService,
    ProgramRolesService,
    ProgramRoleMatchingService,
  ],
})
export class ProgramModule {}
