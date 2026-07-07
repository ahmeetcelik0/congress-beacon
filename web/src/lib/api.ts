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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
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

export type Congress = {
  id: string;
  name: string;
  beaconUuid: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

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

export const api = {
  listCongresses: () => request<Congress[]>('/congresses'),
  createCongress: (data: { name: string; beaconUuid: string }) =>
    request<Congress>('/congresses', { method: 'POST', body: JSON.stringify(data) }),
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
};
