import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProgramRolesService } from './program-roles.service';
import { CreateProgramRoleDto } from './dto/create-program-role.dto';
import { UpdateProgramRoleDto } from './dto/update-program-role.dto';
import { LinkProgramRoleDto } from './dto/link-program-role.dto';
import { RematchDto } from './dto/rematch.dto';
import { ProgramRolesQueryDto } from './dto/program-roles-query.dto';
import { AdminJwtGuard } from '../../admin-auth/admin-jwt.guard';
import { AuditLogInterceptor } from '../../admin-auth/audit-log.interceptor';

@Controller('admin/program-roles')
@UseGuards(AdminJwtGuard)
@UseInterceptors(AuditLogInterceptor)
export class ProgramRolesController {
  constructor(private readonly programRolesService: ProgramRolesService) {}

  @Post()
  create(@Body() dto: CreateProgramRoleDto) {
    return this.programRolesService.create(dto);
  }

  @Post('rematch')
  rematch(@Body() dto: RematchDto) {
    return this.programRolesService.rematch(dto.congressId);
  }

  @Get('matches')
  listMatches(@Query() query: ProgramRolesQueryDto) {
    return this.programRolesService.listMatches(query);
  }

  @Get(':id/candidates')
  candidates(@Param('id') id: string) {
    return this.programRolesService.candidates(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProgramRoleDto) {
    return this.programRolesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.programRolesService.remove(id);
  }

  @Post(':id/link')
  link(@Param('id') id: string, @Body() dto: LinkProgramRoleDto) {
    return this.programRolesService.link(id, dto.userId);
  }

  @Post(':id/ignore')
  ignore(@Param('id') id: string) {
    return this.programRolesService.ignore(id);
  }
}
