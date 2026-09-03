import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { createStreamingWorkbook } from '../excel/workbook-writer';
import { AnalizDefteriQueryDto } from '../dto/analiz-defteri-query.dto';
import { resolveFilter, sayfaSecili } from './resolved-filter';
import { loadLookupTables } from './lookup-tables';
import { yazHamGozlemSayfasi } from './ham-gozlem-sayfasi';
import { yazDakikaOzetiSayfasi } from './dakika-ozeti-sayfasi';
import {
  fetchAttendanceEventsInRange,
  yazGirisCikisOlaylariSayfasi,
  type AttendanceEventRow,
} from './giris-cikis-olaylari-sayfasi';
import { yazKararDetayiSayfasi } from './karar-detayi-sayfasi';
import {
  fetchHallVisitsInRange,
  yazSalonZiyaretleriSayfasi,
  type HallVisitRow,
} from './salon-ziyaretleri-sayfasi';
import { yazKullaniciSalonOzetiSayfasi } from './kullanici-salon-ozeti-sayfasi';
import { yazCihazVeRssiSayfasi } from './cihaz-ve-rssi-sayfasi';
import { yazGonderimSagligiSayfasi } from './gonderim-sagligi-sayfasi';
import { yazKatilimcilarSayfasi } from './katilimcilar-sayfasi';
import { yazBeaconEnvanteriSayfasi } from './beacon-envanteri-sayfasi';
import { yazKongreAyarlariSayfasi } from './kongre-ayarlari-sayfasi';
import { yazProgramSayfasi } from './program-sayfasi';
import { yazVeriSozlugu } from './veri-sozlugu-sayfasi';
import { collectKapakOzet, yazKapakSayfasi } from './kapak-sayfasi';
import { hesaplaSatirTahmini, type SatirTahminiSonuc } from './satir-tahmini';

// Faz 13a/13b: orkestrasyon - sayfalar SIRAYLA yazılıp COMMIT edilir (akış
// tek yönlü, bkz. `workbook-writer.ts`). Kapak sayfası İLK eklenir (Excel'de
// ilk sırada görünsün diye) ama satırları EN SON, diğer tüm sayfalar
// yazılıp özet bilgiler (satır sayıları, kesme durumu) toplandıktan SONRA
// doldurulur (bkz. Faz 13a "Faz 13a" bulgusu).
//
// Faz 13b: bir sayfa SEÇİLİ DEĞİLSE `addWorksheet` HİÇ ÇAĞRILMAZ - Excel'de
// sayfa sırası `addWorksheet` çağrılma sırasına göre belirlendiği için,
// atlanan bir sayfa aradan sessizce çıkar, kalanların sırası BOZULMAZ.
// Karar Detayı, Giriş-Çıkış Olayları'nın ZATEN ÇEKTİĞİ event listesini
// KULLANIR - Giriş-Çıkış Olayları seçili değilse ama Karar Detayı seçiliyse
// event listesi YİNE DE (sayfa YAZILMADAN) çekilir, sorgu TEKRARLANMAZ.
@Injectable()
export class AnalizDefteriService {
  constructor(private readonly prisma: PrismaService) {}

  // Faz 13b: panel "İndir"e basmadan ÖNCE bu metodu çağırır - sayfa
  // seçimi/filtre AYNI DTO ile gelir, dosya HİÇ ÜRETİLMEZ, yalnızca sayım
  // sorguları çalışır (bkz. `satir-tahmini.ts`).
  async hesaplaTahmin(
    query: AnalizDefteriQueryDto,
  ): Promise<SatirTahminiSonuc> {
    const filter = await resolveFilter(this.prisma, query);
    return hesaplaSatirTahmini(this.prisma, filter);
  }

