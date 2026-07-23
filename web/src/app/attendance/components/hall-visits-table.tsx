'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type HallVisitSummary } from '@/lib/api';
import { getHallColor } from '@/lib/hall-colors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZE = 10;
const ALL_HALLS_VALUE = 'all';

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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ items: [], total: 0 });
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

  return (
    <div className="tp-table-card">
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
                <span className={`tp-badge ${visit.isOpen ? 'tp-open' : 'tp-closed'}`}>
                  {visit.isOpen ? 'içeride' : 'çıktı'}
                </span>
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
