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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isStale = !timestamp || now - new Date(timestamp).getTime() > STALE_AFTER_MS;

  return (
    <span style={isStale ? { color: 'var(--tp-warn)' } : undefined}>
      {formatRelative(timestamp, now)}
    </span>
  );
}
