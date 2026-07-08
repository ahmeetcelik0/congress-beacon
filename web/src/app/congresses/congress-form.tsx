'use client';

import { useActionState } from 'react';
import { createCongressAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function CongressForm() {
  const [state, formAction, pending] = useActionState(createCongressAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <label>
        Kongre adı
        <input type="text" name="name" required minLength={2} />
      </label>
      <label>
        Kongre kodu
        <input type="text" name="code" required minLength={2} placeholder="MEDCON2026" />
      </label>
      <label>
        Pilot erişim kodu
        <input type="text" name="accessCode" required minLength={4} />
      </label>
      <label>
        Beacon UUID
        <input
          type="text"
          name="beaconUuid"
          required
          placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
        />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor...' : 'Kongre oluştur'}
      </button>
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
