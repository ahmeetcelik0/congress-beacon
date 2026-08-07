import Link from 'next/link';

export const CONTENT_TABS = [
  { key: 'info', label: 'Genel Bilgi' },
  { key: 'venues', label: 'Mekanlar' },
  { key: 'announcements', label: 'Duyurular' },
  { key: 'sponsors', label: 'Sponsorlar' },
  { key: 'speakers', label: 'Konuşmacılar' },
] as const;

export type ContentTabKey = (typeof CONTENT_TABS)[number]['key'];

export function isContentTabKey(value: string | undefined): value is ContentTabKey {
  return CONTENT_TABS.some((tab) => tab.key === value);
}

/**
 * Sekme durumu bilinçli olarak URL'de (`?tab=`) tutulur, `useState` DEĞİL —
 * böylece sayfa yenilendiğinde veya geri tuşuyla dönüldüğünde kullanıcı hangi
 * sekmedeyse orada kalır ve link paylaşılabilir olur (bkz. görev tanımı,
 * "makul bir yaklaşım seç"). Salt gezinme olduğu için `<Link>` yeterli —
 * ayrı bir istemci bileşenine/`useState`e gerek yok, native `aria-current`
 * ile erişilebilir aktif sekme bildirimi sağlanır.
 */
export function ContentTabs({ congressId, activeTab }: { congressId: string; activeTab: ContentTabKey }) {
  return (
    <nav className="content-tabs" aria-label="İçerik türü">
      {CONTENT_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/content?congressId=${congressId}&tab=${tab.key}`}
          className="content-tab"
          data-active={tab.key === activeTab || undefined}
          aria-current={tab.key === activeTab ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
