'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  api,
  type CongressRegistrationListItem,
  type CongressRegistrationPage,
  type RegistrationSource,
} from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { ErrorState } from '@/components/ui/error-state';
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import {
  deactivateRegistrationAction,
  reactivateRegistrationAction,
  updateRegistrationAction,
  type RowFormState,
} from './actions';
import './registrations.css';

const PAGE_SIZE = 20;
const ALL_VALUE = 'all';

const SOURCE_LABELS: Record<RegistrationSource, string> = {
  API: 'Dernek API',
  IMPORT: 'İçe Aktarma',
  MANUAL: 'Manuel',
  PILOT: 'Pilot',
};

const SOURCE_TONES: Record<RegistrationSource, StatusTone> = {
  API: 'info',
  IMPORT: 'info',
  MANUAL: 'neutral',
  PILOT: 'neutral',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const emptyRowState: RowFormState = { error: null, saved: false };

function RegistrationRow({
  item,
  onChanged,
  onRequestDeactivate,
}: {
  item: CongressRegistrationListItem;
  onChanged: () => void;
  onRequestDeactivate: (item: CongressRegistrationListItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = useMemo(
    () => updateRegistrationAction.bind(null, item.registrationId),
    [item.registrationId],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, emptyRowState);
  const [reactivatePending, startReactivateTransition] = useTransition();
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (!state.saved) return;
    // `onChanged` cagirisi tabloya yeni satiri getirmesi icin gerekli bir
    // setState tetikler - senkron cagriyi effect govdesinden ayirmak icin
    // (react-hooks/set-state-in-effect) zamanlayici callback'i kullanilir.
    const timer = setTimeout(() => {
      setEditing(false);
      onChanged();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Duzenleme moduna girildiginde satirin JSX'i tamamen degisir ve tiklanan
  // "Duzenle" butonu DOM'dan kalkar - odak tarayici tarafindan body'ye
  // duser. Ilk alana ve (cikista) tetikleyici butona ELLE odaklaniyoruz.
  // `wasEditingRef`, ilk mount'ta (editing=false) yanlislikla odak
  // calmasini onlemek icin yalnizca GERCEK true->false gecisinde geri
  // odaklanmayi tetikler.
  useEffect(() => {
    if (editing) {
      firstFieldRef.current?.focus();
      wasEditingRef.current = true;
    } else if (wasEditingRef.current) {
      editTriggerRef.current?.focus();
      wasEditingRef.current = false;
    }
  }, [editing]);

  function handleReactivate() {
    setReactivateError(null);
    startReactivateTransition(async () => {
      const result = await reactivateRegistrationAction(item.registrationId);
      if (result.error) {
        setReactivateError(result.error);
        return;
      }
      onChanged();
    });
  }

  if (editing) {
    return (
      <tr className="reg-row-editing">
        <td colSpan={8} className="reg-edit-cell">
          <form action={formAction} className="reg-edit-form">
            <label>
              Ad
              <input
                ref={firstFieldRef}
                name="firstName"
                defaultValue={item.firstName}
                required
                minLength={1}
              />
            </label>
            <label>
              Soyad
              <input name="lastName" defaultValue={item.lastName} required minLength={1} />
            </label>
            <label>
              E-posta
              <input type="email" name="email" defaultValue={item.email ?? ''} />
            </label>
            <label>
              Telefon
              <input type="tel" name="phone" defaultValue={item.phone ?? item.phoneRaw ?? ''} />
            </label>
            <div className="reg-edit-form-actions">
              <button type="submit" disabled={pending}>
                {pending ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={pending}>
                İptal
              </button>
            </div>
            {state.error && (
              <p className="panel-error" role="alert">
                {state.error}
              </p>
            )}
          </form>
        </td>
      </tr>
    );
  }

  const showPhoneWarning = item.phone === null && item.phoneRaw !== null;

  return (
    <tr>
      <td>
        {item.firstName} {item.lastName}
      </td>
      <td className="reg-contact-cell">
        {item.email && <span>{item.email}</span>}
        {(item.phone || item.phoneRaw) && (
          <span className={showPhoneWarning ? 'reg-phone-unverified' : undefined}>
            {item.phone ?? item.phoneRaw}
            {showPhoneWarning && (
              <span
                title="Telefon numarası standart formata çevrilemedi, ham haliyle gösteriliyor"
                aria-label="Doğrulanmamış telefon numarası"
              >
                {' '}
                ⚠
              </span>
            )}
          </span>
        )}
        {!item.email && !item.phone && !item.phoneRaw && (
          <span className="reg-contact-missing">—</span>
        )}
      </td>
      <td>
        <StatusBadge tone={SOURCE_TONES[item.source]}>{SOURCE_LABELS[item.source]}</StatusBadge>
      </td>
      <td>
        <StatusBadge tone={item.isActive ? 'positive' : 'neutral'}>
          {item.isActive ? 'Aktif' : 'Pasif'}
        </StatusBadge>
      </td>
      <td>{formatDateTime(item.registeredAt)}</td>
      <td>
        <StatusBadge tone={item.hasPassword ? 'positive' : 'warning'}>
          {item.hasPassword ? 'Belirlendi' : 'Belirlenmedi'}
        </StatusBadge>
      </td>
      <td>{formatDateTime(item.lastLoginAt)}</td>
      <td className="reg-row-actions">
        <button type="button" ref={editTriggerRef} onClick={() => setEditing(true)}>
          Düzenle
        </button>
        {item.isActive ? (
          <button type="button" onClick={() => onRequestDeactivate(item)}>
            Pasifleştir
          </button>
        ) : (
          <button type="button" onClick={handleReactivate} disabled={reactivatePending}>
            {reactivatePending ? 'İşleniyor…' : 'Aktifleştir'}
          </button>
        )}
        {reactivateError && (
          <p className="panel-error reg-row-error" role="alert">
            {reactivateError}
          </p>
        )}
      </td>
    </tr>
  );
}

/**
 * Katılımcı listesi: arama/filtre/sayfalama `hall-visits-table.tsx` ile
 * AYNI mimari (client-fetch, debounce'lı arama, hata durumunda eski veriyi
 * KORUYAN uyarı şeridi). Fark: katılımcı verisi "canlı telemetri" olmadığı
 * için 5sn'lik otomatik polling YOK — bunun yerine elle "Yenile" düğmesi ve
 * satır mutasyonlarından (ekleme/düzenleme/pasifleştirme) sonra tetiklenen
 * yeniden çekme var (`refreshSignal` = dışarıdan/ekleme formundan,
 * `internalTick` = bu bileşen içindeki satır aksiyonlarından).
 */
export function RegistrationsTable({
  congressId,
  refreshSignal,
}: {
  congressId: string;
  refreshSignal: number;
}) {
  const [sourceFilter, setSourceFilter] = useState<RegistrationSource | typeof ALL_VALUE>(ALL_VALUE);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CongressRegistrationPage | null>(null);
  // Ilk yukleme hic basarili olmadiysa (data === null) hata ENGELLEYICI
  // (ErrorState tum tabloyu degistirir). Daha once veri geldiyse yalnizca
  // engelleyici olmayan bir uyari seridi gosterilir, veri SILINMEZ.
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [internalTick, setInternalTick] = useState(0);

  const [deactivateTarget, setDeactivateTarget] = useState<CongressRegistrationListItem | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deactivatePending, startDeactivateTransition] = useTransition();

  // Kararli bir referans - satir bilesenlerindeki `useEffect`'in her tablo
  // render'inda YENIDEN tetiklenmesini onler (bkz. RegistrationRow yorumu).
  const bumpInternal = useCallback(() => setInternalTick((tick) => tick + 1), []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function handleSourceChange(value: string) {
    setSourceFilter(value as RegistrationSource | typeof ALL_VALUE);
    setPage(1);
  }

  function handleActiveChange(value: 'all' | 'active' | 'inactive') {
    setActiveFilter(value);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    api
      .listRegistrations({
        congressId,
        search: search || undefined,
        source: sourceFilter === ALL_VALUE ? undefined : sourceFilter,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
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
          setError((previous) => previous ?? 'Katılımcı listesi alınamadı.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [congressId, search, sourceFilter, activeFilter, page, internalTick, refreshSignal]);

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data],
  );

  function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateError(null);
    startDeactivateTransition(async () => {
      const result = await deactivateRegistrationAction(deactivateTarget.registrationId);
      if (result.error) {
        setDeactivateError(result.error);
        return;
      }
      setDeactivateTarget(null);
      bumpInternal();
    });
  }

  function handleCancelDeactivate() {
    if (deactivatePending) return;
    setDeactivateTarget(null);
    setDeactivateError(null);
  }

  if (data === null && error) {
    return (
      <ErrorState
        title="Katılımcı listesi yüklenemedi."
        description={error}
        action={
          <button type="button" onClick={bumpInternal}>
            Yeniden dene
          </button>
        }
      />
    );
  }

  return (
    <div>
      {error && data !== null && (
        <div className="reg-stale-banner" role="status">
          Liste güncellenemedi
          {lastUpdatedAt && ` · son başarılı güncelleme: ${formatDateTime(lastUpdatedAt.toISOString())}`}
        </div>
      )}

      <div className="reg-filters">
        <Select value={sourceFilter} onValueChange={handleSourceChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Tüm kaynaklar</SelectItem>
            {(Object.keys(SOURCE_LABELS) as RegistrationSource[]).map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABELS[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={activeFilter}
          onValueChange={(value) => handleActiveChange(value as typeof activeFilter)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü (aktif + pasif)</SelectItem>
            <SelectItem value="active">Yalnızca aktif</SelectItem>
            <SelectItem value="inactive">Yalnızca pasif</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="text"
          placeholder="Ad, soyad, e-posta veya telefon ara…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <button type="button" onClick={bumpInternal}>
          Yenile
        </button>
      </div>

      <table className="panel-table reg-table">
        <thead>
          <tr>
            <th>Katılımcı</th>
            <th>İletişim</th>
            <th>Kaynak</th>
            <th>Durum</th>
            <th>Kayıt Tarihi</th>
            <th>Şifre</th>
            <th>Son Giriş</th>
            <th>Aksiyonlar</th>
          </tr>
        </thead>
        <tbody>
          {data === null && !error && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                Yükleniyor…
              </td>
            </tr>
          )}
          {data?.items.map((item) => (
            <RegistrationRow
              key={item.registrationId}
              item={item}
              onChanged={bumpInternal}
              onRequestDeactivate={(target) => {
                setDeactivateTarget(target);
                setDeactivateError(null);
              }}
            />
          ))}
          {data && data.items.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                Kayıt bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="reg-pagination">
        <span>
          {data ? `${data.total} kayıt` : 'yükleniyor…'} · sayfa {page}/{totalPages}
        </span>
        <div className="reg-pagination-buttons">
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

      <ConfirmDeleteDialog
        open={deactivateTarget !== null}
        title="Katılımcıyı pasifleştir"
        description={
          deactivateTarget && (
            <>
              <strong>
                {deactivateTarget.firstName} {deactivateTarget.lastName}
              </strong>{' '}
              kongreye giriş yapamayacak şekilde pasifleştirilecek. Kaydı silinmez, istediğiniz zaman
              yeniden aktifleştirebilirsiniz.
            </>
          )
        }
        confirmLabel="Pasifleştir"
        cancelLabel="Vazgeç"
        pending={deactivatePending}
        error={deactivateError}
        onConfirm={handleConfirmDeactivate}
        onCancel={handleCancelDeactivate}
      />
    </div>
  );
}
