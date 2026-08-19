'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createRegistrationAction, type FormState } from './actions';

const initialState: FormState = { error: null, success: false };

/**
 * Manuel katılımcı ekleme formu. `HallForm`/`CongressForm` ile aynı desen:
 * `useActionState` + başarıda form reset + geçici başarı mesajı. Farkı:
 * başarı halinde `onCreated()` ile ebeveyne (client-fetch'li tabloya) haber
 * verir, böylece yeni eklenen katılımcı listede hemen görünür (tablo kendi
 * verisini sunucudan çeker, `revalidatePath` onu ETKİLEMEZ - bkz.
 * registrations-table.tsx yorumu).
 */
export function RegistrationForm({
  congressId,
  onCreated,
}: {
  congressId: string;
  onCreated: () => void;
}) {
  const [state, formAction, pending] = useActionState(createRegistrationAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!state.success) return;

    // Form reset'i dogrudan DOM mutasyonu olarak yapilabilir; setState'i
    // effect govdesinde senkron cagirmak basamakli render'lara yol actigi
    // icin (react-hooks/set-state-in-effect) bir zamanlayici callback'ine
    // tasindi - ayni desen `hall-form.tsx`/`congress-form.tsx`de de var.
    formRef.current?.reset();
    const bootstrap = setTimeout(() => {
      setShowSuccess(true);
      onCreated();
    }, 0);
    const hideTimer = setTimeout(() => setShowSuccess(false), 4000);
    return () => {
      clearTimeout(bootstrap);
      clearTimeout(hideTimer);
    };
    // onCreated her render'da yeniden olusabilir (parent'ta useCallback ile
    // sarilmamis olabilir) - yalnizca `state` degistiginde tetiklenmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="panel-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Ad
        <input type="text" name="firstName" required minLength={1} autoComplete="off" />
      </label>
      <label>
        Soyad
        <input type="text" name="lastName" required minLength={1} autoComplete="off" />
      </label>
      <label>
        E-posta <span className="reg-form-optional">(en az biri zorunlu)</span>
        <input type="email" name="email" autoComplete="off" placeholder="ornek@eposta.com" />
      </label>
      <label>
        Telefon <span className="reg-form-optional">(en az biri zorunlu)</span>
        <input type="tel" name="phone" autoComplete="off" placeholder="05XX XXX XX XX" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Ekleniyor…' : 'Katılımcı ekle'}
      </button>
      {state.error && (
        <p className="panel-error" role="alert">
          {state.error}
        </p>
      )}
      {showSuccess && !state.error && (
        <p className="reg-form-success" role="status">
          Katılımcı başarıyla eklendi.
        </p>
      )}
    </form>
  );
}
