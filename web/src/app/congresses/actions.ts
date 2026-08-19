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

export type MetaFormState = {
  error: string | null;
  saved: boolean;
  // Faz 6.2: beaconUuid değiştirilmek istendi VE kongrede zaten beacon
  // kayıtlıydı (backend 409 döndü) — ham backend mesajı (kaç beacon
  // etkileneceğini zaten anlatır) burada taşınır, panel bunu bir onay
  // bandında gösterip `migrateExistingBeacons: true` ile yeniden gönderir.
  beaconUuidConflict: string | null;
};

// Kongre kartı üzerindeki "tanıtım" alanları (mobil ana ekranda gösterilecek
// kapak görseli, açıklama, iletişim bilgileri vb.) + beaconUuid (KİMLİK
// alanı, ama artık burada da düzenlenebilir - bkz. Faz 6.2, değişiklik
// mevcut beacon'lar varsa `migrateExistingBeacons` onayı gerektirir, aşağıya
// bkz.). Aynı `/congresses` sayfasında kart üzerinde açılır/kapanır (bkz.
// `congress-card-footer.tsx`). Tüm alanlar opsiyonel PATCH alanları -
// `updateRegistration` ile aynı kural: form HER ZAMAN tüm alanları
// gönderir, boş string o alanı temizler (beaconUuid hariç - o zorunlu).
export async function updateCongressMetaAction(
  congressId: string,
  _prevState: MetaFormState,
  formData: FormData,
): Promise<MetaFormState> {
  const fullName = String(formData.get('fullName') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const coverImageUrl = String(formData.get('coverImageUrl') ?? '').trim();
  const websiteUrl = String(formData.get('websiteUrl') ?? '').trim();
  const contactEmail = String(formData.get('contactEmail') ?? '').trim();
  const contactPhone = String(formData.get('contactPhone') ?? '').trim();
  const beaconUuid = String(formData.get('beaconUuid') ?? '').trim();
  const migrateExistingBeacons = formData.get('migrateExistingBeacons') === 'true';

  if (!beaconUuid) {
    return { error: 'Beacon UUID boş bırakılamaz.', saved: false, beaconUuidConflict: null };
  }

  try {
    await api.updateCongress(congressId, {
      fullName,
      description,
      coverImageUrl,
      websiteUrl,
      contactEmail,
      contactPhone,
      beaconUuid,
      migrateExistingBeacons,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { error: null, saved: false, beaconUuidConflict: error.message };
    }
    return {
      error: error instanceof ApiError ? error.message : 'Kongre bilgileri güncellenemedi.',
      saved: false,
      beaconUuidConflict: null,
    };
  }

  revalidatePath('/congresses');
  return { error: null, saved: true, beaconUuidConflict: null };
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
