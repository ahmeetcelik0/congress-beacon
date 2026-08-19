'use client';

import { useEffect, useState } from 'react';
import { api, type UnmatchedNameGroup } from '@/lib/api';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { EmptyState } from '@/components/ui/empty-state';
import { ROLE_TYPE_LABELS } from '../role-status';
import './matches.css';

function occurrenceLabel(occurrence: UnmatchedNameGroup['occurrences'][number]): string {
  if (occurrence.presentationTitle) {
    return `${ROLE_TYPE_LABELS[occurrence.type]} · ${occurrence.presentationTitle}${
      occurrence.sessionTitle ? ` — ${occurrence.sessionTitle}` : ''
    }`;
  }
  return `${ROLE_TYPE_LABELS[occurrence.type]} · ${occurrence.sessionTitle ?? '—'}`;
}

/**
 * Faz 4c §4 — onay sonrası görünürlük raporu. Bu isimler için `User` kaydı
 * OTOMATİK OLUŞTURULMAZ (bkz. görev tanımı): e-posta yoksa giriş yapamaz,
 * kongre kaydı olmaz, ve Faz 2'nin gerçek katılımcı listesiyle ÇAKIŞIP
 * belirsiz eşleşme üretebilir. Katılımcı sonradan panelden elle eklenirse
 * yukarıdaki "Yeniden Eşleştir" butonu (`MatchesTable`) bu isimleri otomatik
 * yeniden eşleştirir — burada YENİ bir eşleştirme mekanizması YOK, yalnızca
 * mevcut `matchStatus: UNMATCHED` rollerin isim bazlı gruplanmış görünümü.
 */
export function UnmatchedNamesPanel({ congressId }: { congressId: string }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<UnmatchedNameGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelId = 'unmatched-names-panel-body';

  useEffect(() => {
    let cancelled = false;
    api
      .getUnmatchedProgramRoleNames(congressId)
      .then((result) => {
        if (!cancelled) {
          setGroups(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Eşleşmeyen isim listesi alınamadı.');
      });
    return () => {
      cancelled = true;
    };
  }, [congressId]);

  return (
    <section className="matches-unmatched-panel" aria-labelledby="unmatched-names-heading">
      <button
        type="button"
        className="matches-unmatched-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span id="unmatched-names-heading">
          Eşleşmeyen İsimler{groups && groups.length > 0 ? ` (${groups.length})` : ''}
        </span>
        <span className="matches-unmatched-chevron" data-open={open} aria-hidden="true" />
      </button>

      <CollapsibleRegion id={panelId} open={open} innerClassName="matches-unmatched-body">
        <p className="matches-unmatched-hint">
          Bu isimler için katılımcı kaydı otomatik oluşturulmaz — e-postası olmadığından giriş
          yapamaz ve gerçek katılımcı listesiyle çakışıp belirsiz eşleşme üretebilir. Katılımcıyı
          panelden elle ekledikten sonra yukarıdaki &quot;Yeniden Eşleştir&quot; butonu bu
          isimleri otomatik yeniden eşleştirir.
        </p>

        {error && (
          <p className="panel-error" role="alert">
            {error}
          </p>
        )}

        {groups && groups.length === 0 && !error && (
          <EmptyState title="Eşleşmeyen isim yok." />
        )}

        {groups && groups.length > 0 && (
          <ul className="matches-unmatched-list">
            {groups.map((group) => (
              <li key={group.searchName}>
                <strong>{group.rawName}</strong>
                <ul className="matches-unmatched-occurrences">
                  {group.occurrences.map((occurrence) => (
                    <li key={occurrence.roleId}>{occurrenceLabel(occurrence)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleRegion>
    </section>
  );
}
