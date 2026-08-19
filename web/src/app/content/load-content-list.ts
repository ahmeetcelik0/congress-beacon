import { ApiError } from '@/lib/api';

export type ContentListResult<T> = { ok: true; items: T[] } | { ok: false; message: string };

/**
 * Beş `*-section.tsx` bileşeninin ORTAK veri çekme sarmalayıcısı —
 * `loadCongresses()` (`lib/load-congresses.ts`) ile AYNI desen: hata veri
 * olarak MODELLENIR, JSX'i üreten kod try/catch İÇİNE ALINMAZ. Bu ayrım
 * kozmetik değil — proje ESLint kuralı (`react-hooks/error-boundaries`)
 * JSX'in bir try/catch bloğu İÇİNDE inşa edilmesini engeller (React JSX'i
 * senkron render ETMEZ, bu yüzden component içindeki hatalar try/catch'e
 * hiç düşmez; doğru yer bir hata sınırıdır). Section bileşenleri bu
 * fonksiyonun döndürdüğü `{ok:false}` durumunu try/catch DIŞINDA, düz bir
 * `if` ile `ErrorState`e çevirir.
 */
export async function loadContentList<T>(fetcher: () => Promise<T[]>): Promise<ContentListResult<T>> {
  try {
    const items = await fetcher();
    return { ok: true, items };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof ApiError ? error.message : 'Sunucuya şu anda ulaşılamıyor olabilir.',
    };
  }
}
