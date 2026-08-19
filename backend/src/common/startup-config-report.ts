import { Logger } from '@nestjs/common';

// Bu projede "yapilandirma yoksa zarif dus" deseni (SMTP/Firebase/Anthropic/
// APP_PUBLIC_URL) bilincli bir tasarim - eksik bir env degiskeni uygulamayi
// COKERTMEZ, ilgili ozellik sessizce devre disi kalir (bkz. docs/KARARLAR.md).
// Ama bu sessizlik gelistirmede DOGRU, production'da TEHLIKELIDIR: projede
// iki kez sessiz veri kaybi yasandi ve teshisi uzun surdu (bkz. docs/
// MIMARI.md, docs/mobile-handoff.md tarihcesi). Bu fonksiyon o sessizligi
// acilista GORUNUR kilar - hicbir sir DEGERI loglanmaz, yalnizca
// "tanimli/tanimsiz" bilgisi.
type ConfigCheck = {
  ad: string;
  tanimliMi: boolean;
  etkilenenOzellik: string;
};

export function logStartupConfigReport(): void {
  const logger = new Logger('YapilandirmaDurumu');
  const isProd = process.env.NODE_ENV === 'production';

  const checks: ConfigCheck[] = [
    {
      ad: 'SMTP_HOST',
      tanimliMi: Boolean(process.env.SMTP_HOST?.trim()),
      etkilenenOzellik:
        'E-posta gonderimi (dogrulama kodu / sifre sifirlama) - LoggingMailSender devrede, e-posta GONDERILMEZ, yalnizca sunucu loguna yazilir',
    },
    {
      ad: 'FIREBASE_SERVICE_ACCOUNT_JSON',
      tanimliMi: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
      etkilenenOzellik:
        'Push bildirimleri - LoggingNotificationSender devrede, bildirim GONDERILMEZ, yalnizca sunucu loguna yazilir',
    },
    {
      ad: 'ANTHROPIC_API_KEY',
      tanimliMi: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      etkilenenOzellik:
        'PDF/Excel bilimsel program cikarimi - /admin/program-imports/estimate ve POST /admin/program-imports 503 doner',
    },
    {
      ad: 'APP_PUBLIC_URL',
      tanimliMi: Boolean(process.env.APP_PUBLIC_URL?.trim()),
      etkilenenOzellik:
        'Mobil gorsel URL leri (kapak/logo/fotograf) - container-ici bir adrese (localhost) duser, mobil cihazdan SESSIZCE KIRIK gorunur',
    },
  ];

  const eksikSayisi = checks.filter((c) => !c.tanimliMi).length;
  const satirlar = checks.map(
    (c) =>
      `  ${c.tanimliMi ? '[AKTIF]      ' : '[DEVRE DISI] '}${c.ad}${
        c.tanimliMi ? '' : ` - ${c.etkilenenOzellik}`
      }`,
  );
  const baslik =
    eksikSayisi === 0
      ? 'YAPILANDIRMA DURUMU: tum opsiyonel entegrasyonlar tanimli.'
      : `YAPILANDIRMA DURUMU (${eksikSayisi} ozellik devre disi):`;
  const mesaj = [baslik, ...satirlar].join('\n');

  if (eksikSayisi > 0 && isProd) {
    logger.warn(
      `${mesaj}\nNODE_ENV=production iken bu eksiklikler KASITLI degilse .env.prod'u tamamlayin (bkz. docs/KURULUM.md).`,
    );
  } else {
    logger.log(mesaj);
  }
}
