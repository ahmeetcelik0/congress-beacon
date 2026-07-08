'use client';

import { useActionState } from 'react';
import { createBeaconAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function BeaconForm({ congressId }: { congressId: string }) {
  const [state, formAction, pending] = useActionState(createBeaconAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Beacon UUID
        <input type="text" name="uuid" required placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0" />
      </label>
      <label>
        Major
        <input type="number" name="major" required min={0} max={65535} />
      </label>
      <label>
        Minor
        <input type="number" name="minor" required min={0} max={65535} />
      </label>
      <label>
        Etiket (opsiyonel)
        <input type="text" name="label" />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Oluşturuluyor...' : 'Beacon oluştur'}
      </button>
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
