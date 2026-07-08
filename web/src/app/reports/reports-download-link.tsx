'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function readAdminTokenClient(): string | null {
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// CSV indirme linki dogrudan tarayici navigasyonuyla tetiklendigi (fetch degil)
// icin Authorization header'i eklenemiyor; backend bu tek durum icin token'i
// query string'den de kabul ediyor (bkz. AdminJwtGuard).
export function ReportsDownloadLink({ congressId }: { congressId: string }) {
  const token = typeof window !== 'undefined' ? readAdminTokenClient() : null;
  const href = `${API_URL}/reports/hall-visits.csv?congressId=${congressId}${
    token ? `&token=${encodeURIComponent(token)}` : ''
  }`;

  return (
    <a href={href} className="panel-download-link">
      CSV indir
    </a>
  );
}
