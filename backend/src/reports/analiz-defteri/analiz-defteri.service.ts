import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { createStreamingWorkbook } from '../excel/workbook-writer';
import { AnalizDefteriQueryDto } from '../dto/analiz-defteri-query.dto';
import { resolveFilter } from './resolved-filter';
import { loadLookupTables } from './lookup-tables';
import { yazHamGozlemSayfasi } from './ham-gozlem-sayfasi';
import { yazDakikaOzetiSayfasi } from './dakika-ozeti-sayfasi';
import { yazSalonZiyaretleriSayfasi } from './salon-ziyaretleri-sayfasi';
import { yazKullaniciSalonOzetiSayfasi } from './kullanici-salon-ozeti-sayfasi';
import { collectKapakOzet, yazKapakSayfasi } from './kapak-sayfasi';

// Faz 13a: orkestrasyon - sayfalar SIRAYLA yazılıp COMMIT edilir (akış
// tek yönlü, bkz. `workbook-writer.ts`). Kapak sayfası İLK eklenir (Excel'de
// ilk sırada görünsün diye) ama satırları EN SON, diğer tüm sayfalar
// yazılıp özet bilgiler (satır sayıları, kesme durumu) toplandıktan SONRA
// doldurulur - bu sıralamanın ExcelJS'te güvenli olduğu gerçek bir dosya
// üretilip XML'i incelenerek doğrulandı (bkz. docs/decisions.md "Faz 13a").
@Injectable()
export class AnalizDefteriService {
  constructor(private readonly prisma: PrismaService) {}

  async yazDefter(
    query: AnalizDefteriQueryDto,
    olusturanAdmin: string,
    res: Response,
  ): Promise<void> {
    const filter = await resolveFilter(this.prisma, query);
    const lookups = await loadLookupTables(this.prisma, filter.congressId);

    const workbook = createStreamingWorkbook(res);
    const kapakSayfasi = workbook.addWorksheet('Kapak');

    const hamGozlemSonuc = await yazHamGozlemSayfasi(
      workbook,
      this.prisma,
      filter,
      lookups,
    );
    const dakikaOzetiSatirSayisi = await yazDakikaOzetiSayfasi(
      workbook,
      this.prisma,
      filter,
      lookups,
    );
    const visits = await yazSalonZiyaretleriSayfasi(
      workbook,
      this.prisma,
      filter,
      lookups,
    );
    const kullaniciSalonOzetiSatirSayisi = yazKullaniciSalonOzetiSayfasi(
      workbook,
      visits,
      lookups,
    );

    const sayfaSatirSayilari = [
      { sayfa: 'Ham Gözlem', satir: hamGozlemSonuc.yazilanKayit },
      { sayfa: 'Dakika Özeti', satir: dakikaOzetiSatirSayisi },
      { sayfa: 'Salon Ziyaretleri', satir: visits.length },
      { sayfa: 'Kullanıcı-Salon Özeti', satir: kullaniciSalonOzetiSatirSayisi },
    ];

    const kapakOzet = await collectKapakOzet(
      this.prisma,
      filter,
      lookups,
      olusturanAdmin,
      hamGozlemSonuc,
      sayfaSatirSayilari,
    );
    yazKapakSayfasi(kapakSayfasi, kapakOzet);
    kapakSayfasi.commit();

    await workbook.commit();
  }
}
