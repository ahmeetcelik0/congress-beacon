'use client';

import * as React from 'react';
import { api, ApiError, type UploadPurpose } from '@/lib/api';
import './image-upload-field.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Kongre içerik yönetiminde (kapak görseli, mekan/sponsor/konuşmacı görseli)
 * tekrar eden görsel yükleme alanı. Sürükle-bırak YOK, düz `<input type=file>`
 * yeterli (bkz. görev tanımı).
 *
 * Yükleme backend'e (NestJS) DOĞRUDAN tarayıcıdan yapılır — bir Next.js
 * Server Action ÜZERİNDEN DEĞİL: Server Action istekleri varsayılan olarak
 * 1MB ile sınırlıdır (bkz. Next.js "Server Actions and Mutations" rehberi,
 * `serverActions.bodySizeLimit`) ve 2MB'a kadar izin verilen görseller bu
 * sınırı aşabilir. `api.uploadFile` zaten hem sunucu hem tarayıcı tarafında
 * çalışacak şekilde yazılmış (`getAdminToken()` tarayıcıda çerezden okur,
 * bkz. `registrations-table.tsx`'in `api.listRegistrations` çağrısıyla aynı
 * desen) — bu yüzden burada da doğrudan çağrılır.
 *
 * `name` alanı bir gizli `<input>` üzerinden dış `<form>`a taşınır ki üst
 * form normal `FormData` akışıyla (submit anında) gönderilen URL'i okuyabilsin.
 * Boş string (`''`), üst form için "mevcut görseli kaldır" anlamına gelir —
 * `updateRegistration` PATCH kısmi semantiğiyle birebir aynı kural.
 */
export function ImageUploadField({
  label,
  name,
  congressId,
  purpose,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  congressId: string;
  purpose: UploadPurpose;
  defaultValue?: string | null;
  hint?: string;
}) {
  const [url, setUrl] = React.useState(defaultValue ?? '');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    try {
      const result = await api.uploadFile(congressId, file, purpose);
      setUrl(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof ApiError ? uploadError.message : 'Görsel yüklenemedi.');
    } finally {
      setPending(false);
      // Aynı dosyayı tekrar seçebilmek için (ör. hata sonrası yeniden deneme)
      // input değerini sıfırla — tarayıcı aynı dosya adında `onChange`
      // tetiklemez.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemove() {
    setUrl('');
    setError(null);
  }

  const previewSrc = url ? `${API_URL}${url}` : null;

  return (
    <div className="ui-image-upload-field">
      <input type="hidden" name={name} value={url} />
      <label htmlFor={inputId} className="ui-image-upload-field-label">
        {label}
      </label>

      <div className="ui-image-upload-field-row">
        {previewSrc ? (
          // Backend'den gelen, boyutu bilinmeyen kullanıcı görseli — `next/image`
          // yerine düz `<img>` (bkz. `next.config` içinde uzak görsel domaini
          // tanımlı değil, panel içi diğer önizlemeler de aynı yaklaşımı izler).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt="" className="ui-image-upload-field-preview" />
        ) : (
          <div className="ui-image-upload-field-placeholder" aria-hidden="true">
            Görsel yok
          </div>
        )}

        <div className="ui-image-upload-field-controls">
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={pending}
            aria-describedby={hint ? `${inputId}-hint` : undefined}
          />
          {pending && (
            <span className="ui-image-upload-field-status" role="status">
              Yükleniyor…
            </span>
          )}
          {!pending && url && (
            <button type="button" onClick={handleRemove} className="ui-image-upload-field-remove">
              Mevcut görseli kaldır
            </button>
          )}
        </div>
      </div>

      {hint && (
        <span id={`${inputId}-hint`} className="ui-image-upload-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <p className="ui-image-upload-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
