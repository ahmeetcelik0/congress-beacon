import type { SponsorTier } from '@/lib/api';
import type { StatusTone } from '@/components/ui/status-badge';

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  PLATINUM: 'Platin',
  GOLD: 'Altın',
  SILVER: 'Gümüş',
  BRONZE: 'Bronz',
  SUPPORTER: 'Destekçi',
};

// `StatusBadge`in tonlari (positive/warning/critical/info/neutral) burada
// gercek bir "durum" DEGIL, kademe onceligini gorsel olarak ayirt etmek icin
// odunc alinir - `registrations-table.tsx`daki `SOURCE_TONES` (API/IMPORT/
// MANUAL/PILOT) ile AYNI, daha once denenmis desen.
export const SPONSOR_TIER_TONES: Record<SponsorTier, StatusTone> = {
  PLATINUM: 'info',
  GOLD: 'warning',
  SILVER: 'neutral',
  BRONZE: 'neutral',
  SUPPORTER: 'neutral',
};
