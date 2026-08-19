'use client';

import { useCallback, useState } from 'react';
import { RegistrationForm } from './registration-form';
import { RegistrationsTable } from './registrations-table';

/**
 * `RegistrationForm` (sunucu action + form reset) ile `RegistrationsTable`
 * (kendi verisini istemciden çeken tablo) arasındaki köprü. Katılımcı
 * eklendiğinde `revalidatePath('/registrations')` tabloyu ETKİLEMEZ (tablo
 * kendi verisini `api.listRegistrations` ile istemciden çekiyor) - bu yüzden
 * `refreshTick`'i burada tutup forma "başarılı oldum" sinyalinde artırıyoruz,
 * tablo da bunu prop olarak izleyip yeniden veri çekiyor.
 */
export function RegistrationsBoard({ congressId }: { congressId: string }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshTick((tick) => tick + 1), []);

  return (
    <>
      <RegistrationForm congressId={congressId} onCreated={bumpRefresh} />
      <RegistrationsTable congressId={congressId} refreshSignal={refreshTick} />
    </>
  );
}
