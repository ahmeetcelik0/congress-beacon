'use client';

import * as React from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import type { Congress } from '@/lib/api';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { CongressDeleteButton } from './congress-delete-button';
import { updateCongressMetaAction, type MetaFormState } from './actions';
import './congress-form.css';
import './congress-card-footer.css';

const initialState: MetaFormState = { error: null, saved: false, beaconUuidConflict: null };

/**
 * Kart alt bilgisi: gezinme linkleri + "Düzenle" aç/kapa düğmesi + (açıksa)
 * kongrenin "profil" alanlarının (kapak görseli, açıklama, iletişim bilgisi
 * vb. — mobil ana ekranda gösterilecek "tanıtım" alanları) VE beaconUuid'in
 * (KİMLİK alanı, bkz. Faz 6.2) düzenlendiği form. TEK bir istemci
 * bileşeninde toplanmasının nedeni: `open` durumu hem düğmeye hem panele
 * aynı anda lazım, `CongressCard` bir Sunucu Bileşeni olduğu için
 * `useState`i burada TUTAMAZ; panel ayrıca `.congress-card-actions`daki
 * flex satırının DIŞINA (kartın normal blok akışına) yerleştirilir — flex
 * satırının İÇİNDE tam genişlikte bir panel olsaydı kapalıyken bile "Sil"
 * düğmesini bir alt satıra düşürürdü (bkz. `.ui-collapsible`in kapalıyken
 * de DOM'da 0 yükseklikte ama tam genişlikte kalması, `collapsible.css`).
 *
 * beaconUuid değişikliği kongrede zaten beacon varsa backend'den 409 döner
 * (bkz. `updateCongressMetaAction`) — bu durumda formu TEKRAR doldurup
 * kullanıcıya sormak yerine, aynı form gizli bir `migrateExistingBeacons`
 * alanıyla (ref üzerinden imperatif olarak `'true'` yapılıp
 * `requestSubmit()` çağrılarak) yeniden gönderilir; böylece kullanıcı diğer
 * alanları (açıklama, iletişim vb.) yeniden girmek zorunda kalmaz.
 */
