'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function readAdminTokenClient(): string | null {
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// CSV indirme linki dogrudan tarayici navigasyonuyla tetiklendigi (fetch degil)
// icin Authorization header'i eklenemiyor; backend bu tek durum icin token'i
// query string'den de kabul ediyor (bkz. AdminJwtGuard).
//
// Token'i dogrudan render sirasinda `document.cookie`'den okumak sunucu
// render'i (token hep null) ile ilk istemci render'ini (gercek token)
// farklilastirip hydration mismatch'e yol aciyordu. Bunun yerine ilk
// render (sunucu VE ilk istemci gecisi) her zaman token'siz href uretir;
// token yalnizca mount SONRASI bir useEffect ile okunup bir sonraki
// render'da eklenir - boylece hydration deterministik kalir.
export function ReportsDownloadLink({ congressId }: { congressId: string }) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // `react-hooks/set-state-in-effect` senkron setState'i effect gövdesinde
    // uyarıyor (bkz. `freshness.tsx`'teki aynı desen) — setTimeout(0) ile
    // güncellemeyi harici bir zamanlayıcı geri çağrısından tetikliyoruz.
    const timeout = setTimeout(() => setToken(readAdminTokenClient()), 0);
    return () => clearTimeout(timeout);
  }, []);

  const href = `${API_URL}/reports/hall-visits.csv?congressId=${congressId}${
    token ? `&token=${encodeURIComponent(token)}` : ''
  }`;

  return (
    <a href={href} className="panel-download-link">
      CSV indir
    </a>
  );
}
