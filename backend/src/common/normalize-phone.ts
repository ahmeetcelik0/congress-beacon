import {
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export const PHONE_SUSPICIOUS_WARNING =
  'Telefon numarası biçimi olağandışı, kontrol edin';
export const PHONE_UNPARSEABLE_WARNING =
  'Telefon numarası tanınamadı, girildiği gibi saklandı';

export type PhoneNormalizationResult =
  | { status: 'ok'; e164: string }
  | { status: 'suspicious'; e164: string; warning: string }
  | { status: 'unparseable'; warning: string };

// Kongreye yurt disindan da katilimci geliyor - elle "+90 ekle" mantigi
// (eski parse-email-or-phone.ts) ulke kodu olmayan HER numaraya +90
// ekleyip yurt disi numaralari bozuyordu. libphonenumber-js '+'/'00' ile
// baslayan girdilerde kendi ulke kodunu zaten tanir ve varsayilani yok
// sayar; yalnizca yerel formatli (0xxx...) girdilerde varsayilan devreye
// girer. Ucuncu bir kutuphane/elle prefix mantigi eklenmez.
//
// 'unparseable' (parse edilemedi) ile 'suspicious' (parse edildi ama
// gecersiz) ayrimi BILINCLI: dernekten gelen veri kirli olabilir, katilimci
// girisini engellememek icin gecersiz de olsa E.164 degeri kullanilir;
// yalnizca hic parse edilemeyen (harf/anlamsiz metin) girdilerde ham metin
// korunup normalize deger null birakilir.
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'TR',
): PhoneNormalizationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { status: 'unparseable', warning: PHONE_UNPARSEABLE_WARNING };
  }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed) {
    return { status: 'unparseable', warning: PHONE_UNPARSEABLE_WARNING };
  }

  if (!parsed.isValid()) {
    return {
      status: 'suspicious',
      e164: parsed.number,
      warning: PHONE_SUSPICIOUS_WARNING,
    };
  }

  return { status: 'ok', e164: parsed.number };
}

// phoneLast4 turetimi: normalize edilmis E.164 varsa onun son 4 rakami;
// yoksa ham metindeki son 4 rakam; hic rakam yoksa null.
export function derivePhoneLast4(
  normalizedE164: string | null,
  raw: string,
): string | null {
  const source = normalizedE164 ?? raw;
  const digits = source.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits.slice(-4);
}
