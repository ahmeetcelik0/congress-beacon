import { redirect } from 'next/navigation';
import { api, ApiError, type Congress } from './api';

export type CongressLoadResult = { ok: true; congresses: Congress[] } | { ok: false };

/**
 * Tum sayfalarin (congresses/halls/beacons/attendance/tracking-health/
 * sessions/reports) kendi `CongressSelector`'i icin ihtiyac duydugu ortak
 * kongre listesi yuklemesi. Daha once her page.tsx bunu korumasiz cagiriyordu;
 * backend tamamen erisilemez oldugunda bu, Next.js'in TUM ROTAYI (root layout/
 * sidebar dahil) genel 500 sayfasina dusurmesine yol aciyordu (bkz. Faz 1.1
 * denetim bulgusu).
 *
 * Next 16'nin "beklenen hatalari throw yerine donus degeriyle modelle"
 * onerisine uyarak burada hata YUTULUYOR, throw EDILMIYOR - cagiran page.tsx
 * `!result.ok` durumunda `CongressLoadError` gosterip erken donebiliyor.
 *
 * 401/403 (gecersiz/suresi dolmus oturum) ozel olarak ayriliyor: bu durumda
 * "kongre listesi alinamadi" gibi yanlis bir mesaj yerine, proxy.ts'nin
 * token-yok durumunda yaptigi ile ayni sekilde giris ekranina yonlendiriyoruz.
 * `redirect()` burada catch blogu ICINDE cagriliyor ama KENDI try'imizin
 * DISINDA (try zaten bitmis durumda) oldugu icin firlattigi ozel
 * NEXT_REDIRECT hatasi bu fonksiyon icinde tekrar yakalanmiyor.
 */
export async function loadCongresses(): Promise<CongressLoadResult> {
  try {
    const congresses = await api.listCongresses();
    return { ok: true, congresses };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect('/admin/login');
    }
    return { ok: false };
  }
}
