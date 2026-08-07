'use server';

import { api } from '@/lib/api';
import { runContentMutation, type ActionResult } from '../shared-actions';

export type FormState = ActionResult;

function parseIsPinned(formData: FormData): boolean {
  return formData.get('isPinned') === 'on';
}

export async function createAnnouncementAction(
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
    () => api.createAnnouncement({ congressId, title, body, isPinned: parseIsPinned(formData) }),
    'Duyuru oluşturulamadı.',
  );
}

export async function updateAnnouncementAction(
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
    () => api.updateAnnouncement(id, { title, body, isPinned: parseIsPinned(formData) }),
    'Duyuru güncellenemedi.',
  );
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.deleteAnnouncement(id), 'Duyuru silinemedi.');
}

export async function reorderAnnouncementsAction(ids: string[]): Promise<ActionResult> {
  return runContentMutation(() => api.reorderAnnouncements(ids), 'Sıralama güncellenemedi.');
}

export async function publishAnnouncementAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.publishAnnouncement(id), 'Duyuru yayınlanamadı.');
}

export async function unpublishAnnouncementAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.unpublishAnnouncement(id), 'Duyuru taslağa alınamadı.');
}
