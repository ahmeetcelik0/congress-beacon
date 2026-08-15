import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Faz 4d: Kanonik program semasi TEK dosyada tutulur -
// `shared/congress-program.schema.json` (JSON Schema draft 2020-12). Bu
// dosya backend'de IKINCI KEZ ELLE YAZILMAZ - dogrudan diskten okunur (bkz.
// docs/decisions.md "Faz 4d"). `__dirname` KULLANILMAZ - `nest start
// --watch` bile `dist/src/...` altindan calisiyor (derleme HER ZAMAN
// dist/'e yazilir, dev'de de) ve bu, `__dirname`in dev/prod arasinda FARKLI
// DERINLIKTE olmasina yol acar. `process.cwd()` bunun yerine kullanilir -
// `uploads.service.ts`teki `UPLOADS_ROOT` ile AYNI desen (bkz. o dosyadaki
// yorum): nest HER ZAMAN backend kokunden calistirilir (dev'de `backend/`,
// prod'da Dockerfile'in WORKDIR'i `/app/backend`), bu kokun BIR USTUNDE
// `shared/` KARDES bir klasor olarak durur - hem gelistirmede (repo kokunde,
// `backend/`in yaninda) hem prod'da (Docker imajinda `/app/shared`, bkz.
// backend/Dockerfile'in WORKDIR/COPY yapisi) AYNI GORECELI KONUM gecerlidir.
const SCHEMA_PATH = join(
  process.cwd(),
  '..',
  'shared',
  'congress-program.schema.json',
);

export type JsonSchemaNode = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  minItems?: number;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  [key: string]: unknown;
};

// Kongre programinin kanonik JSON Schema'si - `shared/congress-program.schema.json`in
// ayniyla okunmus hali. `validate-extraction-result.ts` bunu dogrudan ajv'ye
// verir; bu modul yalnizca dosyayi bir kez okuyup bellekte tutar.
export const CANONICAL_PROGRAM_SCHEMA: JsonSchemaNode = JSON.parse(
  readFileSync(SCHEMA_PATH, 'utf-8'),
) as JsonSchemaNode;

// Faz 4b'den beri Claude API'nin `output_config.format` (strict structured
// output) kisiti TUM alanlarin `required` listesinde olmasini ve nullable
// olmayan bir alanin ATLANAMAMASINI gerektiriyor (bkz. asagisi, ve Faz 4b'nin
// orijinal yorumu: "strict JSON schema ile modelin eksik bir alani ATLAMASI
// degil, degerini `null` YAPMASI istenir"). Kanonik semadaki GERCEKTEN
// opsiyonel alanlar (ornegin `label`, `venue`, `chairs`) bu yuzden LLM'e
// giden versiyonda ikinci kez elle YAZILMAZ - bu fonksiyon kanonik semadan
// TURETIR: her opsiyonel alani nullable yapip required listesine ekler,
// additionalProperties:false her seviyede zaten vardi. Boylece "tek kaynak"
// ilkesi bozulmadan iki farkli JSON Schema aroması (biri kullanicidan gercekten
// opsiyonel alan kabul eden, digeri LLM'in strict modu icin hepsini zorunlu+
// nullable yapan) AYNI dosyadan uretilir.
export function toStrictLlmSchema(node: JsonSchemaNode): JsonSchemaNode {
  return transformOptionalFields(node, true);
}

// `validate-extraction-result.ts`in kullandigi ucuncu aroma: required listesi
// DEGISMEZ (kullanicinin elle yazdigi JSON'da gercekten opsiyonel alanlar HIC
// olmayabilir), ama LLM'in "bu bilgi yok" derken kullandigi `null` degeri de
// AYNI opsiyonel alanlarda GECERLI sayilir - boylece TEK bir dogrulayici hem
// LLM ciktisini hem kullanici yuklemesini kabul eder (bkz. validate-
// extraction-result.ts basindaki yorum).
export function toNullTolerantSchema(node: JsonSchemaNode): JsonSchemaNode {
  return transformOptionalFields(node, false);
}

function transformOptionalFields(
  node: JsonSchemaNode,
  forceAllRequired: boolean,
): JsonSchemaNode {
  const result: JsonSchemaNode = { ...node };

  if (node.properties) {
    const originalRequired = new Set(node.required ?? []);
    const properties: Record<string, JsonSchemaNode> = {};
    for (const [key, propSchema] of Object.entries(node.properties)) {
      const transformed = transformOptionalFields(propSchema, forceAllRequired);
      properties[key] = originalRequired.has(key)
        ? transformed
        : makeNullable(transformed);
    }
    result.properties = properties;
    result.required = forceAllRequired
      ? Object.keys(properties)
      : (node.required ?? []);
    result.additionalProperties = false;
  }

  if (node.items) {
    result.items = transformOptionalFields(node.items, forceAllRequired);
  }

  return result;
}

function makeNullable(node: JsonSchemaNode): JsonSchemaNode {
  // `const`/`enum` icin ayri bir "null" secenegi ekleniyor (union type
  // yerine) - JSON Schema'da `const`/`enum` ile `type` birlikte KULLANILMAZ.
  if (node.const !== undefined) {
    return { enum: [node.const, null] };
  }
  if (node.enum) {
    return { enum: [...node.enum, null] };
  }
  if (node.type) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes('null')) return node;
    return { ...node, type: [...types, 'null'] };
  }
  return node;
}

export const PROGRAM_EXTRACTION_JSON_SCHEMA: JsonSchemaNode = toStrictLlmSchema(
  CANONICAL_PROGRAM_SCHEMA,
);

// --- Kanonik veri tipleri (bkz. shared/congress-program.schema.json) ---

export type CanonicalItemType = 'presentation' | 'discussion';

export type CanonicalItem = {
  startTime: string | null;
  endTime: string | null;
  type: CanonicalItemType;
  code: string | null;
  title: string;
  speakers: string[];
};

export type CanonicalEventType =
  'session' | 'break' | 'ceremony' | 'live_case' | 'other';

export type CanonicalEvent = {
  startTime: string;
  endTime: string;
  type: CanonicalEventType;
  title: string;
  titleEn: string | null;
  series: string | null;
  keywords: string[];
  chairs: string[];
  panelists: string[];
  items: CanonicalItem[];
};

export type CanonicalHall = {
  name: string;
  nameEn: string | null;
  events: CanonicalEvent[];
};

export type CanonicalDay = {
  date: string;
  label: string | null;
  halls: CanonicalHall[];
};

export type CanonicalCongress = {
  name: string;
  startDate: string;
  endDate: string | null;
  venue: string | null;
};

export type ExtractionResult = {
  schemaVersion: '1.0';
  congress: CanonicalCongress;
  days: CanonicalDay[];
};
