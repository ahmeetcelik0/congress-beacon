import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { CongressScopeDto } from '../attendance/dto/congress-scope.dto';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { AnalizDefteriQueryDto } from './dto/analiz-defteri-query.dto';
import { AnalizDefteriService } from './analiz-defteri/analiz-defteri.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedAdminRequest } from '../admin-auth/authenticated-admin-request';

// Dosya adında iki nokta üst üste gibi Windows'ta sorunlu karakterler
// OLMASIN diye ISO metninden yalnızca tarih+saat (dakika hassasiyeti)
// çıkarılır - saniye/milisaniye dosya adı için gereksiz ayrıntı.
function formatForFilename(isoString: string): string {
  return isoString.slice(0, 16).replace(':', '').replace('T', '-');
}

@Controller('reports')
@UseGuards(AdminJwtGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly analizDefteriService: AnalizDefteriService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('data-quality')
  getDataQuality(@Query() query: CongressScopeDto) {
    return this.reportsService.getDataQuality(query.congressId);
  }

  @Get('beacon-health')
  getBeaconHealth(@Query() query: CongressScopeDto) {
    return this.reportsService.getBeaconHealth(query.congressId);
  }

  @Get('notifications')
  getNotificationSummary(@Query() query: CongressScopeDto) {
    return this.reportsService.getNotificationSummary(query.congressId);
  }

  // Faz 13a: dosya adı filtreyi taşır - aynı klasörde birden fazla rapor
  // birikince (farklı tarih aralıklarıyla indirilmiş) ayırt edilebilsin
  // diye. Kongre kodu, header'ı ayarlamadan ÖNCE (stream'e yazmaya
  // başlamadan önce) bilinmesi gerektiği için ayrı, hafif bir sorguyla
  // alınır - `AnalizDefteriService` kendi içinde AYRICA kongre bilgisini
  // sorgular (kapak sayfası için), bu tekrar kabul edilebilir bir maliyet
  // (tek satırlık, index'li sorgu).
  // Faz 13b: panel "İndir"e basmadan ÖNCE bunu çağırır - dosya ÜRETİLMEZ,
  // yalnızca sayfa/satır sayısı tahmini döner (bkz. `satir-tahmini.ts`).
  @Get('analiz-defteri/tahmin')
  getAnalizDefteriTahmin(@Query() query: AnalizDefteriQueryDto) {
    return this.analizDefteriService.hesaplaTahmin(query);
  }

  @Get('analiz-defteri.xlsx')
  async getAnalizDefteri(
    @Query() query: AnalizDefteriQueryDto,
    @Req() req: AuthenticatedAdminRequest,
    @Res() res: Response,
  ) {
    const congress = await this.prisma.congress.findUniqueOrThrow({
      where: { id: query.congressId },
      select: { code: true },
    });
    const dosyaAdi = `beacon-analiz-${congress.code}-${formatForFilename(query.from)}_${formatForFilename(query.to)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${dosyaAdi}"`);

    const olusturanAdmin = req.admin?.name ?? req.admin?.email ?? 'Bilinmiyor';
    await this.analizDefteriService.yazDefter(query, olusturanAdmin, res);
  }
}
