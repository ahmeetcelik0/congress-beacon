'use client';

import { useEffect, useState } from 'react';
import { datetimeLocalToIso } from '@/lib/congress-time';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function readAdminTokenClient(): string | null {
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Faz 13b: backend `ANALIZ_DEFTERI_SAYFA_ANAHTARLARI` (bkz.
// `analiz-defteri-query.dto.ts`) ile TUTARLI tutulmalı - ayrı paket olduğu
// için import EDİLEMİYOR (Faz 12'deki CONGRESS_TIME_ZONE tekrarıyla AYNI
// durum). Kapak bu listede YOKTUR, her zaman yazılır.
const SAYFA_GRUPLARI: { baslik: string; sayfalar: { anahtar: string; etiket: string }[] }[] = [
  {
    baslik: 'Ham veri',
    sayfalar: [
      { anahtar: 'hamGozlem', etiket: 'Ham Gözlem' },
      { anahtar: 'dakikaOzeti', etiket: 'Dakika Özeti' },
      { anahtar: 'cihazVeRssi', etiket: 'Cihaz ve RSSI' },
      { anahtar: 'gonderimSagligi', etiket: 'Gönderim Sağlığı' },
    ],
  },
  {
    baslik: 'Kararlar',
    sayfalar: [
      { anahtar: 'girisCikisOlaylari', etiket: 'Giriş-Çıkış Olayları' },
      { anahtar: 'kararDetayi', etiket: 'Karar Detayı' },
    ],
  },
  {
    baslik: 'Ziyaretler',
    sayfalar: [
      { anahtar: 'salonZiyaretleri', etiket: 'Salon Ziyaretleri' },
      { anahtar: 'kullaniciSalonOzeti', etiket: 'Kullanıcı-Salon Özeti' },
    ],
  },
  {
    baslik: 'Referans',
    sayfalar: [
      { anahtar: 'katilimcilar', etiket: 'Katılımcılar' },
      { anahtar: 'beaconEnvanteri', etiket: 'Beacon Envanteri' },
      { anahtar: 'kongreAyarlari', etiket: 'Kongre Ayarları' },
      { anahtar: 'program', etiket: 'Program' },
      { anahtar: 'veriSozlugu', etiket: 'Veri Sözlüğü' },
    ],
  },
];

const TUM_SAYFA_ANAHTARLARI = SAYFA_GRUPLARI.flatMap((g) =>
  g.sayfalar.map((s) => s.anahtar),
);

type SayfaTahmini = {
  sayfa: string;
  satir: number;
  limitiAsiyorMu: boolean;
};

type SatirTahminiSonuc = {
  sayfalar: SayfaTahmini[];
  toplamSatir: number;
  tahminiDosyaBoyutuByte: number;
  limitiAsanSayfaVarMi: boolean;
};

function formatByte(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

type AnalizDefteriFormProps = {
  congressId: string;
  halls: { id: string; name: string }[];
  users: { userId: string; firstName: string; lastName: string }[];
};

// Faz 13a/13b: Excel indirme, eski CSV indirme linkiyle AYNI nedenden
// (tarayıcı navigasyonu, fetch değil) token'i query string'den geçiriyor.
// Tarih-saat aralığı ZORUNLU (backend 400 döner eksikse) ve kullanıcı/
// salon/sayfa çoklu seçim var - bu yüzden `<a href>` yerine bir `<button>`
// kullanılıyor. Satır tahmini AYRI bir istektir (fetch + Authorization
// header - burada token query string'e GEREK YOK çünkü fetch header
// ekleyebiliyor, indirmedeki gibi navigasyon kısıtı yok).
export function AnalizDefteriForm({ congressId, halls, users }: AnalizDefteriFormProps) {
  const [token, setToken] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(
    new Set(TUM_SAYFA_ANAHTARLARI),
  );
  const [error, setError] = useState<string | null>(null);
  const [tahmin, setTahmin] = useState<SatirTahminiSonuc | null>(null);
  const [tahminYukleniyor, setTahminYukleniyor] = useState(false);
  const [tahminHata, setTahminHata] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setToken(readAdminTokenClient()), 0);
    return () => clearTimeout(timeout);
  }, []);

  function togglePage(anahtar: string) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(anahtar)) next.delete(anahtar);
      else next.add(anahtar);
      return next;
    });
    setTahmin(null);
  }

  function toggleGroup(anahtarlar: string[], hepsiSecili: boolean) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      for (const anahtar of anahtarlar) {
        if (hepsiSecili) next.delete(anahtar);
        else next.add(anahtar);
      }
      return next;
    });
    setTahmin(null);
  }

  function buildParams(): URLSearchParams | null {
    if (!from || !to) return null;
    const params = new URLSearchParams({
      congressId,
      from: datetimeLocalToIso(from),
      to: datetimeLocalToIso(to),
    });
    if (selectedUserIds.length > 0) params.set('userIds', selectedUserIds.join(','));
    if (selectedHallIds.length > 0) params.set('hallIds', selectedHallIds.join(','));
    // Tümü seçiliyse `pages` HİÇ gönderilmez - backend boş/verilmemiş
    // durumu zaten "tümü" sayıyor (bkz. `resolved-filter.ts`).
    if (selectedPages.size < TUM_SAYFA_ANAHTARLARI.length) {
      params.set('pages', Array.from(selectedPages).join(','));
    }
    return params;
  }

  async function handleTahmin() {
    const params = buildParams();
    if (!params) {
      setError('Başlangıç ve bitiş tarih-saatini seçmelisiniz.');
      return;
    }
    setError(null);
    setTahminHata(null);
    setTahminYukleniyor(true);
    try {
      const res = await fetch(
        `${API_URL}/reports/analiz-defteri/tahmin?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        throw new Error(`İstek başarısız (${res.status})`);
      }
      const data = (await res.json()) as SatirTahminiSonuc;
      setTahmin(data);
    } catch (e) {
      setTahminHata(e instanceof Error ? e.message : 'Tahmin alınamadı.');
    } finally {
      setTahminYukleniyor(false);
    }
  }

  function handleDownload() {
    const params = buildParams();
    if (!params) {
      setError('Başlangıç ve bitiş tarih-saatini seçmelisiniz.');
      return;
    }
    setError(null);
    if (token) params.set('token', token);

    window.open(`${API_URL}/reports/analiz-defteri.xlsx?${params.toString()}`, '_blank');
  }

  return (
    <div className="panel-form analiz-defteri-form">
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

      <div className="analiz-defteri-sayfa-secimi">
        <span className="analiz-defteri-sayfa-secimi-baslik">Sayfalar (Kapak her zaman dahil)</span>
        <div className="analiz-defteri-sayfa-gruplari">
          {SAYFA_GRUPLARI.map((grup) => {
            const anahtarlar = grup.sayfalar.map((s) => s.anahtar);
            const hepsiSecili = anahtarlar.every((a) => selectedPages.has(a));
            return (
              <fieldset key={grup.baslik} className="analiz-defteri-sayfa-grubu">
                <legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={hepsiSecili}
                      onChange={() => toggleGroup(anahtarlar, hepsiSecili)}
                    />
                    {grup.baslik}
                  </label>
                </legend>
                {grup.sayfalar.map((sayfa) => (
                  <label key={sayfa.anahtar} className="analiz-defteri-sayfa-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPages.has(sayfa.anahtar)}
                      onChange={() => togglePage(sayfa.anahtar)}
                    />
                    {sayfa.etiket}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="analiz-defteri-form-actions">
        <button type="button" onClick={handleTahmin} disabled={tahminYukleniyor}>
          {tahminYukleniyor ? 'Hesaplanıyor…' : 'Tahmini göster'}
        </button>
        <button type="button" onClick={handleDownload}>
          Excel indir
        </button>
      </div>

      {error && (
        <p className="panel-error" role="alert">
          {error}
        </p>
      )}
      {tahminHata && (
        <p className="panel-error" role="alert">
          {tahminHata}
        </p>
      )}

      {tahmin && (
        <div className="analiz-defteri-tahmin">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Sayfa</th>
                <th>Tahmini satır</th>
              </tr>
            </thead>
            <tbody>
              {tahmin.sayfalar.map((s) => (
                <tr key={s.sayfa}>
                  <td>{s.sayfa}</td>
                  <td>
                    {s.satir.toLocaleString('tr-TR')}
                    {s.limitiAsiyorMu && (
                      <strong className="panel-warning"> — Excel limitini aşıyor</strong>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Toplam {tahmin.toplamSatir.toLocaleString('tr-TR')} satır, tahmini dosya boyutu{' '}
            {formatByte(tahmin.tahminiDosyaBoyutuByte)}.
          </p>
          {tahmin.limitiAsanSayfaVarMi && (
            <p className="panel-warning">
              En az bir sayfa Excel&apos;in satır limitini (1.048.576) aşıyor - indirirseniz o
              sayfa kesilecek. Daha dar bir tarih-saat aralığı seçmeniz önerilir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
