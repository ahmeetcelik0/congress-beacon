'use server';

import { api, type SponsorTier } from '@/lib/api';
import { runContentMutation, type ActionResult } from '../shared-actions';

export type FormState = ActionResult;

function readSponsorFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    tier: String(formData.get('tier') ?? '') as SponsorTier | '',
    logoUrl: String(formData.get('logoUrl') ?? '').trim(),
    websiteUrl: String(formData.get('websiteUrl') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
  };
}

export async function createSponsorAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const fields = readSponsorFields(formData);

  if (!congressId || !fields.name) {
    return { error: 'Sponsor adı zorunludur.' };
  }

  return runContentMutation(
    () =>
      api.createSponsor({
        congressId,
        name: fields.name,
        tier: fields.tier || undefined,
        logoUrl: fields.logoUrl || undefined,
        websiteUrl: fields.websiteUrl || undefined,
        description: fields.description || undefined,
      }),
    'Sponsor oluşturulamadı.',
  );
}

export async function updateSponsorAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readSponsorFields(formData);
  if (!fields.name) {
    return { error: 'Sponsor adı zorunludur.' };
  }

  return runContentMutation(
    () =>
      api.updateSponsor(id, {
        name: fields.name,
        tier: (fields.tier || undefined) as SponsorTier | undefined,
        logoUrl: fields.logoUrl,
        websiteUrl: fields.websiteUrl,
        description: fields.description,
      }),
    'Sponsor güncellenemedi.',
  );
}

export async function deleteSponsorAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.deleteSponsor(id), 'Sponsor silinemedi.');
}

export async function reorderSponsorsAction(ids: string[]): Promise<ActionResult> {
  return runContentMutation(() => api.reorderSponsors(ids), 'Sıralama güncellenemedi.');
}
