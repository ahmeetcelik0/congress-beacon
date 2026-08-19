'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError, type RegistrationImportApproveResult } from '@/lib/api';

export type ImportRowFormState = { error: string | null; saved: boolean };

// Satir duzeltme. Alanlar HER ZAMAN gonderilir (bos string dahil) - PATCH
// semantiginde bu "bu alani bosalt" anlamina gelir; backend kaydettikten
// sonra durum/uyariyi kendisi yeniden hesaplar
// (bkz. registration-import.service.ts `updateRow`).
export async function updateImportRowAction(
  importId: string,
  rowId: string,
  _prevState: ImportRowFormState,
  formData: FormData,
): Promise<ImportRowFormState> {
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  try {
    await api.updateRegistrationImportRow(importId, rowId, { firstName, lastName, email, phone });
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Satır güncellenemedi.',
      saved: false,
    };
  }

  revalidatePath(`/registrations/imports/${importId}`);
  return { error: null, saved: true };
}

export type RowActionResult = { error: string | null };

export async function excludeImportRowAction(importId: string, rowId: string): Promise<RowActionResult> {
  try {
    await api.excludeRegistrationImportRow(importId, rowId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'Satır çıkarılamadı.' };
  }
  revalidatePath(`/registrations/imports/${importId}`);
  return { error: null };
}

export type ApproveActionResult =
  | { error: string | null; result: RegistrationImportApproveResult }
  | { error: string; result: null };

export async function approveImportAction(importId: string): Promise<ApproveActionResult> {
  try {
    const result = await api.approveRegistrationImport(importId);
    revalidatePath(`/registrations/imports/${importId}`);
    return { error: null, result };
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Onaylama başarısız.',
      result: null,
    };
  }
}

export async function cancelImportAction(importId: string): Promise<RowActionResult> {
  try {
    await api.cancelRegistrationImport(importId);
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : 'İptal başarısız.' };
  }
  revalidatePath(`/registrations/imports/${importId}`);
  return { error: null };
}
