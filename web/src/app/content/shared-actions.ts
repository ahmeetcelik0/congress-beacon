import { revalidatePath } from 'next/cache';
import { ApiError } from '@/lib/api';

export type ActionResult = { error: string | null };

/**
 * Beş içerik türünün (CongressInfoSection/Venue/Announcement/Sponsor/
 * KeynoteSpeaker) TÜM mutasyon eylemleri (oluştur/güncelle/sil/sırala/
 * yayınla) AYNI gövdeye sahip: API çağrısını dene, `ApiError` mesajını
 * olduğu gibi göster, beklenmeyen hatada genel bir Türkçe mesaja düş,
 * başarılıysa `/content`i yeniden doğrula. Bu ortak gövde burada TEK yerde
 * tutulur; her tür kendi ince `'use server'` sarmalayıcısını yazar (bkz.
 * `venues/actions.ts` vb.) çünkü FormData ayrıştırma/doğrulama alanları
 * türe özgüdür ve zorlama bir ortak arayüze sıkıştırılması okunabilirliği
 * bozar (bkz. görev kısıtları).
 *
 * NOT: Bu dosyanın kendisi `'use server'` DEĞİLDİR — yalnızca sunucu
 * tarafında diğer `'use server'` dosyaları tarafından import edilen sıradan
 * bir yardımcı modüldür. Fonksiyon argümanı (`operation`) bu yüzden bir
 * React Sunucu Eylemi sınırını GEÇMEZ, normal bir JS fonksiyon çağrısıdır.
 */
export async function runContentMutation(
  operation: () => Promise<unknown>,
  genericErrorMessage: string,
): Promise<ActionResult> {
  try {
    await operation();
  } catch (error) {
    return { error: error instanceof ApiError ? error.message : genericErrorMessage };
  }

  revalidatePath('/content');
  return { error: null };
}
