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
