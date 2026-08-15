import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import {
  CANONICAL_PROGRAM_SCHEMA,
  toNullTolerantSchema,
  type ExtractionResult,
  type JsonSchemaNode,
} from './extraction-schema';
import { timeToMinutes } from './derive-datetime';

// Faz 4d: `shared/congress-program.schema.json` (kanonik sema) hem elle
// hazirlanmis JSON yuklemesini hem LLM ciktisini doğrular - IKI kaynagin da
// AYNI kurallara uymasi garanti edilir (bkz. docs/decisions.md "Faz 4d").
// AJV, kanonik semanin "null-toleranslı" bir versiyonuyla calisir: kanonik
// semada GERCEKTEN opsiyonel olan alanlar (`label`, `venue`, `chairs` vb.)
// ya HIC OLMAYABILIR (kullanicinin elle yazdigi JSON) ya da `null`
// OLABILIR (LLM'in strict yapisi geregi "bu bilgi yok" derken kullandigi
// bicim, bkz. extraction-schema.ts `toStrictLlmSchema`) - required listesi
// DEGISTIRILMEDEN yalnizca tipe 'null' eklenir (bkz. `toNullTolerantSchema`).
//
// AJV'nin ham hatalari ("/days/0/halls/2/events/5/startTime must match
// pattern") kullaniciya GOSTERILMEZ - `describeAjvError` bunlari instancePath
// uzerinden orijinal veriye geri donup (hangi gunun/salonun ADI) Turkce,
// konumlu bir cumleye cevirir.
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(
  toNullTolerantSchema(CANONICAL_PROGRAM_SCHEMA),
);

export type ValidationResult =
  | { valid: true; result: ExtractionResult }
  | { valid: false; errors: string[] };

type ErrorContext = {
  dayIndex?: number;
  hallIndex?: number;
  hallName?: string;
  eventIndex?: number;
  itemIndex?: number;
  inCongress?: boolean;
  field?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getProp(value: unknown, key: string): unknown {
  return isPlainObject(value) ? value[key] : undefined;
}

function getArrayItem(value: unknown, key: string, index: number): unknown {
  const arr = getProp(value, key);
  return Array.isArray(arr) ? (arr as unknown[])[index] : undefined;
}

function resolveContext(data: unknown, instancePath: string): ErrorContext {
  const segments = instancePath.split('/').filter(Boolean);
  const ctx: ErrorContext = {};

  let cursor: unknown = data;
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (seg === 'congress') {
      ctx.inCongress = true;
      cursor = getProp(cursor, 'congress');
      i += 1;
    } else if (seg === 'days' && /^\d+$/.test(next ?? '')) {
      ctx.dayIndex = Number(next);
      cursor = getArrayItem(cursor, 'days', ctx.dayIndex);
      i += 2;
    } else if (seg === 'halls' && /^\d+$/.test(next ?? '')) {
      ctx.hallIndex = Number(next);
      cursor = getArrayItem(cursor, 'halls', ctx.hallIndex);
      const name = getProp(cursor, 'name');
      ctx.hallName = typeof name === 'string' ? name : undefined;
      i += 2;
    } else if (seg === 'events' && /^\d+$/.test(next ?? '')) {
      ctx.eventIndex = Number(next);
      cursor = getArrayItem(cursor, 'events', ctx.eventIndex);
      i += 2;
    } else if (seg === 'items' && /^\d+$/.test(next ?? '')) {
      ctx.itemIndex = Number(next);
      cursor = getArrayItem(cursor, 'items', ctx.itemIndex);
      i += 2;
    } else {
      ctx.field = seg;
      i += 1;
    }
  }
  return ctx;
}

function formatLocation(ctx: ErrorContext): string {
  const parts: string[] = [];
  if (ctx.dayIndex !== undefined) parts.push(`${ctx.dayIndex + 1}. gün`);
  if (ctx.hallIndex !== undefined) {
    parts.push(
      ctx.hallName
        ? `${ctx.hallIndex + 1}. salon (${ctx.hallName})`
        : `${ctx.hallIndex + 1}. salon`,
    );
  }
  if (ctx.eventIndex !== undefined)
    parts.push(`${ctx.eventIndex + 1}. etkinlik`);
  if (ctx.itemIndex !== undefined) parts.push(`${ctx.itemIndex + 1}. öğe`);
  if (ctx.inCongress) parts.push('congress bilgisi');
  return parts.length === 0 ? 'Kök nesne' : parts.join(', ');
}

const TIME_FIELDS = new Set(['startTime', 'endTime']);
const DATE_FIELDS = new Set(['date', 'startDate', 'endDate']);

