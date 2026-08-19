import type { Congress } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CongressStatusInfo } from '@/lib/congress-status';
import { CongressCardFooter } from './congress-card-footer';
import './congress-card.css';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Tek bir kongrenin kart görünümü. Salon/beacon SAYISI kasıtlı olarak
 * gösterilmiyor: `api.listHalls`/`api.listBeacons` yalnızca `congressId`
 * zorunlu parametresiyle çağrılabiliyor, kongre başına ayrı bir sayım
 * endpoint'i yok — N kongre için 2N ek isteğe (N+1) yol açmadan bu sayıyı
 * göstermenin ucuz bir yolu bulunmadı. Bkz. proje teslim raporu.
 */
export function CongressCard({
  congress,
  status,
}: {
  congress: Congress;
  status: CongressStatusInfo;
}) {
  return (
    <article className="congress-card" aria-label={`${congress.name} kongresi`}>
      <div className="congress-card-header">
        <h3 className="congress-card-title" title={congress.name}>
          {congress.name}
        </h3>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      <p className="congress-card-code">
        Kod: <span>{congress.code}</span>
      </p>

      <dl className="congress-card-dates">
        <div>
          <dt>Başlangıç</dt>
          <dd>{formatDate(congress.startDate)}</dd>
        </div>
        <div>
          <dt>Bitiş</dt>
          <dd>{formatDate(congress.endDate)}</dd>
        </div>
        <div>
          <dt>Oluşturulma</dt>
          <dd>{formatDate(congress.createdAt)}</dd>
        </div>
      </dl>

      <CongressCardFooter congress={congress} />
    </article>
  );
}
