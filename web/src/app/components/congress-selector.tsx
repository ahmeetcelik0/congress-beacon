'use client';

import { useRouter } from 'next/navigation';

export function CongressSelector({
  congresses,
  selectedId,
  basePath,
  className = 'panel-select',
}: {
  congresses: { id: string; name: string }[];
  selectedId?: string;
  basePath: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <select
      className={className}
      value={selectedId ?? ''}
      onChange={(event) => router.push(`${basePath}?congressId=${event.target.value}`)}
    >
      <option value="" disabled>
        Kongre seçin
      </option>
      {congresses.map((congress) => (
        <option key={congress.id} value={congress.id}>
          {congress.name}
        </option>
      ))}
    </select>
  );
}
