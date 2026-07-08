'use client';

import { useEffect, useState } from 'react';

const STALE_AFTER_MS = 2 * 60 * 1000;

function formatRelative(iso: string | null, now: number): string {
  if (!iso) return 'veri yok';
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 5) return 'az önce';
  if (diffSec < 60) return `${diffSec} sn önce`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} sa önce`;
}

export function Freshness({ timestamp }: { timestamp: string | null }) {
  // now'u dogrudan Date.now() ile seed etmek sunucu render zamani ile istemci
  // hydrate zamaninin farkli olmasi yuzunden hydration mismatch'e yol aciyordu.
  // Sunucu ve ilk istemci render'i ayni sabit govdeyi uretsin diye null'dan basliyoruz,
  // gercek zamana yalnizca mount sonrasi (useEffect icinde) geciyoruz.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Ilk gercek deger de bir zamanlayici callback'i icinden gelsin diye
    // setTimeout(0) kullaniyoruz; boylece setState effect govdesinde degil,
    // dis bir zamanlayicidan tetiklenmis oluyor (react-hooks/set-state-in-effect).
    const bootstrap = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(bootstrap);
      clearInterval(interval);
    };
  }, []);

  if (now === null) {
    return <span>{timestamp ? '…' : 'veri yok'}</span>;
  }

  const isStale = !timestamp || now - new Date(timestamp).getTime() > STALE_AFTER_MS;

  return (
    <span style={isStale ? { color: 'var(--tp-warn)' } : undefined}>
      {formatRelative(timestamp, now)}
    </span>
  );
}
