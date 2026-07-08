'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type FormState = { error: string | null };

export async function createSessionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const hallId = String(formData.get('hallId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const speaker = String(formData.get('speaker') ?? '').trim();
  const startTime = String(formData.get('startTime') ?? '');
  const endTime = String(formData.get('endTime') ?? '');
  const description = String(formData.get('description') ?? '').trim();

  if (!congressId || !hallId || !title || !startTime || !endTime) {
    return { error: 'Salon, başlık, başlangıç ve bitiş zamanı zorunludur.' };
  }

  try {
    await api.createSession({
      congressId,
      hallId,
      title,
      speaker: speaker || undefined,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      description: description || undefined,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Oturum oluşturulamadı.' };
  }

  revalidatePath('/sessions');
  return { error: null };
}

export async function deleteSessionAction(id: string) {
  await api.deleteSession(id);
  revalidatePath('/sessions');
}
