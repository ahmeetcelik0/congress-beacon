'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { createBeaconAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function BeaconForm({
  congressId,
  congressBeaconUuid,
}: {
  congressId: string;
  congressBeaconUuid: string;
}) {
  const [state, formAction, pending] = useActionState(createBeaconAction, initialState);
  const [uuid, setUuid] = React.useState(congressBeaconUuid);
  // Kongrenin beaconUuid'i henüz boşsa (ilk beacon) uyarı gösterilmez — o
  // durumda bu beacon'un UUID'si otomatik benimsenir (bkz. backend
  // `beacon.service.ts`). Karşılaştırma büyük/küçük harf duyarsız.
  const mismatch =
    congressBeaconUuid.length > 0 && uuid.trim().length > 0 &&
    uuid.trim().toUpperCase() !== congressBeaconUuid.toUpperCase();

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="congressId" value={congressId} />
      <label>
        Beacon UUID
        <input
          type="text"
          name="uuid"
          required
          placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
          value={uuid}
          onChange={(event) => setUuid(event.target.value)}
        />
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
      {mismatch && (
        <p className="panel-warning">
          Bu UUID kongrenin beacon UUID&apos;siyle ({congressBeaconUuid}) eşleşmiyor. Kaydetmeye
          çalışırsanız reddedilir.
        </p>
      )}
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
