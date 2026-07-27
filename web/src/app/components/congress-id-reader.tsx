'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Sidebar'ın aktif kongreyi (URL'deki `?congressId=`) izlemesi için ayrı bir
 * yaprak bileşen. `useSearchParams` üretim derlemesinde bir Suspense sınırı
 * gerektirdiğinden (bkz. Next.js dokümantasyonu) kasıtlı olarak izole
 * edildi — geri kalan sidebar ağacı bu yüzden client-side render'a
 * zorlanmıyor.
 */
export function CongressIdReader({ onChange }: { onChange: (congressId: string | null) => void }) {
  const searchParams = useSearchParams();
  const congressId = searchParams.get('congressId');

  useEffect(() => {
    onChange(congressId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [congressId]);

  return null;
}
