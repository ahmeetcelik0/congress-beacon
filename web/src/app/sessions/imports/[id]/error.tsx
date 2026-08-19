'use client';

import { RouteErrorFallback } from '@/components/ui/route-error-fallback';

// Bu route segmentindeki BEKLENMEYEN render hatalari (ornegin gecersiz/silinmis
// bir importId ile gelen 404) icin son care sinir bileseni. Kok layout'u
// (sidebar) SARMAZ, yalnizca bu sayfayi.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <RouteErrorFallback error={error} retry={unstable_retry} />;
}
