'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createCongressAction, type FormState } from './actions';
import './congress-form.css';

const initialState: FormState = { error: null, success: false };

export function CongressForm() {
  const [state, formAction, pending] = useActionState(createCongressAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [startDateValue, setStartDateValue] = React.useState('');
  const [showSuccess, setShowSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!state.success) return;

    // DOM mutasyonu (form reset) doğrudan yapılabilir; ancak setState'i effect
    // gövdesinde SENKRON çağırmak basamaklı render'lara yol açtığı için
    // (react-hooks/set-state-in-effect) bir zamanlayıcı callback'ine
    // taşınıyor — aynı desen `freshness.tsx`de de kullanılıyor.
    formRef.current?.reset();
    const bootstrap = setTimeout(() => {
      setStartDateValue('');
      setShowSuccess(true);
    }, 0);
    const hideTimer = setTimeout(() => setShowSuccess(false), 4000);
    return () => {
      clearTimeout(bootstrap);
      clearTimeout(hideTimer);
    };
  }, [state]);

  return (
    <section className="congress-create-section" aria-labelledby="congress-create-heading">
      <h2 id="congress-create-heading">Yeni kongre oluştur</h2>

      <form ref={formRef} action={formAction} className="congress-form">
        <div className="congress-form-grid">
          <label>
            Kongre adı
            <span className="congress-form-required" aria-hidden="true">
              {' '}
              *
            </span>
            <input type="text" name="name" required minLength={2} autoComplete="off" />
          </label>
          <label>
            Kongre kodu
            <span className="congress-form-required" aria-hidden="true">
              {' '}
              *
            </span>
            <input
              type="text"
              name="code"
              required
              minLength={2}
              placeholder="MEDCON2026"
              autoComplete="off"
            />
          </label>
          <label>
            Pilot erişim kodu
            <span className="congress-form-required" aria-hidden="true">
              {' '}
              *
            </span>
            <input type="text" name="accessCode" required minLength={4} autoComplete="off" />
          </label>
          <label>
            Beacon UUID
            <span className="congress-form-required" aria-hidden="true">
              {' '}
              *
            </span>
            <input
              type="text"
              name="beaconUuid"
              required
              placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
              autoComplete="off"
            />
          </label>
          <label>
            Başlangıç tarihi <span className="congress-form-optional">(opsiyonel)</span>
            <input
              type="date"
              name="startDate"
              onChange={(event) => setStartDateValue(event.target.value)}
            />
          </label>
          <label>
            Bitiş tarihi <span className="congress-form-optional">(opsiyonel)</span>
            <input type="date" name="endDate" min={startDateValue || undefined} />
          </label>
        </div>

        <div className="congress-form-footer">
          <p className="congress-form-hint">* zorunlu alan</p>
          <button type="submit" disabled={pending}>
            {pending ? 'Oluşturuluyor…' : 'Kongre oluştur'}
          </button>
        </div>

        {state.error && (
          <p className="congress-form-error" role="alert">
            {state.error}
          </p>
        )}
        {showSuccess && !state.error && (
          <p className="congress-form-success" role="status">
            Kongre başarıyla oluşturuldu.
          </p>
        )}
      </form>
    </section>
  );
}
