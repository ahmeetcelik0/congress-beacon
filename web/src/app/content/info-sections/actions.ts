'use server';

import { api } from '@/lib/api';
import { runContentMutation, type ActionResult } from '../shared-actions';

export type FormState = ActionResult;

function parseIsPublished(formData: FormData): boolean {
  return formData.get('isPublished') === 'on';
}

export async function createInfoSectionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!congressId || !title || !body) {
    return { error: 'Başlık ve içerik zorunludur.' };
  }

  return runContentMutation(
    () => api.createInfoSection({ congressId, title, body, isPublished: parseIsPublished(formData) }),
    'Bilgi bölümü oluşturulamadı.',
  );
}

export async function updateInfoSectionAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!title || !body) {
    return { error: 'Başlık ve içerik zorunludur.' };
  }

  return runContentMutation(
    () => api.updateInfoSection(id, { title, body, isPublished: parseIsPublished(formData) }),
    'Bilgi bölümü güncellenemedi.',
  );
}

export async function deleteInfoSectionAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.deleteInfoSection(id), 'Bilgi bölümü silinemedi.');
}

export async function reorderInfoSectionsAction(ids: string[]): Promise<ActionResult> {
  return runContentMutation(() => api.reorderInfoSections(ids), 'Sıralama güncellenemedi.');
}
