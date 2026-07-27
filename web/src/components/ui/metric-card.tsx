import * as React from 'react';
import './metric-card.css';

/**
 * Tek bir KPI/istatistik değeri için kart. `hint` ikincil bir açıklama ya
 * da birim belirtmek için kullanılır (ör. "dk", "tüm salonlar toplamı").
 */
export function MetricCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-metric-card ${className ?? ''}`}>
      <span className="ui-metric-card-label">{label}</span>
      <span className="ui-metric-card-value">{value}</span>
      {hint && <span className="ui-metric-card-hint">{hint}</span>}
    </div>
  );
}
