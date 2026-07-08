'use client';

import { useActionState } from 'react';
import { assignAction, unassignAction, type FormState } from './actions';

const initialState: FormState = { error: null };

export function AssignToggle({
  hallId,
  beaconId,
  isAssigned,
}: {
  hallId: string;
  beaconId: string;
  isAssigned: boolean;
}) {
  const boundAction = (isAssigned ? unassignAction : assignAction).bind(null, hallId, beaconId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {isAssigned ? 'Kaldır' : 'Bu salona ata'}
      </button>
      {state.error && <p className="panel-error">{state.error}</p>}
    </form>
  );
}
