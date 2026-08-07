import type { ProgramRoleType, RoleMatchStatus } from '@/lib/api';
import type { StatusTone } from '@/components/ui/status-badge';

// Iki kullanim yeri var: bu sayfadaki (`/sessions`) rol rozetleri VE
// `/sessions/matches` eslesme tablosu - ortak sozluk burada TEK yerde tutulur.
export const ROLE_TYPE_LABELS: Record<ProgramRoleType, string> = {
  MODERATOR: 'Moderatör',
  SPEAKER: 'Konuşmacı',
  DISCUSSANT: 'Tartışmacı',
};

export const MATCH_STATUS_LABELS: Record<RoleMatchStatus, string> = {
  MATCHED: 'Eşleşti',
  AMBIGUOUS: 'Belirsiz',
  UNMATCHED: 'Eşleşmedi',
  MANUAL: 'Elle Bağlandı',
  IGNORED: 'Yok Sayıldı',
};

// Gorev tanimindaki eslesme: MATCHED->positive, AMBIGUOUS->warning,
// MANUAL->info, UNMATCHED ve IGNORED->neutral (ikisi de gri, etiket
// metniyle ayirt edilir).
export const MATCH_STATUS_TONES: Record<RoleMatchStatus, StatusTone> = {
  MATCHED: 'positive',
  AMBIGUOUS: 'warning',
  UNMATCHED: 'neutral',
  MANUAL: 'info',
  IGNORED: 'neutral',
};
