// LLM'in uretecegi JSON'un semasi - kimlik alani (userId/hallId/sessionId)
// KASITLI olarak yok, LLM yalnizca belgede ne yazdigini raporlar (bkz.
// gorev dagilimi talimati, Faz 4b). `output_config.format` ile API'ye
// ZORLATILIR - modelden serbest metin JSON istenip JSON.parse EDILMEZ.
//
// Her alan nullable + "required" listesinde: strict JSON schema ile
// modelin eksik bir alani ATLAMASI degil, degerini `null` YAPMASI istenir -
// boylece "bu alan hic gelmedi mi yoksa bos mu" belirsizligi olusmaz.
const NULLABLE_STRING = { type: ['string', 'null'] } as const;

const presentationSchema = {
  type: 'object',
  properties: {
    title: NULLABLE_STRING,
    startTime: NULLABLE_STRING,
    endTime: NULLABLE_STRING,
    speakers: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'startTime', 'endTime', 'speakers'],
  additionalProperties: false,
} as const;

const sessionSchema = {
  type: 'object',
  properties: {
    dayLabel: NULLABLE_STRING,
    hallName: NULLABLE_STRING,
    startTime: NULLABLE_STRING,
    endTime: NULLABLE_STRING,
    title: NULLABLE_STRING,
    sessionType: NULLABLE_STRING,
    keywords: { type: 'array', items: { type: 'string' } },
    moderators: { type: 'array', items: { type: 'string' } },
    discussants: { type: 'array', items: { type: 'string' } },
    presentations: { type: 'array', items: presentationSchema },
  },
  required: [
    'dayLabel',
    'hallName',
    'startTime',
    'endTime',
    'title',
    'sessionType',
    'keywords',
    'moderators',
    'discussants',
    'presentations',
  ],
  additionalProperties: false,
} as const;

const daySchema = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    date: NULLABLE_STRING,
  },
  required: ['label', 'date'],
  additionalProperties: false,
} as const;

export const PROGRAM_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    days: { type: 'array', items: daySchema },
    sessions: { type: 'array', items: sessionSchema },
  },
  required: ['days', 'sessions'],
  additionalProperties: false,
} as const;

export type ExtractedPresentation = {
  title: string | null;
  startTime: string | null;
  endTime: string | null;
  speakers: string[];
};

export type ExtractedSession = {
  dayLabel: string | null;
  hallName: string | null;
  startTime: string | null;
  endTime: string | null;
  title: string | null;
  sessionType: string | null;
  keywords: string[];
  moderators: string[];
  discussants: string[];
  presentations: ExtractedPresentation[];
};

export type ExtractionResult = {
  days: { label: string; date: string | null }[];
  sessions: ExtractedSession[];
};
