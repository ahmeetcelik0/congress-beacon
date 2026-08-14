'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ProgramImport, ProgramImportEstimate } from '@/lib/api';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { StatusBadge } from '@/components/ui/status-badge';
import { estimateProgramImportAction, createProgramImportAction } from './actions';
import { IMPORT_STATUS_LABELS, IMPORT_STATUS_TONES } from './status-labels';
import './imports.css';

// Backend `program-imports.controller.ts` ile AYNI ust sinir (Claude'un PDF
// istek siniri) - burada erken uyararak gereksiz bir yukleme denemesi
// onlenir, kesin dogrulama HER ZAMAN backend'de tekrar yapilir.
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024;

function formatUsd(value: number | null): string {
  if (value === null) return 'hesaplanamadı';
  if (value > 0 && value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Bilimsel programı PDF/Excel'den otomatik çıkarmak için iki aşamalı akış:
 * (1) dosya seçilir, PARA HARCAMAYAN bir token/maliyet tahmini istenir,
 * (2) yalnızca kullanıcı bu tahmini görüp AÇIKÇA onayladıktan sonra gerçek
 * yükleme başlar (bkz. görev tanımı — Anthropic kredisi sınırlı). Dosya iki
 * ayrı server action çağrısında (`estimateProgramImportAction`,
 * `createProgramImportAction`) yeniden kullanılabilmesi için tarayıcı
 * state'inde tutulur; `<form>` submit'i KULLANILMAZ çünkü ara adımda kullanıcı
 * onayı beklenir.
 */
export function ProgramImportPanel({
  congressId,
  totalSpendUsd,
  recentImports,
}: {
  congressId: string;
  totalSpendUsd: number;
  recentImports: ProgramImport[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = React.useState(0);
  const [estimate, setEstimate] = React.useState<ProgramImportEstimate | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [estimatePending, startEstimateTransition] = useTransition();
  const [createPending, startCreateTransition] = useTransition();
  const panelId = 'program-import-panel-body';

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setEstimate(null);
    setError(null);
    if (selected && selected.size > MAX_FILE_SIZE_BYTES) {
      setError('Dosya çok büyük (en fazla 32 MB olmalı).');
    }
  }

  function handleEstimate() {
    if (!file) return;
    setError(null);
    startEstimateTransition(async () => {
      const result = await estimateProgramImportAction(congressId, file);
      if (result.error) {
        setError(result.error);
        setEstimate(null);
        return;
      }
      setEstimate(result.estimate);
    });
  }

  function handleConfirm() {
    if (!file || !estimate) return;
    setError(null);
    startCreateTransition(async () => {
      const result = await createProgramImportAction(congressId, file);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/sessions/imports/${result.importId}?congressId=${congressId}`);
    });
  }

  function handleReset() {
    setFile(null);
    setEstimate(null);
    setError(null);
    setFileInputKey((key) => key + 1);
  }

  const pending = estimatePending || createPending;
  const canEstimate = !!file && !error && !pending;
  const canConfirm = !!file && !!estimate && !pending;

  return (
    <section className="imports-panel-section" aria-labelledby="imports-panel-heading">
      <div className="imports-panel-toolbar">
        <button
          type="button"
          className="imports-panel-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span id="imports-panel-heading">Program Dosyası Yükle (PDF/Excel)</span>
          <span className="imports-panel-chevron" data-open={open} aria-hidden="true" />
        </button>
        <span className="imports-panel-spend">
          Bu kongrede program çıkarımı için harcanan: <strong>{formatUsd(totalSpendUsd)}</strong>
        </span>
      </div>

      <CollapsibleRegion id={panelId} open={open} innerClassName="imports-panel-body">
        <p className="imports-panel-hint">
          Bilimsel programı içeren PDF veya Excel dosyasını yükleyin; yapay zeka dosyayı okuyup
          oturum/sunum/konuşmacı taslağı oluşturur. Gerçek çıkarım BAŞLAMADAN önce tahmini
          maliyeti onaylamanız istenir — bu adım ücretsizdir.
        </p>

        <div className="imports-upload-row">
          <label className="imports-upload-label">
            Dosya seç
            <input
              key={fileInputKey}
              type="file"
              accept=".pdf,.xlsx,.xls"
              onChange={handleFileChange}
              disabled={pending}
            />
          </label>
          <button type="button" onClick={handleEstimate} disabled={!canEstimate}>
            {estimatePending ? 'Tahmin ediliyor…' : 'Maliyeti Tahmin Et'}
          </button>
          {(file || estimate) && (
            <button type="button" className="imports-upload-secondary" onClick={handleReset} disabled={pending}>
              Vazgeç
            </button>
          )}
        </div>

        {error && (
          <p className="panel-error" role="alert">
            {error}
          </p>
        )}

        {estimate && (
          <div className="imports-estimate-card" role="status">
            <h3>Tahmin</h3>
            <dl className="imports-estimate-grid">
              <div>
                <dt>Model</dt>
                <dd>{estimate.model}</dd>
              </div>
              {estimate.pageCount !== null && (
                <div>
                  <dt>Sayfa sayısı</dt>
                  <dd>{estimate.pageCount.toLocaleString('tr-TR')}</dd>
                </div>
              )}
              <div>
                <dt>Girdi token</dt>
                <dd>{estimate.inputTokens.toLocaleString('tr-TR')}</dd>
              </div>
              <div>
                <dt>Tahmini çıktı token</dt>
                <dd>{estimate.estimatedOutputTokens.toLocaleString('tr-TR')}</dd>
              </div>
              <div>
                <dt>Tahmini maliyet</dt>
                <dd className="imports-estimate-cost">{formatUsd(estimate.estimatedCostUsd)}</dd>
              </div>
            </dl>
            <p className="imports-estimate-note">
              Bu değerler girdi token sayısına dayalı KABA bir tahmindir, kesin bir taahhüt
              değildir. Devam ederseniz gerçek Anthropic API çağrısı yapılır ve krediniz
              kullanılır.
            </p>
            <div className="imports-estimate-actions">
              <button type="button" className="imports-confirm-button" onClick={handleConfirm} disabled={!canConfirm}>
                {createPending ? 'Başlatılıyor…' : 'Onayla ve Başlat'}
              </button>
            </div>
          </div>
        )}
      </CollapsibleRegion>

      {recentImports.length > 0 && (
        <div className="imports-history">
          <h3 className="imports-history-heading">Program Yüklemeleri</h3>
          <ul className="imports-history-list">
            {recentImports.map((item) => (
              <li key={item.id} className="imports-history-item">
                <Link href={`/sessions/imports/${item.id}?congressId=${congressId}`}>
                  {item.fileName}
                </Link>
                <StatusBadge tone={IMPORT_STATUS_TONES[item.status]}>
                  {IMPORT_STATUS_LABELS[item.status]}
                </StatusBadge>
                <span className="imports-history-cost">
                  {item.sourceType} ·{' '}
                  {item.sourceType === 'JSON' ? 'Ücretsiz' : formatUsd(item.estimatedCostUsd)}
                </span>
                <span className="imports-history-date">{formatDateTime(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
