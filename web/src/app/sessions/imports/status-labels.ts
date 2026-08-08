import type { ProgramImportRowStatus, ProgramImportStatus } from '@/lib/api';
import type { StatusTone } from '@/components/ui/status-badge';

// Yukleme (`ProgramImport`) genel durumu - `/sessions` sayfasindaki gecmis
// listesi VE `/sessions/imports/[id]` onizleme sayfasi ORTAK kullanir.
export const IMPORT_STATUS_LABELS: Record<ProgramImportStatus, string> = {
  PENDING: 'Bekliyor',
  EXTRACTING: 'İşleniyor',
  DRAFT: 'İncelemede',
  APPROVED: 'Onaylandı',
  CANCELLED: 'İptal Edildi',
  FAILED: 'Başarısız',
};

export const IMPORT_STATUS_TONES: Record<ProgramImportStatus, StatusTone> = {
  PENDING: 'info',
  EXTRACTING: 'info',
  DRAFT: 'warning',
  APPROVED: 'positive',
  CANCELLED: 'neutral',
  FAILED: 'critical',
};

// Staging oturum satirinin durumu - pratikte yalnizca NEW/INVALID/EXCLUDED
// uretilir (bkz. api.ts yorumu), tip tam sozlesme icin MATCHED/DUPLICATE'i
// de icerir.
export const ROW_STATUS_LABELS: Record<ProgramImportRowStatus, string> = {
  NEW: 'Yeni',
  MATCHED: 'Eşleşti',
  DUPLICATE: 'Tekrar',
  INVALID: 'Geçersiz',
  EXCLUDED: 'Çıkarıldı',
};

export const ROW_STATUS_TONES: Record<ProgramImportRowStatus, StatusTone> = {
  NEW: 'info',
  MATCHED: 'positive',
  DUPLICATE: 'neutral',
  INVALID: 'critical',
  EXCLUDED: 'neutral',
};
