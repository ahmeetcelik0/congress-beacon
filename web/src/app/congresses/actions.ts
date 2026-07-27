'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';

export type FormState = { error: string | null; success: boolean };

export async function createCongressAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();
  const accessCode = String(formData.get('accessCode') ?? '').trim();
  const beaconUuid = String(formData.get('beaconUuid') ?? '').trim();
  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();

  if (!name || !code || !accessCode || !beaconUuid) {
    return {
      error: 'İsim, kongre kodu, erişim kodu ve beacon UUID zorunludur.',
      success: false,
    };
  }

  // Her ikisi de verilmişse basit tarih tutarlılığı: bitiş, başlangıçtan önce
  // olamaz. `YYYY-MM-DD` biçimindeki string karşılaştırması kronolojik
  // sıralamayla aynı sonucu verir (bkz. `<input type="date">`).
  if (startDate && endDate && endDate < startDate) {
    return { error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.', success: false };
  }

  try {
    await api.createCongress({
      name,
      code,
      accessCode,
      beaconUuid,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  } catch (error) {
    return {
      error: error instanceof ApiError ? error.message : 'Kongre oluşturulamadı.',
      success: false,
    };
  }

  revalidatePath('/congresses');
  return { error: null, success: true };
}

export type DeleteCongressResult = { error: string | null };

/**
 * Doğrudan bir istemci bileşeninden (bkz. `congress-delete-button.tsx`)
 * `startTransition` içinde çağrılır — `<form action>` YERİNE bilinçli
 * olarak böyle: onay dialog'u açıkken hata OLURSA dialog kapanmamalı ve
 * hata dialog içinde gösterilmeli, bu da hatayı bir dönüş değeriyle
 * modellemeyi (throw yerine) gerektiriyor.
 */
export async function deleteCongressAction(id: string): Promise<DeleteCongressResult> {
  try {
    await api.deleteCongress(id);
  } catch (error) {
    // Backend, bu kongreye bağlı salon/beacon/katılımcı/oturum kaydı olduğu
    // için silmeyi reddederse 409 + açıklayıcı bir Türkçe mesajla döner
    // (bkz. `CongressService.remove()`) — bu mesaj güvenle olduğu gibi
    // gösterilir. Diğer TÜM durumlar (500 "Internal server error" gibi
    // beklenmeyen/ham backend mesajları dahil) ham gösterilMEZ, güvenli
    // genel bir mesaja düşülür.
    if (error instanceof ApiError && error.status === 409) {
      return { error: error.message };
    }
    return { error: 'Kongre silinemedi. Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.' };
  }

  revalidatePath('/congresses');
  return { error: null };
}
