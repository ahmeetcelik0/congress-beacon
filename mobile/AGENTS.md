# Congress Beacon — Mobile Agent Guide

## Ana çalışma kuralı
Kök dizindeki `README.md`, projenin ana planı ve ortak checklistidir.

Her mobil görev başlamadan önce:
1. `README.md` içindeki ilgili mobil maddeleri incele.
2. Yalnızca o an verilen görevi uygula.
3. Kod değişikliğinden sonra istenen testi çalıştır.
4. Test sonucunu kısa biçimde bildir.
5. Kullanıcı açıkça onay vermeden sonraki göreve geçme.

Bir mobil görevi ancak kullanıcı onayladıktan sonra tamamlandı kabul et.

## Checklist güncelleme kuralı
- Bir mobil görevi tamamlandıysa, kullanıcı onay verdikten sonra:
  - Kök `README.md` içindeki yalnızca ilgili mobil checklist maddesini `[x]` yap.
  - `mobile/AGENTS.md` içindeki ilgili mobil görev maddesini `[x]` yap.
- Backend, web veya ortak altyapı maddelerine dokunma.
- README içinde backend/web/ortak maddelerini işaretleme, silme, taşıma veya değiştirme.
- Kullanıcı açıkça istemeden README veya AGENTS checklist güncellemesi yapma.
- Bir görev tamamlanmadıysa `[ ]` olarak bırak.

## Proje amacı
Kongre salonlarına yerleştirilen Minew E7 cihazları iBeacon formatında yayın yapar. Katılımcıların Flutter mobil uygulaması beacon sinyallerini tarar. Kongre sonunda katılımcıların hangi salonda ne kadar kaldığına dair istatistik üretilir.

## Roller ve sınırlar
- Mobil geliştirici: Flutter uygulaması, iOS/Android izinleri, iBeacon tarama, yerel kuyruk, API istemcisi.
- Backend geliştirici: NestJS, MySQL, JWT, beacon/salon yapılandırması, ham verinin işlenmesi, salon giriş/çıkış olayları ve süre hesaplama.
- Web geliştirici: Next.js yönetim paneli.

Kesin sınır:
- Sadece `mobile/` altındaki dosyaları oluşturabilir veya değiştirebilirsin.
- `backend/`, `web/`, `shared/`, `docs/`, `docker-compose.yml` dosyalarına kesinlikle dokunma.
- Kök `README.md` yalnızca kullanıcı açıkça “checklist güncelle” dediğinde ve yalnızca mobil maddeler için değiştirilebilir.
- Git commit, push, branch, merge veya PR işlemi yapma.
- Yeni paket eklemeden önce gerekçeyi yaz ve kullanıcı onayı bekle.
- Kullanıcı açıkça istemeden sonraki adıma geçme.

## Kritik mimari kararı
Mobil uygulama salon kararı üretmez.

Mobil uygulama `SALON_ENTERED`, `SALON_EXITED`, `HALL_CHANGED`, `hallId` veya süre göndermez.
Mobil yalnızca ham iBeacon ölçüm snapshot’ları üretir ve backend’e gönderir.
Backend aktif HallBeacon eşleşmeleri, RSSI eşikleri ve karar algoritmasıyla salon giriş/çıkış/değişim olaylarını ve süreleri üretir.

## Beacon standardı
- Cihaz: Minew E7
- Yayın formatı: iBeacon
- Kimlik: uuid + major + minor
- Aynı anda görülen beacon ölçümleri tek snapshot içinde birlikte gönderilir.
- RSSI ve txPower ham ölçüm olarak saklanır.
- iOS arka plan davranışı kesin periyot garantisi vermez; uygulama yalnızca sistemin izin verdiği zamanlarda ölçüm ve senkronizasyon yapabilir.

## Pilot kimlik doğrulama
Giriş alanları:
- congressCode
- congressAccessCode
- firstName
- lastName
- phoneLast4

Backend başarılı girişte yalnızca accessToken döndürür.
- Token ilk aşamada 7 gün geçerlidir.
- Refresh token yoktur.
- Token güvenli depoda saklanır.
- Yetkili isteklerde `Authorization: Bearer <accessToken>` gönderilir.
- 401 alınırsa kullanıcı tekrar giriş akışına yönlendirilir.
- Mobil userId göndermez; backend kullanıcıyı JWT’den belirler.

## Observation batch
Endpoint: `POST /observations/batch`

Mobil yalnızca OpenAPI sözleşmesinde tanımlanan alanları kullanır.

Hedef veri:
- clientBatchId: UUID
- deviceId: UUID
- observations: snapshot listesi

Her snapshot:
- observationId: UUID
- observedAt: UTC ISO-8601
- beacons: aynı tarama anında görülen beacon listesi
  - uuid
  - major
  - minor
  - rssi
  - txPower nullable
- appVersion

Kurallar:
- Mobil hallId, eventType, duration veya salon kararı göndermez.
- Başarılı gönderilen observation’lar yerel kuyruktan silinir.
- Ağ veya geçici sunucu hatasında observation’lar silinmez.
- Aynı observation tekrar gönderilebilir; backend observationId ile idempotency sağlar.
- Token geçersizse observation’lar silinmez; kullanıcı tekrar giriş yaptıktan sonra gönderim denenir.

## Mobil geliştirme checklisti
- [x] Mevcut beacon test ekranının çalıştığı doğrulandı.
- [x] Temel mobil klasör yapısı oluşturuldu.
- [x] Pilot giriş ekranı hazırlandı.
- [x] Access token güvenli depoda saklanıyor.
- [x] Device kaydı hazırlandı.
- [ ] Bootstrap konfigürasyonu API’den alınıyor ve yerelde saklanıyor.
- [x] Ham beacon snapshot üretimi hazırlandı.
- [x] Yerel observation kuyruğu hazırlandı.
- [x] Batch gönderimi ve tekrar deneme hazırlandı.
- [ ] iOS/Android izinleri ve arka plan davranışı test edildi.
- [ ] Gerçek cihazla uçtan uca test tamamlandı.

## Kod ve test kuralları
- Dart null safety kullan.
- UI metinleri Türkçe olsun.
- Zamanları UTC olarak işle.
- Servis, model ve UI sorumluluklarını ayrı dosyalarda tut.
- Gizli anahtar, token veya gerçek API adresini kaynak koda yazma.
- Her kod değişikliğinden sonra en az `flutter analyze` çalıştır.
- Mevcut çalışan beacon test mantığını silme veya bozma.
- Her seferinde yalnızca tek küçük görev yap.
