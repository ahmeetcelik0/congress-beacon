'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <Select
      value={selectedId ?? ''}
      onValueChange={(value) => router.push(`${basePath}?congressId=${value}`)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Kongre seçin" />
      </SelectTrigger>
      <SelectContent>
        {congresses.map((congress) => (
          <SelectItem key={congress.id} value={congress.id}>
            {congress.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
