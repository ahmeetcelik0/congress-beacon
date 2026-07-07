'use client';

import { useRouter } from 'next/navigation';

export function HallSelector({
  halls,
  selectedId,
  congressId,
}: {
  halls: { id: string; name: string }[];
  selectedId?: string;
  congressId: string;
}) {
  const router = useRouter();

  return (
    <select
      className="panel-select"
      value={selectedId ?? ''}
      onChange={(event) =>
        router.push(`/beacons?congressId=${congressId}&hallId=${event.target.value}`)
      }
    >
      <option value="" disabled>
        Eşleştirme için salon seçin
      </option>
      {halls.map((hall) => (
        <option key={hall.id} value={hall.id}>
          {hall.name}
        </option>
      ))}
    </select>
  );
}
