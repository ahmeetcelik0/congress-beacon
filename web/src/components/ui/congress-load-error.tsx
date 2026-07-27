'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ErrorState } from './error-state';

/**
 * `loadCongresses()` basarisiz oldugunda (backend'e ulasilamadi/ag hatasi)
 * tum sayfalarda kullanilan tek tip hata blogu. `EmptyState` ile ("hic
 * kongre yok") KARISTIRILMAMASI icin bilincli olarak `ErrorState` kullanir.
 *
 * Retry, Server Component verisi oldugu icin `router.refresh()` ile
 * yapilir - bu, sayfayi tam yeniden yuklemeden (URL/query, congressId
 * dahil, KORUNARAK) yalnizca sunucu bilesenlerini yeniden calistirir.
 */
export function CongressLoadError({ showBackLink = false }: { showBackLink?: boolean }) {
  const router = useRouter();

  return (
    <ErrorState
      title="Kongre listesi alınamadı."
      description="Sunucuya şu anda ulaşılamıyor olabilir. Bağlantınızı kontrol edip tekrar deneyin."
      action={
        <div className="ui-error-state-action-row">
          <button type="button" onClick={() => router.refresh()}>
            Yeniden dene
          </button>
          {showBackLink && <Link href="/congresses">Kongreler sayfasına git</Link>}
        </div>
      }
    />
  );
}
