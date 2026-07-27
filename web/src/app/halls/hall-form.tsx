'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createHallAction, type FormState } from './actions';
import './hall-form.css';

const initialState: FormState = { error: null, success: false };

export function HallForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createHallAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!state.success) return;

    // Form reset'i DOM mutasyonu olarak dogrudan yapilabilir; setState'i
    // effect govdesinde senkron cagirmak basamakli render'lara yol actigi
    // icin bir zamanlayici callback'ine tasindi (ayni desen: congress-form.tsx).
    formRef.current?.reset();
    const bootstrap = setTimeout(() => setShowSuccess(true), 0);
    const hideTimer = setTimeout(() => setShowSuccess(false), 4000);
    return () => {
      clearTimeout(bootstrap);
      clearTimeout(hideTimer);
    };
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel-form hall-create-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Salon adı
        <input type="text" name="name" required minLength={2} autoComplete="off" />
      </label>
      <label>
        RSSI eşiği (dBm)
        <input type="number" name="rssiThreshold" min={-100} max={0} placeholder="-70" />
      </label>
      <label className="hall-form-capacity-field">
        Salon kapasitesi
        <span className="hall-form-required" aria-hidden="true">
          {' '}
          *
        </span>
        <span className="hall-form-capacity-input-group">
          <input
            type="number"
            name="capacity"
            required
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="örn. 250"
            aria-describedby="hall-capacity-hint"
          />
          <span className="hall-form-capacity-unit">kişi</span>
        </span>
        <span id="hall-capacity-hint" className="hall-form-hint">
          Bu değer Canlı Takip ekranındaki doluluk oranını hesaplamak için kullanılacaktır.
        </span>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor...' : 'Salon oluştur'}
      </button>
      {state.error && (
        <p className="panel-error" role="alert">
          {state.error}
        </p>
      )}
      {showSuccess && !state.error && (
        <p className="hall-form-success" role="status">
          Salon başarıyla oluşturuldu.
        </p>
      )}
    </form>
  );
}
