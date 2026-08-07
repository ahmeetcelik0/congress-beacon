'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function readAdminTokenClient(): string | null {
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// `ReportsDownloadLink` ile BİREBİR aynı desen (bkz. o dosyadaki yorum):
// binary xlsx indirme dogrudan tarayici navigasyonuyla oldugu icin
// Authorization header'i eklenemiyor, token query string'den geciriliyor
// (backend AdminJwtGuard bunu destekliyor). Hydration mismatch'i onlemek
// icin token yalnizca mount SONRASI okunuyor.
export function ImportTemplateLink() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setToken(readAdminTokenClient()), 0);
    return () => clearTimeout(timeout);
  }, []);

  const href = `${API_URL}/admin/registrations/template.xlsx${
    token ? `?token=${encodeURIComponent(token)}` : ''
  }`;

  return (
    <a href={href} className="panel-download-link">
      Şablon indir (.xlsx)
    </a>
  );
}
