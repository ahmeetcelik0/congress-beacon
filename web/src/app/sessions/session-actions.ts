'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import { datetimeLocalToIso } from '@/lib/congress-time';

export type FormState = { error: string | null };
export type ActionResult = { error: string | null };

export async function createSessionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const hallId = String(formData.get('hallId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const startTime = String(formData.get('startTime') ?? '');
  const endTime = String(formData.get('endTime') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const sessionType = String(formData.get('sessionType') ?? '').trim();
  const dayLabel = String(formData.get('dayLabel') ?? '').trim();
  const keywords = String(formData.get('keywords') ?? '').trim();

  if (!congressId || !hallId || !title || !startTime || !endTime) {
    return { error: 'Salon, başlık, başlangıç ve bitiş zamanı zorunludur.' };
  }

  try {
    await api.createSession({
      congressId,
      hallId,
      title,
      startTime: datetimeLocalToIso(startTime),
      endTime: datetimeLocalToIso(endTime),
      description: description || undefined,
      sessionType: sessionType || undefined,
      dayLabel: dayLabel || undefined,
      keywords: keywords || undefined,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Oturum oluşturulamadı.' };
  }

  revalidatePath('/sessions');
  return { error: null };
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  try {
    await api.deleteSession(id);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Oturum silinemedi.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}

export async function reorderSessionsAction(ids: string[]): Promise<ActionResult> {
  try {
    await api.reorderSessions(ids);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sıralama güncellenemedi.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}
