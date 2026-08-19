// Bilimsel program dosyalarinda konusmaci/moderator ismi genellikle unvanli
// ve serbest bicimli yazilir ("Prof. Dr. Ahmet YILMAZ", "Prof.Dr. Ahmet
// Yilmaz" gibi), katilimci kaydinda ise sade ad-soyad vardir. Ikisini
// eslestirebilmek icin ikisi de AYNI normalize fonksiyonundan gecirilip
// karsilastirilir (bkz. `program-role-matching.service.ts`).
//
// Panelin ve Faz 4b'nin (PDF/Excel'den program cikarimi) de kullanacagi TEK
// kaynak - unvan listesi burada tutulur.
export const ACADEMIC_TITLES = [
  'Prof',
  'Doç',
  'Doc',
  'Dr',
  'Uzm',
  'Op',
  'Yrd',
  'Öğr',
  'Gör',
  'Hem',
  'Ecz',
  'Dt',
  'Vet',
  'Av',
  'Müh',
  'Sayın',
  'MD',
  'PhD',
  'Assoc',
  'Asst',
] as const;

// Turkce harflerin ASCII karsiliklari. Karsilastirma `toLowerCase()`/
// `toLocaleLowerCase('tr')` cagrisina DOGRUDAN GUVENMEZ: JS'te "İ".toLowerCase()
// platforma gore "i" yerine "i" + birlesik nokta (U+0307) uretebiliyor, ve
// "I".toLowerCase() locale'e gore "i" yerine "ı" verebiliyor. Bu yuzden bu
// harfler ONCE elle, tek tek ASCII'ye indirgenir; genel kucultme (`toLowerCase`)
// yalnizca geriye kalan (zaten ASCII olan) harfler icin sonra uygulanir.
const TURKISH_CHAR_MAP: Record<string, string> = {
  İ: 'i',
  I: 'i',
  ı: 'i',
  Ş: 's',
  ş: 's',
  Ğ: 'g',
  ğ: 'g',
  Ü: 'u',
  ü: 'u',
  Ö: 'o',
  ö: 'o',
  Ç: 'c',
  ç: 'c',
};

const TURKISH_CHAR_PATTERN = /[İIıŞşĞğÜüÖöÇç]/g;

// Faz 4b (salon adi eslestirmesi) de bu fonksiyonu yeniden kullanir - ayni
// platform/locale-bagimsiz kucultme garantisi orada da gerekli.
export function foldToAsciiLower(text: string): string {
  const mapped = text.replace(
    TURKISH_CHAR_PATTERN,
    (char) => TURKISH_CHAR_MAP[char] ?? char,
  );
  return mapped.toLowerCase();
}

const TITLE_SET = new Set(
  ACADEMIC_TITLES.map((title) => foldToAsciiLower(title)),
);

/**
 * Bir ismi arama/eslestirme icin normalize eder: unvanlari atar, Turkce
 * karakterleri ASCII'ye indirger, noktalama/fazla bosluklari temizler.
 * Sonuc her zaman kucuk harf, tek bosluklu, unvansiz bir dizedir.
 */
export function normalizeTurkishName(raw: string): string {
  if (!raw) return '';

  // Bitisik yazilmis unvanlari ("Prof.Dr.") ayirmak icin, bosluksuz bir
  // nokta gorulunce arkasina bosluk eklenir - boylece asagidaki token bazli
  // unvan filtrelemesi "Prof.Dr" gibi TEK kelime olarak gelen bitisik
  // unvanlari da yakalar.
  const spaced = raw.replace(/\.(?=\S)/g, '. ');

  const tokens = spaced
    .split(/\s+/)
    .map((token) => foldToAsciiLower(token).replace(/[^a-z0-9]/g, ''))
    .filter((token) => token.length > 0)
    .filter((token) => !TITLE_SET.has(token));

  return tokens.join(' ');
}

/** `User.searchName` alani icin ad+soyad birlesiminin normalize edilmis hali. */
export function computeSearchName(firstName: string, lastName: string): string {
  return normalizeTurkishName(`${firstName} ${lastName}`);
}
