// Faz 9: bildirim zamanlama/icerik KARARLARI - Prisma/BullMQ/FCM I/O'sundan
// AYRI, saf fonksiyonlar (ayni felsefe: `attendance/presence-transition.ts`).
// Karar mantigi burada, birim testleri burada; servis katmani yalnizca bu
// fonksiyonlari cagirip sonucu uygular.

export const REMINDER_BEFORE_MS = 10 * 60 * 1000;

// Bir "tetikleyici" (reminder/start) is'i ates aldiginda, GERCEKTEN
// gondermeden once bu kadar bekleyip AYNI (kongre, dakika) icin baska
// oturumlarin da tetiklenmesine izin verilir - boylece ayni anda baslayan
// birden fazla oturum TEK bir birlestirilmis bildirimde toplanir. Tek bir
// oturum icin de AYNI yoldan gecer (N=1 ozel durum degildir).
export const AGGREGATION_FLUSH_DELAY_MS = 5 * 1000;

// Kullanici basina saatlik gonderim ust siniri - ayni anda cok sayida
// salonda oturum baslamasi durumunda bile kullaniciyi bildirim
// yagmuruna bogmamak icin (bkz. Faz 9 talimati §4).
export const HOURLY_NOTIFICATION_CAP = 6;

/// Gecmis oturumlar icin job KURULMAZ - Faz 4b'nin toplu program ice
/// aktarma akisi yuzlerce GECMIS oturumu tek seferde olusturabilir/
/// guncelleyebilir; sinirsiz delay=0 job'lari hepsi ANINDA bildirim
/// gonderirdi (bkz. Faz 9 talimati §3).
export function shouldScheduleJob(fireAtMs: number, nowMs: number): boolean {
  return fireAtMs > nowMs;
}

/// Bir zaman damgasini (ms) "dakika kovasi"na indirger - ayni dakikada
/// baslayan/hatirlatilan oturumlarin AYNI kovaya dusmesini saglar.
export function minuteBucket(timestampMs: number): number {
  return Math.floor(timestampMs / 60000);
}

export function minuteBucketToRange(bucket: number): {
  startMs: number;
  endMs: number;
} {
  return { startMs: bucket * 60000, endMs: (bucket + 1) * 60000 };
}

export type SessionNotificationInfo = {
  sessionId: string;
  sessionTitle: string;
  hallName: string;
  keywords: string | null;
};

export type NotificationContent = {
  title: string;
  body: string;
};

/// Oturum BASLADIGINDA gonderilecek bildirim icerigi. Tek oturum icin de
/// (`sessions.length === 1`), birden fazla oturum icin de AYNI fonksiyon
/// kullanilir. Baslik = oturum adi (tek oturumda) veya "N oturum basladi"
/// (birlesikte); govde = salon (+ varsa anahtar kelimeler).
export function buildStartNotification(
  sessions: SessionNotificationInfo[],
): NotificationContent {
  if (sessions.length === 1) {
    const [s] = sessions;
    return { title: s.sessionTitle, body: hallLine(s) };
  }
  return {
    title: `${sessions.length} oturum başladı`,
    body: sessions.map((s) => s.hallName).join(', '),
  };
}

/// Oturum baslamadan 10 DAKIKA ONCE gonderilecek hatirlatma icerigi - ayni
/// birlestirme kurali gecerli.
export function buildReminderNotification(
  sessions: SessionNotificationInfo[],
): NotificationContent {
  if (sessions.length === 1) {
    const [s] = sessions;
    return {
      title: 'Oturum yakında başlıyor',
      body: `${s.sessionTitle} 10 dakika içinde başlıyor.`,
    };
  }
  return {
    title: `${sessions.length} oturum yakında başlıyor`,
    body: sessions.map((s) => s.hallName).join(', '),
  };
}

function hallLine(s: SessionNotificationInfo): string {
  const keywordSuffix = s.keywords?.trim() ? ` — ${s.keywords.trim()}` : '';
  return `${s.hallName}'da başladı${keywordSuffix}`;
}

export function exceedsHourlyCap(sentInLastHour: number): boolean {
  return sentInLastHour >= HOURLY_NOTIFICATION_CAP;
}
