import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { MobileService } from './mobile.service';
import { GetBootstrapQueryDto } from './dto/get-bootstrap-query.dto';
import { GetMobileProgramQueryDto } from './dto/get-mobile-program-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActiveCongressGuard } from '../auth/active-congress.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-request';

@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  // DEGISTIRILMEDI (Faz 5 kisiti) - guard'siz kalir, TestFlight'taki mevcut
  // surum bunu kullaniyor.
  @Get('bootstrap')
  getBootstrap(@Query() query: GetBootstrapQueryDto) {
    return this.mobileService.getBootstrap(query.congressId);
  }

  // --- Faz 5: asagidaki tum uclar katilimci JWT'si + secili aktif kongre
  // gerektirir. congressId HICBIRINDE istemciden alinmaz, `user.congressId`
  // (ActiveCongressGuard'in doluluğunu garanti ettigi) kullanilir. ---

  @Get('home')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getHome(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getHome(user.congressId as string, user.id);
  }

  // Program buyuk ve nadiren degisebilecegi icin ETag/If-None-Match
  // destekler (bkz. Faz 5 talimati) - degismemisse mobil govdeyi tekrar
  // indirmez, yalnizca 304 alir.
  @Get('program')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  async getProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetMobileProgramQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const congressId = user.congressId as string;
    const etag = await this.mobileService.computeProgramEtag(congressId);
    res.setHeader('ETag', etag);

    if (ifNoneMatch === etag) {
      res.status(304);
      return;
    }

    return this.mobileService.getProgram(congressId, query);
  }

  @Get('program/days')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  async getProgramDays(@CurrentUser() user: AuthenticatedUser) {
    const days = await this.mobileService.getProgramDays(
      user.congressId as string,
    );
    return { generatedAt: new Date().toISOString(), days };
  }

  @Get('program/sessions/:id')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  async getProgramSessionDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const session = await this.mobileService.getSessionDetail(
      user.congressId as string,
      id,
    );
    return { generatedAt: new Date().toISOString(), session };
  }

  @Get('my-program')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getMyProgram(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getMyProgram(user.congressId as string, user.id);
  }

  @Get('announcements')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getAnnouncements(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getAnnouncements(user.congressId as string);
  }

  @Get('sponsors')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getSponsors(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getSponsors(user.congressId as string);
  }

  @Get('speakers')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getSpeakers(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getSpeakers(user.congressId as string);
  }

  @Get('venues')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getVenues(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getVenues(user.congressId as string);
  }

  @Get('info-sections')
  @UseGuards(JwtAuthGuard, ActiveCongressGuard)
  getInfoSections(@CurrentUser() user: AuthenticatedUser) {
    return this.mobileService.getInfoSections(user.congressId as string);
  }
}
