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

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
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
} & AlgorithmTuning;

export type Hall = {
  id: string;
  congressId: string;
  name: string;
  rssiThreshold: number;
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

export type Session = {
  id: string;
  congressId: string;
  hallId: string;
  title: string;
  speaker: string | null;
  startTime: string;
  endTime: string;
  description: string | null;
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
  createCongress: (data: { name: string; code: string; accessCode: string; beaconUuid: string }) =>
    request<Congress>('/congresses', { method: 'POST', body: JSON.stringify(data) }),
  updateCongress: (
    id: string,
    data: Partial<{ observationIntervalSeconds: number } & AlgorithmTuning>,
  ) => request<Congress>(`/congresses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCongress: (id: string) => request<void>(`/congresses/${id}`, { method: 'DELETE' }),

  listHalls: (congressId: string) =>
    request<Hall[]>(`/halls?congressId=${encodeURIComponent(congressId)}`),
  createHall: (data: { congressId: string; name: string; rssiThreshold?: number }) =>
    request<Hall>('/halls', { method: 'POST', body: JSON.stringify(data) }),
  updateHall: (id: string, data: { name?: string; rssiThreshold?: number }) =>
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
    }>,
  ) => request<Session>(`/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSession: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
};