export function CongressCardFooter({ congress }: { congress: Congress }) {
  const [open, setOpen] = React.useState(false);
  const boundUpdate = React.useMemo(
    () => updateCongressMetaAction.bind(null, congress.id),
    [congress.id],
  );
  const [state, formAction, pending] = useActionState(boundUpdate, initialState);
  const panelId = `congress-edit-panel-${congress.id}`;

  const formRef = React.useRef<HTMLFormElement>(null);
  const migrateInputRef = React.useRef<HTMLInputElement>(null);
  const [migrationDismissed, setMigrationDismissed] = React.useState(false);
  // React, bir Server Action'a bağlı `<form action>` her gönderildiğinde
  // (başarılı VEYA başarısız fark etmez) uncontrolled alanları
  // `defaultValue`sine SIFIRLAR - bu, "onaylanmamış" bir 409'dan sonra
  // kullanıcının yazdığı YENİ UUID'nin DOM'dan kaybolmasına, "Onayla ve
  // taşı"nın da farkında olmadan ESKİ (değişmemiş) değeri
  // `migrateExistingBeacons: true` ile göndermesine yol açardı (canlı
  // testte yakalandı - bkz. bu fazın "Gerçek cihazda/panelde doğrulanan"
  // notu). Bu yüzden alan BİLEREK controlled: değeri React state'inde
  // tutulur, form-reset'ten etkilenmez.
  const [beaconUuidValue, setBeaconUuidValue] = React.useState(congress.beaconUuid);

  // Her yeni sunucu yanıtında onay bandı sıfırlanır (yeni bir 409 gelirse
  // tekrar gösterilebilsin) — render sırasında önceki state ile
  // karşılaştırılıp koşullu `setState` çağrılır (React'ın "storing
  // information from previous renders" deseni), bir `useEffect` İÇİNDE
  // senkron `setState` YAPILMAZ (bkz. `react-hooks/set-state-in-effect`).
  const [renderedState, setRenderedState] = React.useState(state);
  if (state !== renderedState) {
    setRenderedState(state);
    setMigrationDismissed(false);
  }

  // Bir kayıt başarılı olduysa gizli bayrak sıfırlanır ki sonraki normal
  // kayıtlar yanlışlıkla migrasyon TETİKLEMESİN — bu, DOM'u (dış sistem)
  // React state'iyle senkronize eden gerçek bir effect, `setState` çağırmaz.
  React.useEffect(() => {
    if (state.saved && migrateInputRef.current) {
      migrateInputRef.current.value = 'false';
    }
  }, [state]);

  function handleConfirmMigration() {
    if (migrateInputRef.current) {
      migrateInputRef.current.value = 'true';
    }
    formRef.current?.requestSubmit();
  }

  const showMigrationConfirm = !!state.beaconUuidConflict && !migrationDismissed;

  return (
    <>
      <div className="congress-card-actions">
        <Link href={`/halls?congressId=${congress.id}`} className="congress-card-action">
          Salonlar
        </Link>
        <Link href={`/beacons?congressId=${congress.id}`} className="congress-card-action">
          Beacon&apos;lar
        </Link>
        <Link href={`/content?congressId=${congress.id}`} className="congress-card-action">
          İçerik
        </Link>
        <button
          type="button"
          className="congress-card-action"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Düzenlemeyi kapat' : 'Düzenle'}
        </button>
        <CongressDeleteButton congressId={congress.id} congressName={congress.name} />
      </div>

      <CollapsibleRegion id={panelId} open={open} innerClassName="congress-edit-panel">
        <form ref={formRef} action={formAction} className="congress-edit-form">
          <input type="hidden" name="migrateExistingBeacons" ref={migrateInputRef} defaultValue="false" />
          <div className="congress-form-grid">
            {/* Tam genişlik: bu, aşağıdaki "tanıtım" alanlarından (kapak
                görseli, açıklama vb.) farklı olarak bir KİMLİK alanı (bkz.
                Faz 6.2) - ayrıca 5 yarım-genişlik alanı 2 sütunlu grid'e
                sokmak boş bir hücre bırakırdı (bkz. `congress-form-grid`,
                `grid-auto-flow` varsayılanı `row`/sparse). */}
            <label className="congress-edit-form-span-2">
              Beacon UUID
              <span className="congress-form-required" aria-hidden="true">
                {' '}
                *
              </span>
              <input
                type="text"
                name="beaconUuid"
                required
                value={beaconUuidValue}
                onChange={(event) => setBeaconUuidValue(event.target.value)}
                placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
                autoComplete="off"
              />
            </label>
            <label>
              Görünen tam ad <span className="congress-form-optional">(opsiyonel)</span>
              <input
                type="text"
                name="fullName"
                defaultValue={congress.fullName ?? ''}
                placeholder={congress.name}
              />
            </label>
            <label>
              Web sitesi <span className="congress-form-optional">(opsiyonel)</span>
              <input
                type="url"
                name="websiteUrl"
                defaultValue={congress.websiteUrl ?? ''}
                placeholder="https://…"
              />
            </label>
            <label>
              İletişim e-postası <span className="congress-form-optional">(opsiyonel)</span>
              <input type="email" name="contactEmail" defaultValue={congress.contactEmail ?? ''} />
            </label>
            <label>
              İletişim telefonu <span className="congress-form-optional">(opsiyonel)</span>
              <input type="tel" name="contactPhone" defaultValue={congress.contactPhone ?? ''} />
            </label>
            <label className="congress-edit-form-span-2">
              Açıklama <span className="congress-form-optional">(opsiyonel)</span>
              <textarea name="description" rows={3} defaultValue={congress.description ?? ''} />
            </label>
            <div className="congress-edit-form-span-2">
              <ImageUploadField
                label="Kapak görseli (opsiyonel)"
                name="coverImageUrl"
                congressId={congress.id}
                purpose="cover"
                defaultValue={congress.coverImageUrl}
                hint="Mobil ana ekranda kongre kartında gösterilir — JPEG, PNG veya WEBP, en fazla 2 MB."
              />
            </div>
          </div>

          <div className="congress-form-footer">
            <p className="congress-form-hint">* zorunlu alan · diğer boş bırakılan alanlar temizlenir.</p>
            <button type="submit" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>

          {state.error && (
            <p className="congress-form-error" role="alert">
              {state.error}
            </p>
          )}
          {!state.error && state.saved && (
            <p className="congress-form-success" role="status">
              Kaydedildi.
            </p>
          )}
          {showMigrationConfirm && (
            <div className="congress-form-migration-confirm" role="alertdialog" aria-label="Beacon UUID değişikliğini onayla">
              <p>{state.beaconUuidConflict}</p>
              <div className="congress-form-migration-confirm-actions">
                <button type="button" onClick={handleConfirmMigration} disabled={pending}>
                  Onayla ve taşı
                </button>
                <button
                  type="button"
                  className="congress-form-migration-cancel"
                  onClick={() => setMigrationDismissed(true)}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </form>
      </CollapsibleRegion>
    </>
  );
}
