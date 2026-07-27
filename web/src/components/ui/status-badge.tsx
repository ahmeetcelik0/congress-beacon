import * as React from 'react';
import './status-badge.css';

export type StatusTone = 'positive' | 'warning' | 'critical' | 'info' | 'neutral';

/**
 * Tüm panelde tutarlı durum rozeti (ör. "aktif/yakın zamanda/veri yok",
 * "içeride/çıktı"). Renk kaynağı her zaman `--status-*` takma adlarıdır,
 * böylece grafik/rozet renkleri arasında sapma oluşmaz.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`ui-status-badge ${className ?? ''}`} data-tone={tone}>
      {children}
    </span>
  );
}
