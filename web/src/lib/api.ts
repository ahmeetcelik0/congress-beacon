import { getAdminToken } from './admin-token';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAdminToken();

  // Dosya yukleme (katilimci Excel/CSV importu) icin `body` bir FormData
  // olabilir - bu durumda 'Content-Type' ELLE eklenmez: tarayici/fetch
  // multipart boundary'sini kendisi uretip header'i otomatik ekler. Elle
  // 'application/json' eklersek backend govdeyi hic parse edemez. JSON
  // govdeli tum diger cagrilar (buyuk cogunluk) davranis olarak AYNEN korunur.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.message ?? `İstek başarısız (${response.status})`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Salon tespit algoritmasi v3 ayarlari (kongre bazli, panelden ayarlanir).
export type AlgorithmTuning = {
  emaAlpha: number;
  hampelK: number;
  hampelWindowSize: number;
  confidenceTemperature: number;
  entryProbabilityThreshold: number;
  exitProbabilityThreshold: number;
  ambiguityMarginPct: number;
  staleGraceSeconds: number;
};

export type Congress = {
  id: string;
  name: string;
  code: string;
  accessCode: string;
  beaconUuid: string;
  startDate: string | null;
  endDate: string | null;
  observationIntervalSeconds: number;
  createdAt: string;
  updatedAt: string;
  // Kongre içerik yönetimi (mobil ana ekran kart/tanıtım alanları) — hepsi
  // opsiyonel, PATCH ile ayrı ayrı güncellenebilir (bkz. `updateCongress`).
  fullName: string | null;
  description: string | null;
  coverImageUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
} & AlgorithmTuning;

export type Hall = {
  id: string;
  congressId: string;
  name: string;
  rssiThreshold: number;
  // Salonun ayni anda kabul edebilecegi fiziksel kisi kapasitesi. null =
  // kapasite tanimlanmamis (0 ile karistirilmaz). Eski API yanitlarinda alan
  // hic gelmeyebilir (undefined) - goruntuleme mantigi `capacity == null`
  // kontroluyle ikisini de kapsayacak sekilde yazilmali.
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Beacon = {
  id: string;
  congressId: string;
  uuid: string;
  major: number;
  minor: number;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HallBeacon = {
  id: string;
  hallId: string;
  beaconId: string;
  isActive: boolean;
  installedAt: string;
  removedAt: string | null;
  rssiThreshold: number | null;
  calibrationNote: string | null;
  placementNote: string | null;
  beacon: Beacon;
};

export type HallOccupancy = {
  hallId: string;
  hallName: string;
  count: number;
};

// ===== Bilimsel program modeli (Faz 4a) =====
// Backend sozlesmesi `backend/src/session/**` ve `backend/src/program/**`
// altinda dogrulandi (curl ile uctan uca test edildi, `feature/bilimsel-
// program-modeli` dali) - burada birebir eslenir.

export type Presentation = {
  id: string;
  sessionId: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  abstract: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  roles: ProgramRole[];
};

export type ProgramRoleType = 'MODERATOR' | 'SPEAKER' | 'DISCUSSANT';
export type RoleMatchStatus = 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED' | 'MANUAL' | 'IGNORED';

export type ProgramRoleUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
};

export type ProgramRole = {
  id: string;
  sessionId: string | null;
  presentationId: string | null;
  type: ProgramRoleType;
  // Yetkiliye HER ZAMAN gosterilecek ham isim (unvan temizlenmemis) -
  // eslestirme icin kullanilan `searchName` DEGIL.
  rawName: string;
  searchName: string;
  userId: string | null;
  matchStatus: RoleMatchStatus;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  user: ProgramRoleUser | null;
};

export type ProgramRoleMatch = ProgramRole & {
  session: { id: string; title: string; congressId: string } | null;
  presentation: { id: string; title: string; session: { id: string; title: string; congressId: string } } | null;
};

export type ProgramRoleMatchesPage = {
  items: ProgramRoleMatch[];
  total: number;
  page: number;
  pageSize: number;
};

export type RematchSummary = {
  matched: number;
  ambiguous: number;
  unmatched: number;
  skipped: number;
};

export type ProgramRoleCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
};

