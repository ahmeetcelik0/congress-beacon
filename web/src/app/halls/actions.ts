'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type FormState = { error: string | null; success: boolean };

// Yalnizca rakamlardan olusan (bosluk, nokta, virgul, +/- iceren HERHANGI bir
// karakter dahil DEGIL) bir dizge - "" (bos string), "12.5" (ondalik) ve
// "-5" (negatif) gibi degerleri Number()'in sessizce 0/NaN'a cevirmesine
// GUVENMEDEN burada eleriz. Boylece gecersiz bir deger asla API'ye gitmez.
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

function parseRequiredCapacity(raw: string): { value?: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: 'Salon kapasitesi zorunludur.' };
  }
  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) {
    return { error: 'Salon kapasitesi pozitif bir tam sayı olmalıdır (ondalık veya negatif olamaz).' };
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) {
    return { error: 'Salon kapasitesi en az 1 kişi olmalıdır.' };
  }
  return { value };
}

export async function createHallAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const rssiThresholdRaw = String(formData.get('rssiThreshold') ?? '').trim();
  const capacityRaw = String(formData.get('capacity') ?? '');

  if (!congressId || !name) {
    return { error: 'Kongre ve salon adı zorunludur.', success: false };
  }

  // Web panelinde kapasite ZORUNLU (API seviyesinde opsiyonel kalir - bkz.
  // create-hall.dto.ts yorumu, eski istemci uyumlulugu icin).
  const { value: capacity, error: capacityError } = parseRequiredCapacity(capacityRaw);
  if (capacityError) {
    return { error: capacityError, success: false };
  }

  try {
    await api.createHall({
      congressId,
      name,
      rssiThreshold: rssiThresholdRaw ? Number(rssiThresholdRaw) : undefined,
      capacity,
    });
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Salon oluşturulamadı.',
      success: false,
    };
  }

  revalidatePath('/halls');
  return { error: null, success: true };
}

export async function updateHallRssiAction(id: string, formData: FormData) {
  const rssiThreshold = Number(formData.get('rssiThreshold'));
  await api.updateHall(id, { rssiThreshold });
  revalidatePath('/halls');
}

export type CapacityFormState = { error: string | null; saved: boolean };

export async function updateHallCapacityAction(
  _prevState: CapacityFormState,
  formData: FormData,
): Promise<CapacityFormState> {
  const hallId = String(formData.get('hallId') ?? '');
  if (!hallId) {
    return { error: 'Salon seçilmedi.', saved: false };
  }

  const capacityRaw = String(formData.get('capacity') ?? '');
  const { value: capacity, error } = parseRequiredCapacity(capacityRaw);
  if (error) {
    return { error, saved: false };
  }

  try {
    await api.updateHall(hallId, { capacity });
  } catch (apiError) {
    return {
      error: apiError instanceof ApiError ? apiError.message : 'Kapasite güncellenemedi.',
      saved: false,
    };
  }

  revalidatePath('/halls');
  return { error: null, saved: true };
}

export async function deleteHallAction(id: string) {
  await api.deleteHall(id);
  revalidatePath('/halls');
}
