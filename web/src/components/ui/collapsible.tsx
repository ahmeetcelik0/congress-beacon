import * as React from 'react';
import './collapsible.css';

/**
 * Erişilebilir, animasyonlu genişleyen/daralan bölge. Kendi tetikleyici
 * butonunu İÇERMEZ — kapatma/açma düğmesi (bkz. `IconButton`) çağıran
 * tarafından ayrıca render edilir ve `aria-controls={id}` ile buraya
 * bağlanır. Bu ayrım, sidebar'daki "linke tıklama" ve "aç/kapa" tıklama
 * alanlarının birbirine karışmaması için kasıtlıdır.
 */
export function CollapsibleRegion({
  id,
  open,
  children,
  className,
  innerClassName,
}: {
  id: string;
  open: boolean;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      id={id}
      className={`ui-collapsible ${className ?? ''}`}
      data-open={open}
      aria-hidden={!open}
      inert={!open}
    >
      <div className={`ui-collapsible-inner ${innerClassName ?? ''}`}>{children}</div>
    </div>
  );
}
