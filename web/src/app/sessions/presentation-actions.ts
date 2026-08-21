'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import { datetimeLocalToIsoOrUndefined } from '@/lib/congress-time';

export type FormState = { error: string | null };
export type ActionResult = { error: string | null };

export async function createPresentationAction(
  sessionId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get('title') ?? '').trim();
  const startTime = String(formData.get('startTime') ?? '');
  const endTime = String(formData.get('endTime') ?? '');
  const abstractText = String(formData.get('abstract') ?? '').trim();

  if (!title) {
    return { error: 'Sunum başlığı zorunludur.' };
  }

  try {
    await api.createPresentation({
      sessionId,
      title,
      startTime: datetimeLocalToIsoOrUndefined(startTime),
      endTime: datetimeLocalToIsoOrUndefined(endTime),
      abstract: abstractText || undefined,
    });
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sunum oluşturulamadı.' };
  }

  revalidatePath('/sessions');
  return { error: null };
}

export async function deletePresentationAction(id: string): Promise<ActionResult> {
  try {
    await api.deletePresentation(id);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sunum silinemedi.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}

export async function reorderPresentationsAction(ids: string[]): Promise<ActionResult> {
  try {
    await api.reorderPresentations(ids);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Sıralama güncellenemedi.' };
  }
  revalidatePath('/sessions');
  return { error: null };
}
