'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type HallVisitSummary } from '@/lib/api';
import { getHallColor } from '@/lib/hall-colors';
import { formatIstanbulDateTime as formatDateTime } from '@/lib/congress-time';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/error-state';

const PAGE_SIZE = 10;
const ALL_HALLS_VALUE = 'all';

// Faz 12: TZ-bagimsiz - iki epoch farki (sure), saat dilimi donusumune
// hic girmez, congress-time.ts'e TASINMADI.
function formatDuration(startedAt: string, endedAt: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes} dk`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

// v3 kararlarinda guven, 0-100 arasi gercek bir yuzdedir; v2'de yalnizca
// "yuksek/orta/dusuk" etiketi vardi. Eski kayitlarda yuzde yok, etiket kalir.
function formatConfidence(
  confidenceLevel: string | null,
  confidenceScore: number | null,
): string {
  if (confidenceScore === null) {
    return confidenceLevel ?? '—';
  }
  return `%${Math.round(confidenceScore)}${confidenceLevel ? ` · ${confidenceLevel}` : ''}`;
}

export function HallVisitsTable({
  congressId,
  halls,
}: {
  congressId: string;
  halls: { hallId: string; hallName: string }[];
}) {
  const [hallId, setHallId] = useState(ALL_HALLS_VALUE);
  const [isOpenFilter, setIsOpenFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // data'yi yenileme sirasinda da eski haliyle gosteririz (skeleton/flash yok),
  // bu yuzden ayri bir "loading" state'i tutmuyoruz.
  const [data, setData] = useState<{ items: HallVisitSummary[]; total: number } | null>(null);
  // İlk yükleme hiç veri getirmediyse (data === null) bu hata ENGELLEYİCİ
  // (ErrorState tüm tabloyu değiştirir). Daha önce başarılı veri geldiyse
  // (data !== null) aynı hata yalnızca engelleyici olmayan bir uyarı şeridi
  // olarak gösterilir; veri SİLİNMEZ (bkz. proje teslim notu).
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRefreshTick((tick) => tick + 1), 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function handleHallChange(value: string) {
    setHallId(value);
    setPage(1);
  }

  function handleIsOpenChange(value: 'all' | 'open' | 'closed') {
    setIsOpenFilter(value);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    api
      .listHallVisits({
        congressId,
        hallId: hallId === ALL_HALLS_VALUE ? undefined : hallId,
        isOpen: isOpenFilter === 'all' ? undefined : isOpenFilter === 'open',
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
          setLastUpdatedAt(new Date());
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Aynı hata mesajını tekrar tekrar set etmiyoruz (fonksiyonel
          // güncelleme + aynı string referansı) — böylece her 5 sn'lik
          // interval hatası UI'ı gereksiz yere yeniden render etmez.
          setError((previous) => previous ?? 'Ziyaret kayıtları alınamadı.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [congressId, hallId, isOpenFilter, search, page, refreshTick]);

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data],
  );

  // İlk yükleme hiç başarılı olmadıysa (data === null) tabloyu değil,
  // engelleyici bir hata durumu göster.
  if (data === null && error) {
    return (
      <ErrorState
        title="Ziyaret kayıtları yüklenemedi."
        description={error}
        action={
          <button type="button" onClick={() => setRefreshTick((tick) => tick + 1)}>
            Yeniden dene
          </button>
        }
      />
    );
  }

  return (
    <div className="tp-table-card">
      {error && data !== null && (
        <div className="tp-stale-banner" role="status">
          Veriler güncellenemedi
          {lastUpdatedAt && ` · son başarılı güncelleme: ${formatDateTime(lastUpdatedAt.toISOString())}`}
        </div>
      )}

      <div className="tp-filters">
        <Select value={hallId} onValueChange={handleHallChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_HALLS_VALUE}>Tüm salonlar</SelectItem>
            {halls.map((hall) => (
              <SelectItem key={hall.hallId} value={hall.hallId}>
                {hall.hallName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={isOpenFilter}
          onValueChange={(value) => handleIsOpenChange(value as typeof isOpenFilter)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="open">Şu an içeride</SelectItem>
            <SelectItem value="closed">Çıkış yaptı</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="text"
          placeholder="Katılımcı adı ara…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      <table className="tp-table">
        <thead>
          <tr>
            <th>Katılımcı</th>
            <th>Salon</th>
            <th>Giriş</th>
            <th>Süre</th>
            <th>Güven</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((visit) => (
            <tr key={visit.id}>
              <td>
                {visit.userFirstName} {visit.userLastName}
              </td>
              <td>
                <span
                  className="tp-hall-tag"
                  style={{ ['--tag-color' as string]: getHallColor(visit.hallId) }}
                >
                  {visit.hallName}
                </span>
              </td>
              <td>{formatDateTime(visit.startedAt)}</td>
              <td>{formatDuration(visit.startedAt, visit.endedAt)}</td>
              <td>
                {formatConfidence(visit.confidenceLevel, visit.confidenceScore)}
              </td>
              <td>
                <StatusBadge tone={visit.isOpen ? 'positive' : 'neutral'}>
                  {visit.isOpen ? 'içeride' : 'çıktı'}
                </StatusBadge>
              </td>
            </tr>
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--tp-text-dim)' }}>
                Kayıt bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="tp-pagination">
        <span>
          {data ? `${data.total} kayıt` : 'yükleniyor…'} · sayfa {page}/{totalPages}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Önceki
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
