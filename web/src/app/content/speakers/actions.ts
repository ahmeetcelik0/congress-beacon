'use server';

import { api } from '@/lib/api';
import { runContentMutation, type ActionResult } from '../shared-actions';

export type FormState = ActionResult;

function readSpeakerFields(formData: FormData) {
  return {
    fullName: String(formData.get('fullName') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    institution: String(formData.get('institution') ?? '').trim(),
    country: String(formData.get('country') ?? '').trim(),
    bio: String(formData.get('bio') ?? '').trim(),
    photoUrl: String(formData.get('photoUrl') ?? '').trim(),
  };
}

export async function createKeynoteSpeakerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const fields = readSpeakerFields(formData);

  if (!congressId || !fields.fullName) {
    return { error: 'Konuşmacının adı soyadı zorunludur.' };
  }

  return runContentMutation(
    () =>
      api.createKeynoteSpeaker({
        congressId,
        fullName: fields.fullName,
        title: fields.title || undefined,
        institution: fields.institution || undefined,
        country: fields.country || undefined,
        bio: fields.bio || undefined,
        photoUrl: fields.photoUrl || undefined,
      }),
    'Konuşmacı oluşturulamadı.',
  );
}

export async function updateKeynoteSpeakerAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readSpeakerFields(formData);
  if (!fields.fullName) {
    return { error: 'Konuşmacının adı soyadı zorunludur.' };
  }

  return runContentMutation(() => api.updateKeynoteSpeaker(id, fields), 'Konuşmacı güncellenemedi.');
}

export async function deleteKeynoteSpeakerAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.deleteKeynoteSpeaker(id), 'Konuşmacı silinemedi.');
}

export async function reorderKeynoteSpeakersAction(ids: string[]): Promise<ActionResult> {
  return runContentMutation(() => api.reorderKeynoteSpeakers(ids), 'Sıralama güncellenemedi.');
}
