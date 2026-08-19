import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CongressLoadError } from '@/components/ui/congress-load-error';
import { loadCongresses } from '@/lib/load-congresses';
import { CongressSelector } from '../components/congress-selector';
import { ContentTabs, isContentTabKey, type ContentTabKey } from './content-tabs';
import { InfoSectionsSection } from './info-sections/info-sections-section';
import { VenuesSection } from './venues/venues-section';
import { AnnouncementsSection } from './announcements/announcements-section';
import { SponsorsSection } from './sponsors/sponsors-section';
import { SpeakersSection } from './speakers/speakers-section';
import './content.css';

/**
 * Kongre İçerik Yönetimi — mobil ana ekranda kongre hakkında gösterilecek
 * içerikler (genel bilgi, mekan/otel bilgisi, ana konuşmacı vitrini,
 * duyurular, sponsorlar). SADECE yönetim tarafı; mobilin bu veriyi okuyacağı
 * `/mobile/...` uçları ayrı bir fazda yazılacak (bkz. görev tanımı).
 *
 * Hedef kullanıcı: kongre organizasyon ekibi/admin — teknik olmayan bir
 * kullanıcı da olabileceği için içerik türleri arasında SEKMELERLE (tek sayfa,
 * 5 ayrı nav linki DEĞİL) gezinilir; her sekme kendi oluşturma formu + liste
 * tablosunu içerir. Bilgi hiyerarşisi: kongre seçimi → sekme → o türün
 * listesi (sıralama okları + düzenle/sil) altında yeni kayıt formu.
 */
export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ congressId?: string; tab?: string }>;
}) {
  const { congressId, tab: rawTab } = await searchParams;
  const congressesResult = await loadCongresses();

  if (!congressesResult.ok) {
    return (
      <main className="panel-page">
        <PageHeader title="Kongre İçerik Yönetimi" />
        <CongressLoadError showBackLink />
      </main>
    );
  }

  const congresses = congressesResult.congresses;
  const activeTab: ContentTabKey = isContentTabKey(rawTab) ? rawTab : 'info';

  return (
    <main className="panel-page">
      <PageHeader
        title="Kongre İçerik Yönetimi"
        description="Mobil uygulamanın ana ekranında gösterilecek kongre içeriklerini yönetin: genel bilgi, mekan/otel, duyuru, sponsor ve konuşmacı vitrini."
        actions={
          <CongressSelector congresses={congresses} selectedId={congressId} basePath="/content" />
        }
      />

      {!congressId && (
        <EmptyState
          title="Önce bir kongre seçin."
          description="İçerik yönetimi seçtiğiniz kongreye göre çalışır; yukarıdan bir kongre seçin."
        />
      )}

      {congressId && (
        <>
          <ContentTabs congressId={congressId} activeTab={activeTab} />

          {activeTab === 'info' && <InfoSectionsSection congressId={congressId} />}
          {activeTab === 'venues' && <VenuesSection congressId={congressId} />}
          {activeTab === 'announcements' && <AnnouncementsSection congressId={congressId} />}
          {activeTab === 'sponsors' && <SponsorsSection congressId={congressId} />}
          {activeTab === 'speakers' && <SpeakersSection congressId={congressId} />}
        </>
      )}
    </main>
  );
}
