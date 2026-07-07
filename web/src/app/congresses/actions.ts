'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type FormState = { error: string | null };

export async function createCongressAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const beaconUuid = String(formData.get('beaconUuid') ?? '').trim();

  if (!name || !beaconUuid) {
    return { error: 'İsim ve beacon UUID zorunludur.' };
  }

  try {
    await api.createCongress({ name, beaconUuid });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Kongre oluşturulamadı.' };
  }

  revalidatePath('/congresses');
  return { error: null };
}

export async function deleteCongressAction(id: string) {
  await api.deleteCongress(id);
  revalidatePath('/congresses');
}
