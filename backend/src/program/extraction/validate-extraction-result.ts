import {
  daySchema,
  presentationSchema,
  sessionSchema,
  type ExtractionResult,
} from './extraction-schema';
import { isValidDateFormat, isValidTimeFormat } from './derive-datetime';

// Faz 4c: elle hazirlanan bir JSON'da Claude API'nin `output_config.format`
// ile garanti ettigi seyler (gerekli alanlarin VAR OLMASI, tipler) hicbir
// sekilde garanti degildir - bu dogrulayici o guvenceyi burada, sunucu
// tarafinda saglar. AYNI dogrulayici LLM ciktisindan da geçirilir (bkz.
// program-import-queue.service.ts) - tek savunma hatti olmasin, ve iki
// yolun da AYNI kurallara uydugu garanti edilsin (bkz. Faz 4c talimati §1).
//
// Hata mesajlari KASITLI olarak Turkce ve KONUMLU: "3. oturumda 'startTime'
// alani eksik" gibi - kullanici hangi satiri duzeltecegini tek bir "JSON
// gecersiz" mesajindan CIKARAMAZ.
//
// Onemli ayrim: bir alanin DEGERI `null` olmasi (LLM'in "bu bilgi belgede
// yoktu" demesiyle AYNI anlam) GECERLI bir durumdur - `write-extraction-to-
// staging.ts` bunu zaten zarifce ele alir (ör. basliksiz bir oturum
// INVALID durumuna duser, upload REDDEDILMEZ). Burada REDDEDILEN yalnizca
// YAPISAL bozukluktur: alanin KENDISI (key) hic YOK, ya da YANLIS TIPTE
// (ör. sayi/nesne/dizi olmasi gerekirken metin).
export type ValidationResult =
  | { valid: true; result: ExtractionResult }
  | { valid: false; errors: string[] };

const STRING_ARRAY_FIELDS = new Set(['keywords', 'moderators', 'discussants']);
const TIME_FIELDS = new Set(['startTime', 'endTime']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ordinal(index: number): string {
  return `${index + 1}.`;
}

/// Nullable string alanlari (schema'da `{type: ['string','null']}`) icin:
/// KEY yoksa "eksik", deger string/null DISINDA bir tipteyse "gecersiz".
/// Deger dolu bir string VE zaman alaniysa (startTime/endTime) ayrica
/// HH:MM bicimi kontrol edilir.
function checkNullableStringField(
  obj: Record<string, unknown>,
  field: string,
  location: string,
  errors: string[],
): void {
  if (!(field in obj)) {
    errors.push(`${location}'${field}' alanı eksik`);
    return;
  }
  const value = obj[field];
  if (value === null) return;
  if (typeof value !== 'string') {
    errors.push(
      `${location}'${field}' alanı geçersiz (metin veya null olmalı)`,
    );
    return;
  }
  if (TIME_FIELDS.has(field) && value.trim() && !isValidTimeFormat(value)) {
    errors.push(
      `${location}'${field}' alanı geçersiz saat biçiminde ('HH:MM' bekleniyor, ör. '14:30')`,
    );
  }
}

function checkStringArrayField(
  obj: Record<string, unknown>,
  field: string,
  location: string,
  errors: string[],
): void {
  if (!(field in obj)) {
    errors.push(`${location}'${field}' alanı eksik`);
    return;
  }
  const value = obj[field];
  if (!Array.isArray(value)) {
    errors.push(`${location}'${field}' alanı bir dizi olmalı`);
    return;
  }
  if (value.some((item) => typeof item !== 'string')) {
    errors.push(`${location}'${field}' dizisindeki her öge metin olmalı`);
  }
}

function validateDay(day: unknown, index: number, errors: string[]): void {
  const location = `${ordinal(index)} günde `;
  if (!isPlainObject(day)) {
    errors.push(`${location}bir JSON nesnesi olmalı`);
    return;
  }

  for (const field of daySchema.required) {
    if (!(field in day)) {
      errors.push(`${location}'${field}' alanı eksik`);
    }
  }

  if ('label' in day) {
    const label = day.label;
    if (typeof label !== 'string' || !label.trim()) {
      errors.push(`${location}'label' alanı boş olamaz`);
    }
  }

  if ('date' in day && day.date !== null) {
    if (typeof day.date !== 'string') {
      errors.push(`${location}'date' alanı geçersiz (metin veya null olmalı)`);
    } else if (day.date.trim() && !isValidDateFormat(day.date)) {
      errors.push(
        `${location}'date' alanı geçersiz tarih biçiminde ('YYYY-MM-DD' bekleniyor, ör. '2026-04-09')`,
      );
    }
  }
}

function validatePresentation(
  presentation: unknown,
  sessionIndex: number,
  presentationIndex: number,
  errors: string[],
): void {
  const location = `${ordinal(sessionIndex)} oturumun ${ordinal(presentationIndex)} sunumunda `;
  if (!isPlainObject(presentation)) {
    errors.push(`${location}bir JSON nesnesi olmalı`);
    return;
  }

  for (const field of presentationSchema.required) {
    if (field === 'speakers') {
      checkStringArrayField(presentation, 'speakers', location, errors);
    } else {
      checkNullableStringField(presentation, field, location, errors);
    }
  }
}

function validateSession(
  session: unknown,
  index: number,
  errors: string[],
): void {
  const location = `${ordinal(index)} oturumda `;
  if (!isPlainObject(session)) {
    errors.push(`${location}bir JSON nesnesi olmalı`);
    return;
  }

  for (const field of sessionSchema.required) {
    if (field === 'presentations') continue; // asagida ayrica ele alinir
    if (STRING_ARRAY_FIELDS.has(field)) {
      checkStringArrayField(session, field, location, errors);
    } else {
      checkNullableStringField(session, field, location, errors);
    }
  }

  if (!('presentations' in session)) {
    errors.push(`${location}'presentations' alanı eksik`);
    return;
  }
  const presentations = session.presentations;
  if (!Array.isArray(presentations)) {
    errors.push(`${location}'presentations' alanı bir dizi olmalı`);
    return;
  }
  presentations.forEach((presentation, presentationIndex) => {
    validatePresentation(presentation, index, presentationIndex, errors);
  });
}

export function validateExtractionResult(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(data)) {
    return {
      valid: false,
      errors: [
        'Kök öge bir JSON nesnesi olmalı: { "days": [...], "sessions": [...] }',
      ],
    };
  }

  if (!('days' in data)) {
    errors.push("'days' alanı eksik");
  } else if (!Array.isArray(data.days)) {
    errors.push("'days' alanı bir dizi olmalı");
  } else if (data.days.length === 0) {
    errors.push("'days' dizisi boş olamaz");
  } else {
    data.days.forEach((day, index) => validateDay(day, index, errors));
  }

  if (!('sessions' in data)) {
    errors.push("'sessions' alanı eksik");
  } else if (!Array.isArray(data.sessions)) {
    errors.push("'sessions' alanı bir dizi olmalı");
  } else if (data.sessions.length === 0) {
    errors.push("'sessions' dizisi boş olamaz");
  } else {
    data.sessions.forEach((session, index) =>
      validateSession(session, index, errors),
    );
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true, result: data as unknown as ExtractionResult };
}
