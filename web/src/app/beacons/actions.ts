'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type FormState = { error: string | null };

export async function createBeaconAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const uuid = String(formData.get('uuid') ?? '').trim();
  const major = Number(formData.get('major'));
  const minor = Number(formData.get('minor'));
  const label = String(formData.get('label') ?? '').trim();

  if (!congressId || !uuid || Number.isNaN(major) || Number.isNaN(minor)) {
    return { error: 'Kongre, UUID, major ve minor zorunludur.' };
  }

  try {
    await api.createBeacon({ congressId, uuid, major, minor, label: label || undefined });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Beacon oluşturulamadı.' };
  }

  revalidatePath('/beacons');
  return { error: null };
}

export async function deleteBeaconAction(id: string) {
  await api.deleteBeacon(id);
  revalidatePath('/beacons');
}

export async function assignAction(
  hallId: string,
  beaconId: string,
  _prevState: FormState,
): Promise<FormState> {
  try {
    await api.assignBeaconToHall(hallId, beaconId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Atama başarısız.' };
  }
  revalidatePath('/beacons');
  return { error: null };
}

export async function unassignAction(
  hallId: string,
  beaconId: string,
  _prevState: FormState,
): Promise<FormState> {
  try {
    await api.unassignBeaconFromHall(hallId, beaconId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Kaldırma başarısız.' };
  }
  revalidatePath('/beacons');
  return { error: null };
}
