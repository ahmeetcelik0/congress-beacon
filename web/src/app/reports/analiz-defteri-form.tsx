'use client';

import { useEffect, useState } from 'react';
import { datetimeLocalToIso } from '@/lib/congress-time';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function readAdminTokenClient(): string | null {
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

type AnalizDefteriFormProps = {
  congressId: string;
  halls: { id: string; name: string }[];
  users: { userId: string; firstName: string; lastName: string }[];
};

// Faz 13a: Excel indirme, eski CSV indirme linkiyle AYNI nedenden (tarayıcı
// navigasyonu, fetch değil) token'i query string'den geçiriyor. Farkı:
// burada tarih+saat aralığı ZORUNLU
// (backend 400 döner eksikse) ve kullanıcı/salon çoklu seçim var - bu
// yüzden `<a href>` yerine bir `<button>` kullanılıyor, boş aralıkla
// indirmeyi client tarafında da engellemek (backend'e gitmeden) için.
export function AnalizDefteriForm({ congressId, halls, users }: AnalizDefteriFormProps) {
  const [token, setToken] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setToken(readAdminTokenClient()), 0);
    return () => clearTimeout(timeout);
  }, []);

  function handleDownload() {
    if (!from || !to) {
      setError('Başlangıç ve bitiş tarih-saatini seçmelisiniz.');
      return;
    }
    setError(null);

    const params = new URLSearchParams({
      congressId,
      from: datetimeLocalToIso(from),
      to: datetimeLocalToIso(to),
    });
    if (selectedUserIds.length > 0) params.set('userIds', selectedUserIds.join(','));
    if (selectedHallIds.length > 0) params.set('hallIds', selectedHallIds.join(','));
    if (token) params.set('token', token);

    window.open(`${API_URL}/reports/analiz-defteri.xlsx?${params.toString()}`, '_blank');
  }

  return (
    <div className="panel-form">
      <label>
        Başlangıç
        <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        Bitiş
        <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label>
        Kullanıcılar (boş = tümü)
        <select
          multiple
          size={5}
          value={selectedUserIds}
          onChange={(e) =>
            setSelectedUserIds(Array.from(e.target.selectedOptions, (o) => o.value))
          }
        >
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
      </label>
      <label>
        Salonlar (boş = tümü)
        <select
          multiple
          size={5}
          value={selectedHallIds}
          onChange={(e) =>
            setSelectedHallIds(Array.from(e.target.selectedOptions, (o) => o.value))
          }
        >
          {halls.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={handleDownload}>
        Excel indir
      </button>
      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
