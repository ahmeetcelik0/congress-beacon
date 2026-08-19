'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { createJsonProgramImportAction } from './actions';
import './imports.css';

// PDF/Excel'in 32 MB'lik LLM istek siniriyla KARISTIRILMASIN diye ayri bir
// sabit - JSON metin dosyalari icin cok cok daha kucuk bir ust sinir yeterli,
// kesin dogrulama HER ZAMAN backend'de tekrar yapilir.
const MAX_JSON_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Faz 4c §2 — hazır bir ExtractionResult JSON dosyasını LLM adımını atlayarak
 * doğrudan aynı staging hattına (`writeExtractionToStaging`) yazan ikinci
 * giriş noktası. `ProgramImportPanel`in (PDF/Excel) İKİ AŞAMALI akışının
 * (tahmin → onay → yükle) aksine burada tahmin adımı YOK — LLM çağrısı hiç
 * olmadığı için ücretsiz ve senkron, tek adımda yüklenir.
 */
export function JsonProgramImportPanel({ congressId }: { congressId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[] | null>(null);
  const [templateError, setTemplateError] = React.useState<string | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  const [templatePending, startTemplateTransition] = useTransition();
  const panelId = 'json-import-panel-body';

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
    setFieldErrors(null);
    if (selected && selected.size > MAX_JSON_FILE_SIZE_BYTES) {
      setError('Dosya çok büyük (en fazla 5 MB olmalı).');
    }
  }

  function handleUpload() {
    if (!file) return;
    setError(null);
    setFieldErrors(null);
    startUploadTransition(async () => {
      const result = await createJsonProgramImportAction(congressId, file);
      if (result.error) {
        setError(result.error);
        setFieldErrors(result.errors);
        return;
      }
      router.push(`/sessions/imports/${result.importId}?congressId=${congressId}`);
    });
  }

  function handleReset() {
    setFile(null);
    setError(null);
    setFieldErrors(null);
    setFileInputKey((key) => key + 1);
  }

  function handleDownloadTemplate() {
    setTemplateError(null);
    startTemplateTransition(async () => {
      try {
        const template = await api.getProgramImportJsonTemplate();
        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'program-sablonu.json';
        link.click();
        URL.revokeObjectURL(url);
      } catch {
        setTemplateError('Örnek dosya indirilemedi.');
      }
    });
  }

  const canUpload = !!file && !error && !uploadPending;

  return (
    <section className="imports-panel-section" aria-labelledby="json-import-panel-heading">
      <div className="imports-panel-toolbar">
        <button
          type="button"
          className="imports-panel-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span id="json-import-panel-heading">JSON Yükle (ücretsiz)</span>
          <span className="imports-panel-chevron" data-open={open} aria-hidden="true" />
        </button>
      </div>

      <CollapsibleRegion id={panelId} open={open} innerClassName="imports-panel-body">
        <p className="imports-panel-hint">
          PDF/Excel yapay zeka ile işlenir ve Anthropic kredisi harcar; hazır bir JSON dosyası
          (aynı staging/önizleme/onay akışından geçer) yapay zeka adımını atlar — ÜCRETSİZ ve
          anında işlenir.
        </p>

        <button
          type="button"
          className="imports-upload-secondary"
          onClick={handleDownloadTemplate}
          disabled={templatePending}
        >
          {templatePending ? 'İndiriliyor…' : 'Örnek JSON indir'}
        </button>
        {templateError && (
          <p className="panel-error" role="alert">
            {templateError}
          </p>
        )}

        <details className="imports-schema-summary">
          <summary>JSON şeması hakkında</summary>
          <p>
            Program <strong>gün → salon → etkinlik → öğe</strong> hiyerarşisinde olmalı. Zorunlu
            alanlar: kongre adı ve başlangıç tarihi; her günün kendi tarihi; her salonun adı; her
            etkinliğin başlangıç/bitiş saati, türü (<code>session</code>/<code>break</code>/
            <code>ceremony</code>/<code>live_case</code>/<code>other</code>) ve başlığı; her
            öğenin türü (<code>presentation</code>/<code>discussion</code>) ve başlığı.
          </p>
          <p>
            Opsiyonel alanlar: gün etiketi, salonun İngilizce adı, etkinliğin İngilizce başlığı /
            serisi / anahtar kelimeleri / oturum başkanları (<code>chairs</code>) / panelistleri (
            <code>panelists</code>), öğenin saatleri / bildiri kodu / konuşmacıları. Yazılmayan
            opsiyonel alanlar boş kabul edilir — hata vermez.
          </p>
        </details>

        <div className="imports-upload-row">
          <label className="imports-upload-label">
            Dosya seç
            <input
              key={fileInputKey}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              disabled={uploadPending}
            />
          </label>
          <button type="button" onClick={handleUpload} disabled={!canUpload}>
            {uploadPending ? 'Yükleniyor…' : 'Yükle'}
          </button>
          {file && (
            <button
              type="button"
              className="imports-upload-secondary"
              onClick={handleReset}
              disabled={uploadPending}
            >
              Vazgeç
            </button>
          )}
        </div>

        {error && (
          <p className="panel-error" role="alert">
            {error}
          </p>
        )}
        {fieldErrors && fieldErrors.length > 0 && (
          <ul className="import-warning-text" role="alert">
            {fieldErrors.map((message) => (
              <li key={message} className="import-warning-item">
                {message}
              </li>
            ))}
          </ul>
        )}
      </CollapsibleRegion>
    </section>
  );
}
