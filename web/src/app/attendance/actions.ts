'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type IntervalFormState = { error: string | null };

export async function updateObservationIntervalAction(
  _prevState: IntervalFormState,
  formData: FormData,
): Promise<IntervalFormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const raw = String(formData.get('observationIntervalSeconds') ?? '').trim();
  const observationIntervalSeconds = Number(raw);

  if (!congressId) {
    return { error: 'Kongre seçilmedi.' };
  }

  if (!Number.isInteger(observationIntervalSeconds) || observationIntervalSeconds < 5 || observationIntervalSeconds > 300) {
    return { error: 'Gönderim aralığı 5-300 saniye arasında tam sayı olmalıdır.' };
  }

  try {
    await api.updateCongress(congressId, { observationIntervalSeconds });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Güncellenemedi.' };
  }

  revalidatePath('/attendance');
  return { error: null };
}

export type TuningFormState = { error: string | null; saved: boolean };

// Alan adı -> [min, max, tam sayı mı]. Backend DTO'suyla aynı sınırlar;
// buradaki kontrol yalnızca kullanıcıya hızlı geri bildirim içindir,
// asıl doğrulama backend'de yapılır.
const TUNING_FIELDS: Record<string, [number, number, boolean]> = {
  emaAlpha: [0.01, 1, false],
  hampelK: [0.5, 10, false],
  hampelWindowSize: [3, 20, true],
  confidenceTemperature: [0.5, 50, false],
  entryProbabilityThreshold: [0, 100, false],
  exitProbabilityThreshold: [0, 100, false],
  ambiguityMarginPct: [0, 50, false],
  staleGraceSeconds: [0, 60, false],
};

export async function updateAlgorithmTuningAction(
  _prevState: TuningFormState,
  formData: FormData,
): Promise<TuningFormState> {
  const congressId = String(formData.get('congressId') ?? '');
  if (!congressId) {
    return { error: 'Kongre seçilmedi.', saved: false };
  }

  const payload: Record<string, number> = {};

  for (const [field, [min, max, mustBeInteger]] of Object.entries(
    TUNING_FIELDS,
  )) {
    const raw = String(formData.get(field) ?? '').trim();
    if (raw === '') {
      return { error: `${field} boş bırakılamaz.`, saved: false };
    }

    const value = Number(raw);
    if (Number.isNaN(value) || value < min || value > max) {
      return { error: `${field} ${min}-${max} aralığında olmalıdır.`, saved: false };
    }
    if (mustBeInteger && !Number.isInteger(value)) {
      return { error: `${field} tam sayı olmalıdır.`, saved: false };
    }

    payload[field] = value;
  }

  // Eşit veya ters verilirse histerezis çöker: katılımcı girer girmez çıkmış
  // sayılır ve sistem her ölçümde giriş/çıkış üretir.
  if (payload.entryProbabilityThreshold <= payload.exitProbabilityThreshold) {
    return {
      error: 'Giriş eşiği, çıkış eşiğinden büyük olmalıdır.',
      saved: false,
    };
  }

  try {
    await api.updateCongress(congressId, payload);
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Güncellenemedi.',
      saved: false,
    };
  }

  revalidatePath('/attendance');
  return { error: null, saved: true };
}
