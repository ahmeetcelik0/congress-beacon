export type RegistrationField =
  'firstName' | 'lastName' | 'email' | 'phone' | 'externalId';

// Dernek kendi formatini gonderiyor, kolon adlari sabit degil. Buradaki her
// takma ad, asagidaki normalizeHeader ile ayni sekilde (kucuk harf +
// Turkce karakter sadelestirme + bosluk/tire silme) kars,ilastirilir - bu
// yuzden "e-posta"/"e mail"/"E-Mail" gibi varyasyonlar icin ayri girdiye
// gerek yok, hepsi "eposta"/"email" haline gelir.
const FIELD_ALIASES: Record<RegistrationField, string[]> = {
  firstName: ['ad', 'isim', 'adi', 'firstname', 'name'],
  lastName: ['soyad', 'soyadi', 'lastname', 'surname'],
  email: ['eposta', 'email', 'mail'],
  phone: ['telefon', 'tel', 'gsm', 'cep', 'phone', 'mobile'],
  externalId: ['kayitno', 'kayitnumarasi', 'registrationid', 'externalid'],
};

const TURKISH_FOLD: Record<string, string> = {
  ı: 'i',
  İ: 'i',
  ğ: 'g',
  Ğ: 'g',
  ü: 'u',
  Ü: 'u',
  ş: 's',
  Ş: 's',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
};

function normalizeHeader(text: string): string {
  const folded = text.replace(
    /[ığĞüÜşŞöÖçÇİ]/g,
    (ch) => TURKISH_FOLD[ch] ?? ch,
  );
  return folded.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type ColumnMapping = {
  columnIndex: Partial<Record<RegistrationField, number>>;
  recognizedColumns: string[];
  unrecognizedColumns: string[];
};

// headerRow: dosyanin ilk satirindaki HAM (gorunen) kolon basliklari.
export function mapRegistrationColumns(headerRow: string[]): ColumnMapping {
  const columnIndex: Partial<Record<RegistrationField, number>> = {};
  const recognizedColumns: string[] = [];
  const unrecognizedColumns: string[] = [];

  headerRow.forEach((rawHeader, index) => {
    const header = String(rawHeader ?? '').trim();
    if (!header) return;

    const normalized = normalizeHeader(header);
    const matchedField = (
      Object.keys(FIELD_ALIASES) as RegistrationField[]
    ).find((field) => FIELD_ALIASES[field].includes(normalized));

    if (matchedField && columnIndex[matchedField] === undefined) {
      columnIndex[matchedField] = index;
      recognizedColumns.push(header);
    } else {
      unrecognizedColumns.push(header);
    }
  });

  return { columnIndex, recognizedColumns, unrecognizedColumns };
}
