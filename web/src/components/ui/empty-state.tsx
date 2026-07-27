import * as React from 'react';
import './empty-state.css';

/**
 * Boş/veri bekleyen durumlar için tek tip mesaj kutusu (ör. "önce kongre
 * seçin", "bu kongrede henüz X yok"). `role="status"` ile ekran okuyucular
 * için de anlamlıdır.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-empty-state ${className ?? ''}`} role="status">
      <p className="ui-empty-state-title">{title}</p>
      {description && <p className="ui-empty-state-description">{description}</p>}
      {action && <div className="ui-empty-state-action">{action}</div>}
    </div>
  );
}
