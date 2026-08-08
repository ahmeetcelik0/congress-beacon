'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { ProgramImportStatus } from '@/lib/api';

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES: ProgramImportStatus[] = ['DRAFT', 'APPROVED', 'CANCELLED', 'FAILED'];

/**
 * `PENDING`/`EXTRACTING` durumundayken staging ağacı henüz YOK — LLM çıkarımı
 * arka planda (BullMQ) sürüyor. Bu görünmez bileşen birkaç saniyede bir
 * `router.refresh()` çağırarak sunucu bileşenini yeniden çalıştırır; `status`
 * terminal bir duruma geçtiğinde (`DRAFT`/`APPROVED`/`CANCELLED`/`FAILED`)
 * interval kurulmaz/durdurulur. Hiçbir görsel çıktısı yoktur, yalnızca
 * `page.tsx`'in aldığı prop'u periyodik olarak tazeler.
 */
export function StatusPoller({ status }: { status: ProgramImportStatus }) {
  const router = useRouter();

  React.useEffect(() => {
    if (TERMINAL_STATUSES.includes(status)) return;
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, router]);

  return null;
}
