'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

function hasContact(email: string, phone: string): boolean {
  return email.trim().length > 0 || phone.trim().length > 0;
}

export type FormState = { error: string | null; success: boolean };

// Manuel katilimci ekleme. Zorunlu kural (e-posta VEYA telefon en az biri)
// backend'de de dogrulanir (400 doner) - burada erken donerek gereksiz bir
// agi istegi onlenir (HallForm'daki `parseRequiredCapacity` ile ayni yaklasim).
export async function createRegistrationAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!congressId || !firstName || !lastName) {
    return { error: 'Kongre, ad ve soyad zorunludur.', success: false };
  }
  if (!hasContact(email, phone)) {
    return {
      error: 'E-posta veya telefon alanlarından en az biri girilmelidir.',
      success: false,
    };
  }

  try {
    await api.createRegistration({
      congressId,
      firstName,
      lastName,
      email: email || undefined,
      phone: phone || undefined,
    });
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Katılımcı eklenemedi.',
      success: false,
    };
  }

  revalidatePath('/registrations');
  return { error: null, success: true };
}

export type RowFormState = { error: string | null; saved: boolean };

// Katilimci duzenleme (ad/soyad/e-posta/telefon). Tum alanlar HER ZAMAN
// gonderilir (bos string dahil) - PATCH semantiginde bu, "bu alani bosalt"
// anlamina gelir ve duzenleme formunun mevcut degeri her zaman yansitmasi
// gereken tasarimiyla tutarlidir (bkz. api.ts `updateRegistration` yorumu).
export async function updateRegistrationAction(
  registrationId: string,
  _prevState: RowFormState,
  formData: FormData,
): Promise<RowFormState> {
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!firstName || !lastName) {
    return { error: 'Ad ve soyad zorunludur.', saved: false };
  }
  if (!hasContact(email, phone)) {
    return {
      error: 'E-posta veya telefon alanlarından en az biri girilmelidir.',
      saved: false,
    };
  }

  try {
    await api.updateRegistration(registrationId, { firstName, lastName, email, phone });
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Katılımcı güncellenemedi.',
      saved: false,
    };
  }

  revalidatePath('/registrations');
  return { error: null, saved: true };
}

export type RowActionResult = { error: string | null };

export async function deactivateRegistrationAction(registrationId: string): Promise<RowActionResult> {
  try {
    await api.deactivateRegistration(registrationId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Pasifleştirme başarısız.' };
  }
  revalidatePath('/registrations');
  return { error: null };
}

export async function reactivateRegistrationAction(registrationId: string): Promise<RowActionResult> {
  try {
    await api.reactivateRegistration(registrationId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Aktifleştirme başarısız.' };
  }
  revalidatePath('/registrations');
  return { error: null };
}

export type UploadFormState = { error: string | null };

// Excel/CSV yukleme. Basarili olursa onizleme sayfasina yonlendirir -
// `recognizedColumns`/`unrecognizedColumns` yalnizca bu uc noktanin
// yanitinda gelir (GET .../imports/:id BUNLARI DONDURMEZ - dogrulanmis
// backend kaynagi: registration-import.service.ts `getImportDetail`), bu
// yuzden onizleme sayfasinin bunlari gosterebilmesi icin query param olarak
// tasiniyor. Sayfa sonradan (ör. "son yuklemeler" listesinden) tekrar
// ziyaret edilirse bu parametreler olmayacagi icin o bolum gizlenir - bu
// backend sozlesmesinden kaynaklanan bilincli bir sinirlama, bkz. teslim notu.
export async function uploadRegistrationImportAction(
  _prevState: UploadFormState,
  formData: FormData,
): Promise<UploadFormState> {
  const congressId = String(formData.get('congressId') ?? '');
  const file = formData.get('file');

  if (!congressId) {
    return { error: 'Kongre seçilmedi.' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Yüklenecek bir dosya seçin.' };
  }

  let importId: string;
  let recognized: string[] = [];
  let unrecognized: string[] = [];
  try {
    const result = await api.uploadRegistrationImport(congressId, file);
    importId = result.importId;
    recognized = result.recognizedColumns;
    unrecognized = result.unrecognizedColumns;
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Dosya yüklenemedi.' };
  }

  revalidatePath('/registrations');

  const query = new URLSearchParams({ congressId });
  if (recognized.length > 0) query.set('recognized', recognized.join(','));
  if (unrecognized.length > 0) query.set('unrecognized', unrecognized.join(','));
  redirect(`/registrations/imports/${importId}?${query.toString()}`);
}
