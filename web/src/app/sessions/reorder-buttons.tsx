'use client';

// `content/components/reorder-buttons.tsx` ile AYNI bilesen (bkz. gorev
// tanimi: cross-module import yapma, kucuk bir kopya yaz) - surukle-birak
// YOK, yukari/asagi tasima butonlari.

const UpIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 7.5 6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function ReorderButtons({
  itemLabel,
  onMoveUp,
  onMoveDown,
  disabledUp,
  disabledDown,
  pending,
}: {
  itemLabel: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabledUp: boolean;
  disabledDown: boolean;
  pending: boolean;
}) {
  return (
    <div className="sessions-reorder-buttons">
      <button
        type="button"
        aria-label={`${itemLabel} sırayı yukarı taşı`}
        onClick={onMoveUp}
        disabled={disabledUp || pending}
      >
        <UpIcon />
      </button>
      <button
        type="button"
        aria-label={`${itemLabel} sırayı aşağı taşı`}
        onClick={onMoveDown}
        disabled={disabledDown || pending}
      >
        <DownIcon />
      </button>
    </div>
  );
}