function describeAjvError(err: ErrorObject, data: unknown): string {
  const ctx = resolveContext(data, err.instancePath);
  const location = formatLocation(ctx);

  if (err.keyword === 'required') {
    const field = (err.params as { missingProperty: string }).missingProperty;
    return `${location}: '${field}' alanı eksik`;
  }
  if (err.keyword === 'additionalProperties') {
    const extra = (err.params as { additionalProperty: string })
      .additionalProperty;
    return `${location}: tanımsız bir alan var: '${extra}'`;
  }

  const field = ctx.field ?? '';

  switch (err.keyword) {
    case 'pattern':
      if (TIME_FIELDS.has(field)) {
        return `${location}: '${field}' alanı geçersiz saat biçiminde ('HH:MM' bekleniyor, ör. '14:30')`;
      }
      if (DATE_FIELDS.has(field)) {
        return `${location}: '${field}' alanı geçersiz tarih biçiminde ('YYYY-MM-DD' bekleniyor, ör. '2026-04-09')`;
      }
      return `${location}: '${field}' alanı geçersiz biçimde`;
    case 'enum': {
      const allowed = (err.params as { allowedValues: unknown[] }).allowedValues
        .filter((value): value is string => typeof value === 'string')
        .join(' | ');
      return `${location}: '${field}' alanı geçersiz değerde (izin verilenler: ${allowed})`;
    }
    case 'const':
      return `${location}: '${field}' alanı "1.0" olmalı`;
    case 'minItems':
      return `${location}: '${field}' dizisi boş olamaz`;
    case 'minLength':
      return `${location}: '${field}' alanı boş olamaz`;
    case 'type':
      return `${location}: '${field}' alanı geçersiz tipte`;
    default:
      return `${location}: '${field}' alanı geçersiz${err.message ? ` (${err.message})` : ''}`;
  }
}

// AJV basarili gectikten SONRA calisir - opsiyonel alanlar icin (kullanicinin
// hic yazmadigi YA DA LLM'in null verdigi) TypeScript tipinin soz verdigi
// varsayilanlari (dizi icin `[]`, nullable metin icin `null`) atar. Boylece
// `write-extraction-to-staging.ts` "key var mi" diye HIC kontrol etmez,
// dogrudan `event.keywords`/`event.chairs` gibi alanlara guvenle erisir.
function applyDefaults(schema: JsonSchemaNode, data: unknown): unknown {
  if (schema.properties && isPlainObject(data)) {
    const required = new Set(schema.required ?? []);
    const result: Record<string, unknown> = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const raw = data[key];
      const missing = raw === undefined || raw === null;
      if (missing && !required.has(key)) {
        result[key] = propSchema.type === 'array' ? [] : null;
      } else {
        result[key] = applyDefaults(propSchema, raw);
      }
    }
    return result;
  }
  if (schema.items && Array.isArray(data)) {
    return data.map((item) =>
      applyDefaults(schema.items as JsonSchemaNode, item),
    );
  }
  return data;
}

// AJV'nin YAKALAYAMAYACAGI tek yapisal kontrol: bir zaman araliginin
// mantikli olmasi (bitis, baslangictan ONCE ya da AYNI olamaz). Kongre
// tarih araligi disi gun, cakisan etkinlik, oge saatinin etkinlik disina
// tasmasi gibi kontroller BILEREK burada DEGIL, `write-extraction-to-
// staging.ts`de (session bazli `warning` alanina yazilarak) yapilir -
// onlar YAPISAL degil ANLAMSAL/CAPRAZ-REFERANS kontroller (kongre kaydi,
// ayni salondaki DIGER etkinlikler gibi bu fonksiyonun gormedigi veriye
// ihtiyac duyarlar) ve upload'i REDDETMEZ, yalnizca ilgili satiri UYARIR
// (bkz. Faz 4d talimati §2 ve docs/decisions.md).
function validateTimeOrder(result: ExtractionResult, errors: string[]): void {
  result.days.forEach((day, dayIndex) => {
    day.halls.forEach((hall, hallIndex) => {
      hall.events.forEach((event, eventIndex) => {
        const location = formatLocation({
          dayIndex,
          hallIndex,
          hallName: hall.name,
          eventIndex,
        });
        if (timeToMinutes(event.endTime) <= timeToMinutes(event.startTime)) {
          errors.push(
            `${location}: 'endTime' alanı 'startTime' alanından önce veya aynı olamaz`,
          );
        }

        event.items.forEach((item, itemIndex) => {
          if (!item.startTime || !item.endTime) return;
          const itemLocation = formatLocation({
            dayIndex,
            hallIndex,
            hallName: hall.name,
            eventIndex,
            itemIndex,
          });
          if (timeToMinutes(item.endTime) <= timeToMinutes(item.startTime)) {
            errors.push(
              `${itemLocation}: 'endTime' alanı 'startTime' alanından önce veya aynı olamaz`,
            );
          }
        });
      });
    });
  });
}

export function validateExtractionResult(data: unknown): ValidationResult {
  const structurallyValid = validateSchema(data);
  if (!structurallyValid) {
    const errors = [
      ...new Set(
        (validateSchema.errors ?? []).map((err) => describeAjvError(err, data)),
      ),
    ];
    return { valid: false, errors };
  }

  const normalized = applyDefaults(
    CANONICAL_PROGRAM_SCHEMA,
    data,
  ) as ExtractionResult;

  const errors: string[] = [];
  validateTimeOrder(normalized, errors);
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, result: normalized };
}
