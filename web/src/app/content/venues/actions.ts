'use server';

import { api, type VenueType } from '@/lib/api';
import { runContentMutation, type ActionResult } from '../shared-actions';

export type FormState = ActionResult;

function parseOptionalCoordinate(raw: FormDataEntryValue | null): { value?: number; error?: string } {
  const str = String(raw ?? '').trim();
  if (!str) return {};
  const value = Number(str);
  if (Number.isNaN(value)) {
    return { error: 'Enlem/Boylam sayısal bir değer olmalıdır.' };
  }
  return { value };
}

function readVenueFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    type: String(formData.get('type') ?? '') as VenueType | '',
    address: String(formData.get('address') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    websiteUrl: String(formData.get('websiteUrl') ?? '').trim(),
    mapUrl: String(formData.get('mapUrl') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    imageUrl: String(formData.get('imageUrl') ?? '').trim(),
  };
}

export async function createVenueAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const fields = readVenueFields(formData);

  if (!congressId || !fields.name) {
    return { error: 'Mekan adı zorunludur.' };
  }

  const latitude = parseOptionalCoordinate(formData.get('latitude'));
  if (latitude.error) return { error: latitude.error };
  const longitude = parseOptionalCoordinate(formData.get('longitude'));
  if (longitude.error) return { error: longitude.error };

  return runContentMutation(
    () =>
      api.createVenue({
        congressId,
        name: fields.name,
        type: fields.type || undefined,
        address: fields.address || undefined,
        city: fields.city || undefined,
        phone: fields.phone || undefined,
        websiteUrl: fields.websiteUrl || undefined,
        mapUrl: fields.mapUrl || undefined,
        latitude: latitude.value,
        longitude: longitude.value,
        description: fields.description || undefined,
        imageUrl: fields.imageUrl || undefined,
      }),
    'Mekan oluşturulamadı.',
  );
}

// Duzenleme formu TUM alanlari HER ZAMAN gonderir (bos string dahil = alani
// bosalt) - `updateRegistration` PATCH kismi semantigiyle ayni kural (bkz.
// api.ts yorumu). Enlem/boylam SAYISAL oldugu icin bu kuralin DISINDA: bos
// birakilirsa alan hic GONDERILMEZ (mevcut deger degismez) - onceden
// girilmis bir koordinati bu formdan BOSALTMAK desteklenmiyor (bilinçli
// basitlestirme, bkz. teslim notu).
export async function updateVenueAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const fields = readVenueFields(formData);
  if (!fields.name) {
    return { error: 'Mekan adı zorunludur.' };
  }

  const latitude = parseOptionalCoordinate(formData.get('latitude'));
  if (latitude.error) return { error: latitude.error };
  const longitude = parseOptionalCoordinate(formData.get('longitude'));
  if (longitude.error) return { error: longitude.error };

  return runContentMutation(
    () =>
      api.updateVenue(id, {
        name: fields.name,
        type: (fields.type || undefined) as VenueType | undefined,
        address: fields.address,
        city: fields.city,
        phone: fields.phone,
        websiteUrl: fields.websiteUrl,
        mapUrl: fields.mapUrl,
        description: fields.description,
        imageUrl: fields.imageUrl,
        ...(latitude.value !== undefined ? { latitude: latitude.value } : {}),
        ...(longitude.value !== undefined ? { longitude: longitude.value } : {}),
      }),
    'Mekan güncellenemedi.',
  );
}

export async function deleteVenueAction(id: string): Promise<ActionResult> {
  return runContentMutation(() => api.deleteVenue(id), 'Mekan silinemedi.');
}

export async function reorderVenuesAction(ids: string[]): Promise<ActionResult> {
  return runContentMutation(() => api.reorderVenues(ids), 'Sıralama güncellenemedi.');
}
