'use client';

import * as React from 'react';
import './icon-button.css';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Görsel olarak sadece ikon gösteren düğmeler için erişilebilir isim zorunludur. */
  'aria-label': string;
  size?: 'sm' | 'md';
};

/**
 * Yalnızca ikon içeren, erişilebilir buton. Odak halkası ve disabled durumu
 * global tasarım tokenlarından (`--focus-ring`, `--transition-fast`) beslenir.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`ui-icon-button ui-icon-button-${size} ${className ?? ''}`}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';
