'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { api, type HallVisitSummary } from '@/lib/api';
import {
  calculateOccupancy,
  describeRosterCoverage,
  getOccupancyStatus,
  hasMoreRoster,
  mergeRosterPage,
  DEFAULT_ROSTER_PAGE_SIZE,
  type MergedHallOccupancy,
} from '@/lib/hall-occupancy';
import { getHallColor } from '@/lib/hall-colors';
import { StatusBadge } from '@/components/ui/status-badge';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { OccupancyRadialChart } from './occupancy-radial-chart';
import { HallParticipantList } from './hall-participant-list';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform var(--transition-fast)',
      }}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Tek bir salonun canlı takip kartı. Bilgi hiyerarşisi: 1) salon adı,
 * 2) anlık/kapasite, 3) radial grafik + yüzde, 4) yoğunluk durum etiketi,
 * 5) katılımcı listesi expand/collapse kontrolü.
 *
 * Kendi API isteği YAPMAZ — `hall` (birleştirilmiş doluluk+kapasite) ve
 * `visits` (o salonun roster'ı) üst bileşenden (`HallOccupancyGrid`) props
 * ile gelir; polling TEK yerde (üst seviyede) yapılır.
 */
export function HallOccupancyCard({
  congressId,
  hall,
  visits,
  now,
}: {
  congressId: string;
  hall: MergedHallOccupancy;
  visits: HallVisitSummary[];
  now: number | null;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const color = getHallColor(hall.hallId);
  const occupancy = calculateOccupancy(hall.count, hall.capacity);
  const status = getOccupancyStatus(occupancy);

  // `visits` (props) kongre geneli tek bir istekten (bkz. live-dashboard.tsx
  // ROSTER_PAGE_SIZE bütçesi) bu salona göre FİLTRELENMİŞ alt kümedir — bu
  // yüzden yüklenen satır sayısı `hall.count` (gerçek toplam,
  // `/attendance/summary`'den) kadar OLMAYABİLİR. `rosterExtra`, kullanıcı
  // "Daha fazla göster"e bastıktan SONRA bu salona ÖZEL (`hallId` filtreli)
  // sayfalarla doldurulan ek/otoriter listedir; dolduğunda üst bileşenin
  // (canlı polling'in) gönderdiği kısmi listenin YERİNİ alır. Kart
  // kapatılıp yeniden açıldığında en güncel canlı özet görülsün diye bu
  // ek durum sıfırlanır (bkz. `handleToggle`).
  const [rosterExtra, setRosterExtra] = useState<HallVisitSummary[] | null>(null);
  const [rosterPage, setRosterPage] = useState(0);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const effectiveVisits = rosterExtra ?? visits;
  const rosterIncomplete = hasMoreRoster(effectiveVisits.length, hall.count);

  function handleToggle() {
    setOpen((value) => {
      const next = !value;
      if (!next) {
        // Kapatılırken önceki "Daha fazla göster" ilerlemesi sıfırlanır —
        // yeniden açıldığında kullanıcı her zaman en güncel canlı özeti
        // görür (bkz. yukarıdaki yorum).
        setRosterExtra(null);
        setRosterPage(0);
        setRosterError(null);
      }
      return next;
    });
  }

  async function loadMoreRoster() {
    setRosterLoading(true);
    setRosterError(null);
    const nextPage = rosterPage + 1;
    try {
      const result = await api.listHallVisits({
        congressId,
        hallId: hall.hallId,
        isOpen: true,
        page: nextPage,
        pageSize: DEFAULT_ROSTER_PAGE_SIZE,
      });
      setRosterExtra((current) => mergeRosterPage(current ?? [], result.items));
      setRosterPage(nextPage);
    } catch {
      setRosterError('Katılımcı listesi yüklenemedi.');
    } finally {
      setRosterLoading(false);
    }
  }

  return (
    <div className="tp-occupancy-card" style={{ ['--hall-color' as string]: color }}>
      <div className="tp-occupancy-card-header">
        <span
          className={`tp-hall-pulse ${hall.count > 0 ? 'tp-active' : ''}`}
          aria-hidden="true"
        />
        <h3 className="tp-occupancy-name" title={hall.hallName}>
          {hall.hallName}
        </h3>
      </div>

      <div className="tp-occupancy-body">
        {occupancy.kind === 'ok' ? (
          <OccupancyRadialChart
            chartPercentage={occupancy.chartPercentage}
            displayPercentage={occupancy.displayPercentage}
            color={color}
            accessibleLabel={`${hall.hallName}: ${occupancy.count} kişi, ${occupancy.capacity} kişilik kapasite, yüzde ${occupancy.displayPercentage} doluluk, ${status.label}.`}
          />
        ) : (
          <div
            className="tp-occupancy-no-chart"
            role="img"
            aria-label={`${hall.hallName}: ${occupancy.count} kişi, kapasite tanımlanmadı.`}
          >
            <span aria-hidden="true">—</span>
          </div>
        )}

        <div className="tp-occupancy-figures">
          <div className="tp-occupancy-count">
            <span className="tp-occupancy-count-value">{hall.count}</span>
            <span className="tp-occupancy-count-unit">kişi</span>
          </div>
          {occupancy.kind === 'ok' && (
            <span className="tp-occupancy-capacity-hint">/ {occupancy.capacity} kapasite</span>
          )}
        </div>
      </div>

      <div className="tp-occupancy-status-row">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        {occupancy.kind === 'ok' && occupancy.isOverCapacity && (
          <span className="tp-occupancy-overflow">+{occupancy.overflowCount} kişi</span>
        )}
        {occupancy.kind !== 'ok' && (
          <Link
            href={`/halls?congressId=${encodeURIComponent(congressId)}`}
            className="tp-occupancy-capacity-link"
          >
            Kapasite ekle
          </Link>
        )}
      </div>

      <button
        type="button"
        className="tp-occupancy-expand"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={handleToggle}
      >
        <ChevronIcon open={open} />
        {/* Etiket her zaman GERÇEK toplamı (hall.count, /attendance/summary'den)
            gösterir — yüklenen/kırpılmış dizi uzunluğunu DEĞİL. */}
        {open ? 'Katılımcıları gizle' : `Katılımcıları göster (${hall.count})`}
      </button>

      <CollapsibleRegion id={contentId} open={open}>
        <div className="tp-occupancy-collapsible-inner">
          <HallParticipantList visits={effectiveVisits} totalCount={hall.count} now={now} />

          {rosterIncomplete && (
            <div className="tp-roster-more">
              <p className="tp-roster-coverage" role="status" aria-live="polite">
                {describeRosterCoverage(effectiveVisits.length, hall.count)}
              </p>

              {rosterError && <p className="tp-roster-error">{rosterError}</p>}

              <button
                type="button"
                className="tp-roster-more-button"
                disabled={rosterLoading}
                onClick={loadMoreRoster}
              >
                {rosterLoading ? 'Yükleniyor…' : rosterError ? 'Yeniden dene' : 'Daha fazla göster'}
              </button>
            </div>
          )}
        </div>
      </CollapsibleRegion>
    </div>
  );
}
