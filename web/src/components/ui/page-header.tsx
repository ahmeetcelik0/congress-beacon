import * as React from 'react';
import './page-header.css';

/**
 * Sayfa üstü başlık bloğu: başlık + isteğe bağlı açıklama + isteğe bağlı
 * eylem alanı (ör. kongre seçici). Uzun Türkçe başlıklarda/butonlarda
 * satır kaydırma yapar, dar ekranlarda eylemler alta düşer.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header-text">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="ui-page-header-actions">{actions}</div>}
    </header>
  );
}
