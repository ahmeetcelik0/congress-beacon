import * as React from 'react';
import './error-state.css';

/**
 * Bir isteğin GERÇEKTEN başarısız olduğu (ağ/backend hatası) durumlar için
 * tek tip mesaj kutusu — `EmptyState`'in ikizi, ancak "veri yok" ile
 * "veri alınamadı" birbirine karışmasın diye kasıtlı olarak ayrı bir
 * bileşendir (bkz. proje teslim notu). `role="alert"` ile ekran
 * okuyuculara `EmptyState`'ten (role="status", polite) daha acil bir
 * ton (assertive) verir.
 */
export function ErrorState({
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
    <div className={`ui-error-state ${className ?? ''}`} role="alert">
      <p className="ui-error-state-title">{title}</p>
      {description && <p className="ui-error-state-description">{description}</p>}
      {action && <div className="ui-error-state-action">{action}</div>}
    </div>
  );
}