export type Session = {
  id: string;
  congressId: string;
  hallId: string;
  title: string;
  // DEPRECATED: yeni programlarda moderator/konusmaci ProgramRole uzerinden
  // eklenir (bkz. asagisi) - yeni formda kullanilmaz, yalnizca eski veri icin
  // korunur.
  speaker: string | null;
  startTime: string;
  endTime: string;
  description: string | null;
  // --- iki seviyeli bilimsel program alanlari ---
  sessionType: string | null;
  dayLabel: string | null;
  keywords: string | null;
  displayOrder: number;
  presentations: Presentation[];
  roles: ProgramRole[];
  createdAt: string;
  updatedAt: string;
  hall?: Hall;
};

export type HallDurationStats = {
  hallId: string;
  hallName: string;
  visitCount: number;
  averageMinutes: number | null;
  medianMinutes: number | null;
  // Yalnizca v3 kararlarindan; o salonun beacon yerlesiminin ne kadar "net"
  // calistiginin gostergesi.
  averageConfidenceScore: number | null;
};

export type AttendanceSummary = {
  activeHalls: number;
  currentlyInsideTotal: number;
  hallOccupancy: HallOccupancy[];
  participantsSeenToday: number;
  lastObservationAt: string | null;
  durationStats: HallDurationStats[];
};

export type DataQualityReport = {
  totalObservations: number;
  matchedObservations: number;
  unmatchedObservations: number;
  matchedRatio: number | null;
};

export type BeaconHealthItem = {
  beaconId: string;
  label: string | null;
  major: number;
  minor: number;
  assignedHallName: string | null;
  isAssigned: boolean;
  observationCount: number;
  lastSeenAt: string | null;
  averageRssi: number | null;
  usersSeenCount: number;
};

export type HallVisitSummary = {
  id: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  hallId: string;
  hallName: string;
  startedAt: string;
  endedAt: string | null;
  isOpen: boolean;
  confidenceLevel: string | null;
  // 0-100 arasi gercek yuzde; yalnizca v3 kararlarinda dolu, v2'de null.
  confidenceScore: number | null;
  algorithmVersion: string;
};

