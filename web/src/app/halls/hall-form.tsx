'use client';

import { useActionState } from 'react';
import { createHallAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function HallForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createHallAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Salon adı
        <input type="text" name="name" required minLength={2} />
      </label>
      <label>
        RSSI eşiği (dBm)
        <input type="number" name="rssiThreshold" min={-100} max={0} placeholder="-70" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor...' : 'Salon oluştur'}
      </button>
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