  async yazDefter(
    query: AnalizDefteriQueryDto,
    olusturanAdmin: string,
    res: Response,
  ): Promise<void> {
    const filter = await resolveFilter(this.prisma, query);
    const lookups = await loadLookupTables(this.prisma, filter.congressId);

    const workbook = createStreamingWorkbook(res);
    const kapakSayfasi = workbook.addWorksheet('Kapak');

    const sayfaSatirSayilari: { sayfa: string; satir: number }[] = [];

    const hamGozlemSonuc = sayfaSecili(filter, 'hamGozlem')
      ? await yazHamGozlemSayfasi(workbook, this.prisma, filter, lookups)
      : null;
    if (hamGozlemSonuc) {
      sayfaSatirSayilari.push({
        sayfa: 'Ham Gözlem',
        satir: hamGozlemSonuc.yazilanKayit,
      });
    }

    if (sayfaSecili(filter, 'dakikaOzeti')) {
      const satir = await yazDakikaOzetiSayfasi(
        workbook,
        this.prisma,
        filter,
        lookups,
      );
      sayfaSatirSayilari.push({ sayfa: 'Dakika Özeti', satir });
    }

    // Giriş-Çıkış Olayları / Karar Detayı: event listesi PAYLAŞILIR.
    let events: AttendanceEventRow[] = [];
    if (sayfaSecili(filter, 'girisCikisOlaylari')) {
      events = await yazGirisCikisOlaylariSayfasi(
        workbook,
        this.prisma,
        filter,
        lookups,
      );
      sayfaSatirSayilari.push({
        sayfa: 'Giriş-Çıkış Olayları',
        satir: events.length,
      });
    } else if (sayfaSecili(filter, 'kararDetayi')) {
      events = await fetchAttendanceEventsInRange(this.prisma, filter);
    }
    if (sayfaSecili(filter, 'kararDetayi')) {
      const satir = yazKararDetayiSayfasi(workbook, events, lookups);
      sayfaSatirSayilari.push({ sayfa: 'Karar Detayı', satir });
    }

    // Salon Ziyaretleri / Kullanıcı-Salon Özeti: visits listesi PAYLAŞILIR
    // (bkz. Faz 13a orkestrasyonu).
    let visits: HallVisitRow[] = [];
    if (sayfaSecili(filter, 'salonZiyaretleri')) {
      visits = await yazSalonZiyaretleriSayfasi(
        workbook,
        this.prisma,
        filter,
        lookups,
      );
      sayfaSatirSayilari.push({
        sayfa: 'Salon Ziyaretleri',
        satir: visits.length,
      });
    } else if (sayfaSecili(filter, 'kullaniciSalonOzeti')) {
      visits = await fetchHallVisitsInRange(this.prisma, filter);
    }
    if (sayfaSecili(filter, 'kullaniciSalonOzeti')) {
      const satir = yazKullaniciSalonOzetiSayfasi(workbook, visits, lookups);
      sayfaSatirSayilari.push({ sayfa: 'Kullanıcı-Salon Özeti', satir });
    }

    if (sayfaSecili(filter, 'cihazVeRssi')) {
      const satir = await yazCihazVeRssiSayfasi(
        workbook,
        this.prisma,
        filter,
        lookups,
      );
      sayfaSatirSayilari.push({ sayfa: 'Cihaz ve RSSI', satir });
    }

    if (sayfaSecili(filter, 'gonderimSagligi')) {
      const satir = await yazGonderimSagligiSayfasi(
        workbook,
        this.prisma,
        filter,
        lookups,
      );
      sayfaSatirSayilari.push({ sayfa: 'Gönderim Sağlığı', satir });
    }

    if (sayfaSecili(filter, 'katilimcilar')) {
      const satir = await yazKatilimcilarSayfasi(workbook, this.prisma, filter);
      sayfaSatirSayilari.push({ sayfa: 'Katılımcılar', satir });
    }

    if (sayfaSecili(filter, 'beaconEnvanteri')) {
      const satir = await yazBeaconEnvanteriSayfasi(
        workbook,
        this.prisma,
        filter,
      );
      sayfaSatirSayilari.push({ sayfa: 'Beacon Envanteri', satir });
    }

    if (sayfaSecili(filter, 'kongreAyarlari')) {
      yazKongreAyarlariSayfasi(workbook, lookups);
    }

    if (sayfaSecili(filter, 'program')) {
      const satir = await yazProgramSayfasi(
        workbook,
        this.prisma,
        filter,
        lookups,
      );
      sayfaSatirSayilari.push({ sayfa: 'Program', satir });
    }

    if (sayfaSecili(filter, 'veriSozlugu')) {
      yazVeriSozlugu(workbook);
    }

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