export type HallVisitPage = {
  items: HallVisitSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type OccupancySeriesPoint = {
  bucketStart: string;
  values: Record<string, number>;
};

export type OccupancySeries = {
  from: string;
  to: string;
  bucketMinutes: number;
  halls: { hallId: string; hallName: string }[];
  points: OccupancySeriesPoint[];
};

export type TrackingHealthStatus = 'aktif' | 'yakin_zamanda' | 'veri_yok';

// Katilimcinin salon tespit algoritmasina gore anlik durumu.
// NO_SIGNAL iki durumu birlestirir: sinyal var ama hicbir salon esigini
// gecmiyor, ya da cihaz tamamen sessiz. Ayrim `status` alanindan yapilir
// (status === 'veri_yok' ise cihaz sessizdir).
export type PresenceStatus = 'IN_HALL' | 'AMBIGUOUS' | 'NO_SIGNAL';

export type TrackingHealthItem = {
  userId: string;
  firstName: string;
  lastName: string;
  devicePlatform: 'IOS' | 'ANDROID' | null;
  deviceAppVersion: string | null;
  lastObservationAt: string | null;
  status: TrackingHealthStatus;
  currentStatus: PresenceStatus;
  currentHallName: string | null;
  outlierRejectionRate: number | null;
};

export type TrackingHealth = {
  items: TrackingHealthItem[];
  summary: {
    aktif: number;
    yakinZamanda: number;
    veriYok: number;
    icerde: number;
    belirsiz: number;
    sinyalYok: number;
  };
};

export type DecisionTrace = {
  candidates: {
    hallId: string;
    percentage: number;
    emaAverage: number;
    passesThreshold: boolean;
    beaconReadings: {
      beaconId: string;
      emaValue: number;
      rawAccepted: boolean;
      // true ise: bu beacon bu turda taze veri vermedi, gosterilen deger
      // grace suresi icindeki SON BILINEN (donmus) EMA'dir - salon
      // ortalamasina hala dahil edildi, ELENMEDI. rawAccepted:false ile
      // stale:false/undefined olan okumalar ise gercekten elendi.
      stale?: boolean;
    }[];
  }[];
  runnerUpGapPct: number;
  rejectedOutliers: number;
  algorithmVersion: string;
};

type TracedEvent = {
  occurredAt: string;
  confidenceScore: number | null;
  decisionTrace: DecisionTrace | null;
};

export type HallVisitTrace = {
  visitId: string;
  userId: string;
  hallId: string;
  hallName: string;
  startedAt: string;
  endedAt: string | null;
  isOpen: boolean;
  confidenceLevel: string | null;
  algorithmVersion: string;
  entry: TracedEvent | null;
  exit: TracedEvent | null;
};

export type UserAttendanceSummary = {
  userId: string;
  firstName: string;
  lastName: string;
  totalMinutes: number;
  visitCount: number;
  distinctHallCount: number;
  entryCount: number;
  exitCount: number;
  averageConfidenceScore: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  currentlyInside: boolean;
};

export type ObservationSummary = {
  id: string;
  observationId: string;
  userId: string;
  observedAt: string;
  serverReceivedAt: string;
  beaconId: string | null;
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  txPower: number | null;
  appVersion: string | null;
};

export type ObservationPage = {
  items: ObservationSummary[];
  total: number;
  page: number;
  pageSize: number;
};

// ===== Katılımcı yönetimi (Faz 2) =====
// Backend sozlesmesi `backend/src/registrations/**` altinda tam olarak
// dogrulanmis (curl ile uctan uca test edilmis) - burada birebir eslenir.

export type RegistrationSource = 'API' | 'IMPORT' | 'MANUAL' | 'PILOT';

export type CongressRegistrationListItem = {
  registrationId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  // E.164 normalize edilmis telefon. Normalize edilemeyen numaralarda null
  // olur ama `phoneRaw` her zaman doludur - panelde biri dolu her zaman
  // gosterilmeli (bkz. registrations-table.tsx).
  phone: string | null;
  phoneRaw: string | null;
  source: RegistrationSource;
  isActive: boolean;
  registeredAt: string;
  hasPassword: boolean;
  lastLoginAt: string | null;
};

export type CongressRegistrationPage = {
  items: CongressRegistrationListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// POST/deactivate/reactivate ham CongressRegistration kaydini doner (liste
// satiri SEKLINDE DEGIL) - panel bu donen degeri dogrudan goruntulemez,
// basari/hata sinyali olarak kullanip listeyi yeniden ceker.
export type CongressRegistrationRecord = {
  id: string;
  userId: string;
  congressId: string;
  source: RegistrationSource;
  externalId: string | null;
  isActive: boolean;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
};

// PATCH /admin/registrations/:id ham User kaydini doner.
export type UpdatedRegistrationUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
  phoneLast4: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationImportCounts = {
  new: number;
  matched: number;
  duplicate: number;
  invalid: number;
  warnings: number;
};

export type RegistrationImportUploadResult = {
  importId: string;
  totalRows: number;
  counts: RegistrationImportCounts;
  recognizedColumns: string[];
  unrecognizedColumns: string[];
};

export type RegistrationImportStatus = 'DRAFT' | 'APPROVED' | 'CANCELLED';

export type RegistrationImportListItem = {
  id: string;
  congressId: string;
  adminUserId: string;
  fileName: string;
  status: RegistrationImportStatus;
  totalRows: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  adminUser: { name: string; email: string };
};

// GET /admin/registrations/imports/:id icindeki `import` alani - liste
// uc noktasindan farkli olarak `adminUser` ILISKISI GELMEZ.
export type RegistrationImportRef = {
  id: string;
  congressId: string;
  adminUserId: string;
  fileName: string;
  status: RegistrationImportStatus;
  totalRows: number;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistrationImportRowStatus = 'NEW' | 'MATCHED' | 'DUPLICATE' | 'INVALID' | 'EXCLUDED';

export type RegistrationImportRow = {
  id: string;
  importId: string;
  rowNumber: number;
  rawFirstName: string | null;
  rawLastName: string | null;
  rawEmail: string | null;
  rawPhone: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  externalId: string | null;
  status: RegistrationImportRowStatus;
  // Dolu ise satir INVALID'i aciklar (kirmizi gosterim).
  message: string | null;
  // Dolu ise satir islenebilir ama dikkat gerektirir (sari gosterim).
  warning: string | null;
  matchedUserId: string | null;
};

export type RegistrationImportDetail = {
  import: RegistrationImportRef;
  rows: RegistrationImportRow[];
  total: number;
  page: number;
  pageSize: number;
  // Anahtarlar ImportRowStatus degerleridir; yalnizca o importta GORULEN
  // durumlar icin anahtar olusur (ornegin hic DUPLICATE yoksa anahtar hic
  // gelmeyebilir) - okurken `counts.NEW ?? 0` gibi guvenli erisim gerekir.
  // Bu sayim SAYFALAMADAN BAGIMSIZ, importun TUMU uzerinden hesaplanir.
  counts: Partial<Record<RegistrationImportRowStatus, number>>;
};

export type RegistrationImportApproveResult = {
  createdUsers: number;
  updatedUsers: number;
  createdRegistrations: number;
  skipped: number;
};

// ===== Kongre içerik yönetimi (Faz: kongre içerik yönetimi) =====
// Backend sozlesmesi `backend/src/content/**` altinda tamamlanip test edildi
// (`feature/kongre-icerik-yonetimi` dali) - burada birebir eslenir. Bes tur
// de AYNI CRUD+reorder desenini izler (bkz. `api` nesnesindeki fonksiyonlar);
// liste uc noktalari zaten `displayOrder`'a gore SIRALI doner (sponsors:
// once tier sonra displayOrder; announcements: once isPinned sonra
// publishedAt desc), panel tarafinda EKSTRA siralama YAPILMAZ.

export type CongressInfoSection = {
  id: string;
  congressId: string;
  title: string;
  body: string;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VenueType = 'MAIN' | 'HOTEL';

export type Venue = {
  id: string;
  congressId: string;
  type: VenueType;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  websiteUrl: string | null;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Announcement = {
  id: string;
  congressId: string;
  title: string;
  body: string;
  isPinned: boolean;
  // null = taslak, dolu = yayinda. Create/update DTO'sunda YOK - yalnizca
  // `publishAnnouncement`/`unpublishAnnouncement` uc noktalariyla degisir.
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SponsorTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'SUPPORTER';

export type Sponsor = {
  id: string;
  congressId: string;
  name: string;
  tier: SponsorTier;
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type KeynoteSpeaker = {
  id: string;
  congressId: string;
  fullName: string;
  title: string | null;
  institution: string | null;
  country: string | null;
  bio: string | null;
  photoUrl: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type UploadPurpose = 'cover' | 'venue' | 'sponsor' | 'speaker';

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  listCongresses: () => request<Congress[]>('/congresses'),
  // startDate/endDate zaten backend DTO'sunda ve OpenAPI şemasında opsiyonel
  // alan olarak var (bkz. shared/openapi.yaml, CreateCongressDto) — burada
  // yeni bir backend alanı EKLENMİYOR, panelin daha önce kullanmadığı mevcut
  // sözleşme alanı açığa çıkarılıyor (Kongre durumu hesaplaması için gerekli).
  createCongress: (data: {
    name: string;
    code: string;
    accessCode: string;
    beaconUuid: string;
    startDate?: string;
    endDate?: string;
  }) => request<Congress>('/congresses', { method: 'POST', body: JSON.stringify(data) }),
  updateCongress: (
    id: string,
    data: Partial<
      { observationIntervalSeconds: number } & AlgorithmTuning & {
        fullName: string;
        description: string;
        coverImageUrl: string;
        websiteUrl: string;
        contactEmail: string;
        contactPhone: string;
      }
    >,
  ) => request<Congress>(`/congresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCongress: (id: string) => request<void>(`/congresses/${id}`, { method: 'DELETE' }),

  listHalls: (congressId: string) =>
    request<Hall[]>(`/halls?congressId=${encodeURIComponent(congressId)}`),
  createHall: (data: {
    congressId: string;
    name: string;
    rssiThreshold?: number;
    capacity?: number;
  }) => request<Hall>('/halls', { method: 'POST', body: JSON.stringify(data) }),
  updateHall: (id: string, data: { name?: string; rssiThreshold?: number; capacity?: number }) =>
    request<Hall>(`/halls/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteHall: (id: string) => request<void>(`/halls/${id}`, { method: 'DELETE' }),

  listBeacons: (congressId: string) =>
    request<Beacon[]>(`/beacons?congressId=${encodeURIComponent(congressId)}`),
  createBeacon: (data: {
    congressId: string;
    uuid: string;
    major: number;
    minor: number;
    label?: string;
  }) => request<Beacon>('/beacons', { method: 'POST', body: JSON.stringify(data) }),
  deleteBeacon: (id: string) => request<void>(`/beacons/${id}`, { method: 'DELETE' }),

  listActiveHallBeacons: (hallId: string) =>
    request<HallBeacon[]>(`/halls/${hallId}/beacons`),
  assignBeaconToHall: (hallId: string, beaconId: string) =>
    request<HallBeacon>(`/halls/${hallId}/beacons/${beaconId}`, { method: 'POST' }),
  unassignBeaconFromHall: (hallId: string, beaconId: string) =>
    request<HallBeacon>(`/halls/${hallId}/beacons/${beaconId}`, { method: 'DELETE' }),

  getAttendanceSummary: (congressId: string) =>
    request<AttendanceSummary>(`/attendance/summary${buildQuery({ congressId })}`),

  listHallVisits: (params: {
    congressId: string;
    hallId?: string;
    userId?: string;
    isOpen?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) => request<HallVisitPage>(`/attendance/hall-visits${buildQuery(params)}`),

  getHallVisitTrace: (visitId: string) =>
    request<HallVisitTrace>(`/attendance/hall-visits/${visitId}/trace`),

  getUserAttendanceSummary: (userId: string) =>
    request<UserAttendanceSummary>(`/attendance/users/${userId}/summary`),

  getOccupancySeries: (params: {
    congressId: string;
    hallId?: string;
    bucketMinutes?: number;
    from?: string;
    to?: string;
  }) => request<OccupancySeries>(`/attendance/occupancy-series${buildQuery(params)}`),

  listObservations: (params: {
    congressId: string;
    hallId?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) => request<ObservationPage>(`/observations${buildQuery(params)}`),

  getTrackingHealth: (congressId: string) =>
    request<TrackingHealth>(`/admin/tracking-health${buildQuery({ congressId })}`),

  getDataQualityReport: (congressId: string) =>
    request<DataQualityReport>(`/reports/data-quality${buildQuery({ congressId })}`),

  getBeaconHealthReport: (congressId: string) =>
    request<BeaconHealthItem[]>(`/reports/beacon-health${buildQuery({ congressId })}`),

  // `GET /sessions` sunumlari ve rolleri IC ICE doner, sunucuda zaten
  // `dayLabel -> startTime -> displayOrder` sirali - panel EKSTRA siralama
  // yapmaz, gun/salon filtresi istemci tarafinda uygulanir (bkz. sessions
  // sayfasi gorev tanimi).
  listSessions: (congressId: string) =>
    request<Session[]>(`/sessions${buildQuery({ congressId })}`),
  createSession: (data: {
    congressId: string;
    hallId: string;
    title: string;
    speaker?: string;
    startTime: string;
    endTime: string;
    description?: string;
    sessionType?: string;
    dayLabel?: string;
    keywords?: string;
  }) => request<Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (
    id: string,
    data: Partial<{
      hallId: string;
      title: string;
      speaker: string;
      startTime: string;
      endTime: string;
      description: string;
      sessionType: string;
      dayLabel: string;
      keywords: string;
    }>,
  ) => request<Session>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  // Yalnizca GORUNEN (ornegin gun/salon filtresiyle filtrelenmis) listedeki
  // id'leri gonder - sunucu SADECE gonderilen id'lerin displayOrder'ini 0'dan
  // yeniden yazar, filtre disindaki oturumlara dokunmaz (bkz. api sozlesmesi).
  reorderSessions: (ids: string[]) =>
    request<void>('/sessions/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  // ===== Sunumlar (bir oturumun ic ice sunum listesi) =====
  // `GET /sessions` sunumlari zaten ic ice dondurdugu icin bu fonksiyon
  // yalnizca create/update/delete/reorder sonrasi kullanilir, ilk yuklemede
  // AYRICA cagrilmaz.
  listPresentations: (sessionId: string) =>
    request<Presentation[]>(`/admin/presentations${buildQuery({ sessionId })}`),
  createPresentation: (data: {
    sessionId: string;
    title: string;
    startTime?: string;
    endTime?: string;
    abstract?: string;
  }) => request<Presentation>('/admin/presentations', { method: 'POST', body: JSON.stringify(data) }),
  updatePresentation: (
    id: string,
    data: Partial<{ title: string; startTime: string; endTime: string; abstract: string }>,
  ) =>
    request<Presentation>(`/admin/presentations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePresentation: (id: string) => request<void>(`/admin/presentations/${id}`, { method: 'DELETE' }),
  reorderPresentations: (ids: string[]) =>
    request<void>('/admin/presentations/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  // ===== Program rolleri (moderator/konusmaci/tartismaci + katilimci eslestirme) =====
  createProgramRole: (data: {
    sessionId?: string;
    presentationId?: string;
    type: ProgramRoleType;
    rawName: string;
  }) => request<ProgramRole>('/admin/program-roles', { method: 'POST', body: JSON.stringify(data) }),
  updateProgramRole: (id: string, data: Partial<{ type: ProgramRoleType; rawName: string }>) =>
    request<ProgramRole>(`/admin/program-roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProgramRole: (id: string) => request<void>(`/admin/program-roles/${id}`, { method: 'DELETE' }),
  linkProgramRole: (id: string, userId: string) =>
    request<ProgramRole>(`/admin/program-roles/${id}/link`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  ignoreProgramRole: (id: string) =>
    request<ProgramRole>(`/admin/program-roles/${id}/ignore`, { method: 'POST' }),
  // MANUAL/IGNORED durumundaki roller asla degistirilmez (skipped sayisina
  // girer) - yalnizca diger durumlar (ozellikle katilimci listesi sonradan
  // guncellendigi icin artik eslesebilecek UNMATCHED kayitlar) yeniden hesaplanir.
  rematchProgramRoles: (congressId: string) =>
    request<RematchSummary>('/admin/program-roles/rematch', {
      method: 'POST',
      body: JSON.stringify({ congressId }),
    }),
  listProgramRoleMatches: (params: {
    congressId: string;
    status?: RoleMatchStatus;
    page?: number;
    pageSize?: number;
  }) => request<ProgramRoleMatchesPage>(`/admin/program-roles/matches${buildQuery(params)}`),
  // AMBIGUOUS'ta birebir isim eslesenler, UNMATCHED'te gevsek kelime-arama
  // sonucu doner - iki durumda da otomatik atama YOK, yetkili elle secer.
  getProgramRoleCandidates: (id: string) =>
    request<ProgramRoleCandidate[]>(`/admin/program-roles/${id}/candidates`),

  // ===== Katılımcı yönetimi (Faz 2) =====
  listRegistrations: (params: {
    congressId: string;
    search?: string;
    source?: RegistrationSource;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }) => request<CongressRegistrationPage>(`/admin/registrations${buildQuery(params)}`),

  createRegistration: (data: {
    congressId: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  }) =>
    request<CongressRegistrationRecord>('/admin/registrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Alanlar PATCH semantigiyle - gonderilmeyen (undefined) alan degismez,
  // gonderilen bos string ('') o alani BOSALTIR (bkz. update-registration.dto.ts
  // yorumu). Cagiran taraf bir alani "dokunulmadi" birakmak istiyorsa o
  // anahtari objeden TAMAMEN cikarmali, '' GONDERMEMELI.
  updateRegistration: (
    id: string,
    data: Partial<{ firstName: string; lastName: string; email: string; phone: string }>,
  ) =>
    request<UpdatedRegistrationUser>(`/admin/registrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deactivateRegistration: (id: string) =>
    request<CongressRegistrationRecord>(`/admin/registrations/${id}/deactivate`, { method: 'POST' }),
  reactivateRegistration: (id: string) =>
    request<CongressRegistrationRecord>(`/admin/registrations/${id}/reactivate`, { method: 'POST' }),

  // multipart/form-data - `request()` FormData govdesini oldugu gibi gecirir,
  // Content-Type header'ini ELLE eklemez (bkz. yukarisi).
  uploadRegistrationImport: (congressId: string, file: File) => {
    const formData = new FormData();
    formData.set('congressId', congressId);
    formData.set('file', file);
    return request<RegistrationImportUploadResult>('/admin/registrations/imports', {
      method: 'POST',
      body: formData,
    });
  },

  listRegistrationImports: (congressId: string) =>
    request<RegistrationImportListItem[]>(`/admin/registrations/imports${buildQuery({ congressId })}`),

  getRegistrationImport: (
    id: string,
    params: { status?: RegistrationImportRowStatus; page?: number; pageSize?: number } = {},
  ) => request<RegistrationImportDetail>(`/admin/registrations/imports/${id}${buildQuery(params)}`),

  updateRegistrationImportRow: (
    importId: string,
    rowId: string,
    data: Partial<{ firstName: string; lastName: string; email: string; phone: string }>,
  ) =>
    request<RegistrationImportRow>(`/admin/registrations/imports/${importId}/rows/${rowId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  excludeRegistrationImportRow: (importId: string, rowId: string) =>
    request<RegistrationImportRow>(
      `/admin/registrations/imports/${importId}/rows/${rowId}/exclude`,
      { method: 'POST' },
    ),

  approveRegistrationImport: (importId: string) =>
    request<RegistrationImportApproveResult>(`/admin/registrations/imports/${importId}/approve`, {
      method: 'POST',
    }),

  cancelRegistrationImport: (importId: string) =>
    request<RegistrationImportRef>(`/admin/registrations/imports/${importId}/cancel`, {
      method: 'POST',
    }),

  // ===== Kongre içerik yönetimi =====
  listInfoSections: (congressId: string) =>
    request<CongressInfoSection[]>(`/admin/info-sections${buildQuery({ congressId })}`),
  createInfoSection: (data: { congressId: string; title: string; body: string; isPublished?: boolean }) =>
    request<CongressInfoSection>('/admin/info-sections', { method: 'POST', body: JSON.stringify(data) }),
  updateInfoSection: (
    id: string,
    data: Partial<{ title: string; body: string; isPublished: boolean }>,
  ) =>
    request<CongressInfoSection>(`/admin/info-sections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteInfoSection: (id: string) => request<void>(`/admin/info-sections/${id}`, { method: 'DELETE' }),
  reorderInfoSections: (ids: string[]) =>
    request<void>('/admin/info-sections/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  listVenues: (congressId: string) => request<Venue[]>(`/admin/venues${buildQuery({ congressId })}`),
  createVenue: (data: {
    congressId: string;
    name: string;
    type?: VenueType;
    address?: string;
    city?: string;
    phone?: string;
    websiteUrl?: string;
    mapUrl?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    imageUrl?: string;
  }) => request<Venue>('/admin/venues', { method: 'POST', body: JSON.stringify(data) }),
  updateVenue: (
    id: string,
    data: Partial<{
      type: VenueType;
      name: string;
      address: string;
      city: string;
      phone: string;
      websiteUrl: string;
      mapUrl: string;
      latitude: number;
      longitude: number;
      description: string;
      imageUrl: string;
    }>,
  ) => request<Venue>(`/admin/venues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVenue: (id: string) => request<void>(`/admin/venues/${id}`, { method: 'DELETE' }),
  reorderVenues: (ids: string[]) =>
    request<void>('/admin/venues/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  listAnnouncements: (congressId: string) =>
    request<Announcement[]>(`/admin/announcements${buildQuery({ congressId })}`),
  createAnnouncement: (data: { congressId: string; title: string; body: string; isPinned?: boolean }) =>
    request<Announcement>('/admin/announcements', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id: string, data: Partial<{ title: string; body: string; isPinned: boolean }>) =>
    request<Announcement>(`/admin/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAnnouncement: (id: string) => request<void>(`/admin/announcements/${id}`, { method: 'DELETE' }),
  reorderAnnouncements: (ids: string[]) =>
    request<void>('/admin/announcements/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  publishAnnouncement: (id: string) =>
    request<Announcement>(`/admin/announcements/${id}/publish`, { method: 'POST' }),
  unpublishAnnouncement: (id: string) =>
    request<Announcement>(`/admin/announcements/${id}/unpublish`, { method: 'POST' }),

  listSponsors: (congressId: string) => request<Sponsor[]>(`/admin/sponsors${buildQuery({ congressId })}`),
  createSponsor: (data: {
    congressId: string;
    name: string;
    tier?: SponsorTier;
    logoUrl?: string;
    websiteUrl?: string;
    description?: string;
  }) => request<Sponsor>('/admin/sponsors', { method: 'POST', body: JSON.stringify(data) }),
  updateSponsor: (
    id: string,
    data: Partial<{
      name: string;
      tier: SponsorTier;
      logoUrl: string;
      websiteUrl: string;
      description: string;
    }>,
  ) => request<Sponsor>(`/admin/sponsors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSponsor: (id: string) => request<void>(`/admin/sponsors/${id}`, { method: 'DELETE' }),
  reorderSponsors: (ids: string[]) =>
    request<void>('/admin/sponsors/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  listKeynoteSpeakers: (congressId: string) =>
    request<KeynoteSpeaker[]>(`/admin/keynote-speakers${buildQuery({ congressId })}`),
  createKeynoteSpeaker: (data: {
    congressId: string;
    fullName: string;
    title?: string;
    institution?: string;
    country?: string;
    bio?: string;
    photoUrl?: string;
  }) => request<KeynoteSpeaker>('/admin/keynote-speakers', { method: 'POST', body: JSON.stringify(data) }),
  updateKeynoteSpeaker: (
    id: string,
    data: Partial<{
      fullName: string;
      title: string;
      institution: string;
      country: string;
      bio: string;
      photoUrl: string;
    }>,
  ) =>
    request<KeynoteSpeaker>(`/admin/keynote-speakers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteKeynoteSpeaker: (id: string) =>
    request<void>(`/admin/keynote-speakers/${id}`, { method: 'DELETE' }),
  reorderKeynoteSpeakers: (ids: string[]) =>
    request<void>('/admin/keynote-speakers/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Gorsel yukleme (kapak/mekan/sponsor logosu/konusmaci fotografi) - ortak
  // uc nokta, `purpose` yalnizca backend tarafinda dosyalama/etiketleme icin
  // kullanilir. `request()` FormData govdesini oldugu gibi gecirir (bkz.
  // yukarisi, `uploadRegistrationImport` ile ayni desen).
  uploadFile: (congressId: string, file: File, purpose?: UploadPurpose) => {
    const formData = new FormData();
    formData.set('congressId', congressId);
    if (purpose) formData.set('purpose', purpose);
    formData.set('file', file);
    return request<{ url: string }>('/admin/uploads', { method: 'POST', body: formData });
  },
};
