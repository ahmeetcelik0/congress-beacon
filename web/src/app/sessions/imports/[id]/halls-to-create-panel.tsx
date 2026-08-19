'use client';

import { useTransition } from 'react';
import { excludeHallToCreateAction } from './actions';

/**
 * Faz 4c §3: onayda otomatik oluşturulacak salon adayları — admin bir adayı
 * burada kaldırırsa (ör. adı yanlış çıkarılmış, elle bir salonla
 * eşleştirecek), o ada sahip oturum satırları "salon seçilmemiş" durumuna
 * düşer ve mevcut onay engeli (`ApprovePanel`) bunları zaten yakalar —
 * ekstra bir durum yönetimine gerek yok, sayfa `revalidatePath` ile
 * tazelenince liste kendiliğinden güncellenir.
 */
export function HallsToCreatePanel({
  importId,
  hallNames,
}: {
  importId: string;
  hallNames: string[];
}) {
  const [pending, startTransition] = useTransition();

  function handleExclude(hallName: string) {
    startTransition(async () => {
      await excludeHallToCreateAction(importId, hallName);
    });
  }

  return (
    <section className="import-halls-to-create" aria-labelledby="halls-to-create-heading">
      <h2 id="halls-to-create-heading">Otomatik Oluşturulacak Salonlar</h2>
      <p className="import-halls-to-create-hint">
        Bu isimler bilimsel programda geçiyor ama kongrede tanımlı hiçbir salonla eşleşmiyor —
        onaylandığında bu isimlerle yeni salonlar otomatik oluşturulacak. Bir isim yanlışsa veya
        mevcut bir salonla elle eşleştirmek istiyorsanız listeden kaldırın.
      </p>
      <ul className="import-halls-to-create-list">
        {hallNames.map((name) => (
          <li key={name}>
            <span>{name}</span>
            <button type="button" onClick={() => handleExclude(name)} disabled={pending}>
              Kaldır
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
