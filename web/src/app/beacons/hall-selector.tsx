'use client';

import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    <Select
      value={selectedId ?? ''}
      onValueChange={(value) => router.push(`/beacons?congressId=${congressId}&hallId=${value}`)}
    >
      <SelectTrigger className="panel-select">
        <SelectValue placeholder="Eşleştirme için salon seçin" />
      </SelectTrigger>
      <SelectContent>
        {halls.map((hall) => (
          <SelectItem key={hall.id} value={hall.id}>
            {hall.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
