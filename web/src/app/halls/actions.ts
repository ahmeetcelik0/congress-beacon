'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type FormState = { error: string | null };

export async function createHallAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const rssiThresholdRaw = String(formData.get('rssiThreshold') ?? '').trim();

  if (!congressId || !name) {
    return { error: 'Kongre ve salon adı zorunludur.' };
  }

  try {
    await api.createHall({
      congressId,
      name,
      rssiThreshold: rssiThresholdRaw ? Number(rssiThresholdRaw) : undefined,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Salon oluşturulamadı.' };
  }

  revalidatePath('/halls');
  return { error: null };
}

export async function updateHallRssiAction(id: string, formData: FormData) {
  const rssiThreshold = Number(formData.get('rssiThreshold'));
  await api.updateHall(id, { rssiThreshold });
  revalidatePath('/halls');
}

export async function deleteHallAction(id: string) {
  await api.deleteHall(id);
  revalidatePath('/halls');
}
