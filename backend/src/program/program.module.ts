import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { ProgramRoleMatchingService } from './program-role-matching.service';
import { PresentationsController } from './presentations/presentations.controller';
import { PresentationsService } from './presentations/presentations.service';
import { ProgramRolesController } from './program-roles/program-roles.controller';
import { ProgramRolesService } from './program-roles/program-roles.service';
import { AnthropicClientProvider } from './extraction/anthropic-client.provider';
import { ProgramExtractionService } from './extraction/program-extraction.service';
import { ProgramImportQueueService } from './extraction/program-import-queue.service';
import { ProgramImportsController } from './imports/program-imports.controller';
import { ProgramImportsService } from './imports/program-imports.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [
    PresentationsController,
    ProgramRolesController,
    ProgramImportsController,
  ],
  providers: [
    PresentationsService,
    ProgramRolesService,
    ProgramRoleMatchingService,
    AnthropicClientProvider,
    ProgramExtractionService,
    ProgramImportQueueService,
    ProgramImportsService,
  ],
})
export class ProgramModule {}
