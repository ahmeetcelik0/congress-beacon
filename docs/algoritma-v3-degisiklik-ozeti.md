# Salon Tespit Algoritması v3 — Değişiklik Özeti

> Bu doküman, mevcut salon-tespit algoritmasında (`v2`) yapılacak değişikliğin nedenini, kapsamını ve etkilerini anlaşılır dille anlatır. Teknik uygulama detayları için `docs/algoritma-v3-uygulama-talimati.md` dosyasına bakın.
>
> **Durum:** Onaylandı, uygulanmayı bekliyor. Bu doküman kod içermez.

## 1. Neden bu değişikliği yapıyoruz?

Şu anki algoritma (`ALGORITHM_VERSION = 'v2'`, `backend/src/attendance/attendance-processing.service.ts`), bir kişinin hangi salonda olduğuna, o an gördüğü beacon sinyallerinin **tek bir anlık ölçümüne** bakarak karar veriyor:

- Geçmiş ölçümlerle karşılaştırma yapmıyor (yalnızca `rssi = 0` gibi bariz geçersiz değerleri eliyor).
- Kazanan salonu yalnızca **kendi sabit eşiğine** göre değerlendiriyor; ikinci sıradaki (komşu) salona göre ne kadar net önde olduğuna bakmıyor.
- Güven düzeyini kaba bir 3 kategoriyle ("yüksek/orta/düşük") ifade ediyor, gerçek bir yüzde değil.

Bu, özellikle salonlar yan yana/üst üste olup birbirinin sinyaline karıştığında (sizin orijinal sorunuz) kararsız sonuçlara yol açabiliyor. Ayrıca katılımcılar hakkında (kalış süresi, medyan, toplam sayım gibi) daha zengin, panelden izlenebilir veri toplamak istediğinizi belirttiniz — bu da tasarımdaki bazı tercihleri etkiledi.

Bu tasarım; sizin önerdiğiniz fikir, yapılan literatür taraması ve ardından ikinci bir uzman görüşünün (ChatGPT) değerlendirilmesiyle birlikte üç aşamada olgunlaştırıldı. Aşağıda yalnızca **projemiz için mantıklı bulduğumuz** parçalar var — her önerinin bizim ölçeğimiz (2 kişilik ekip, geçici kongre etkinlikleri, henüz ilk pilotu yapılmamış bir sistem) için gerekli olup olmadığı ayrıca değerlendirildi.

## 2. Önce / sonra karşılaştırması

| Özellik | Şu an (v2) | Yeni (v3) |
|---|---|---|
| Ani sinyal sıçramalarını ayıklama | Yalnızca `rssi = 0` filtreleniyor | Her türlü anormal sıçrama filtreleniyor (Hampel filtresi) |
| Zaman içinde yumuşatma | Yok — her ölçüm tek başına değerlendiriliyor | Var — her beacon'ın sinyali son ölçümlerin ağırlıklı ortalamasıyla (EMA) yumuşatılıyor |
| Karar biçimi | "Eşiği geçti mi?" (evet/hayır) | "%0-100 arası ne kadar eminiz?" (gerçek güven yüzdesi) |
| Komşu salonla kıyaslama | Yok | Var — yüzdeler tüm salonları birbirine göre kıyaslıyor |
| Giriş/çıkış onayı | 2 ölçüm üst üste, giriş/çıkış için aynı eşik | 2 ölçüm üst üste, giriş/çıkış için ayrı (asimetrik) yüzde eşiği |
| İki salon neredeyse eşit göründüğünde | Belirsiz/rastgele bir salon seçilebilir | Sistem dürüstçe "belirsiz" (ambiguous) diyor |
| "Neden bu karar verildi" sorusu | Cevaplanamıyor | Her karar, kısa bir açıklama (Decision Trace) ile kaydediliyor |
| "Sinyal yok" ile "sinyal belirsiz" ayrımı | Ayrım yok, ikisi de aynı görünüyor | Ayrı, isimlendirilmiş durumlar: İçeride / Belirsiz / Sinyal Yok |

## 3. Yeni algoritma, adım adım

Bir kişinin telefonu her ölçümde birden fazla beacon'dan sinyal alır. Bu sinyaller şu adımlardan geçerek karara dönüşür:

**Adım 1 — Anormal okumaları ele.** Her beacon için, son birkaç ölçüme göre "sürüden çok kopan" bir değer gelirse (aniden çok daha güçlü/zayıf görünme) bu okuma dikkate alınmaz. Bunun için gereken küçük "son birkaç ölçüm" hafızası, kalıcı bir veritabanı tablosunda değil, **Redis'te** (projede zaten kurulu, bildirim zamanlamasında kullanılan aynı altyapı) geçici olarak tutulur — çünkü bu, rapor verisi değil, anlık karar için gereken çalışma belleğidir.

**Adım 2 — Zaman içinde yumuşat.** Her beacon'ın sinyali, son ölçümlerle birlikte ağırlıklı ortalanarak yumuşatılır. Tek bir ölçümün ani gürültüsü artık kararı tek başına etkilemez.

**Adım 3 — Salon içindeki beacon'ları birleştir.** Bir salonun beacon'larının yumuşatılmış değerleri ortalanır — o salon için tek bir "sinyal gücü" elde edilir.

**Adım 4 — Tüm salonları kıyasla, yüzdeye çevir.** O an sinyali görülen tüm salonlar birbirine göre kıyaslanır ve her biri için bir güven yüzdesi hesaplanır (hepsi toplamda %100 eder). Örnek: Salon 1 = %2, Salon 2 = %95, Salon 3 = %3.

**Adım 5 — Üst üste doğrula, resmileştir.** Bir salona "girildi" denebilmesi için o salonun yüzdesi bir eşiği (ör. %60) 2 ölçüm üst üste geçmesi gerekir. "Çıkıldı" denebilmesi için daha düşük bir eşiğin (ör. %40) altına düşmesi gerekir. İki salonun yüzdesi birbirine çok yakınsa (ör. aradaki fark %5'ten az) sistem net bir taraf seçmez, mevcut durumu "belirsiz" olarak işaretler.

**Adım 6 — Kararın gerekçesini kaydet (yeni).** Her giriş/çıkış kararıyla birlikte, o kararı üreten ayrıntılar (hangi beacon'lar, hangi yumuşatılmış değerler, tüm salonların yüzdeleri, en yakın rakip salonla fark) kısa bir not olarak saklanır. Bu, saha testinde "neden burada yanlış salon seçildi" sorusuna cevap verebilmek için gerekli — şu an sistemde bu görünürlük yok.

**Adım 7 — Durumu isimlendir (yeni).** Bir kullanıcının o anki durumu artık yalnızca "bir salonda" veya "hiçbir yerde" değil, üç ayrı isimle takip edilir: **İçeride** (bir salona net şekilde girmiş), **Belirsiz** (iki salon arasında, sınırda), **Sinyal Yok** (telefon veri göndermiyor — Bluetooth kapalı, uygulama arka planda durmuş, vb.). Bu üçü, kongre operasyonu açısından tamamen farklı anlamlara geliyor ve artık ayrı ayrı görülebilecek.

> **Fiziksel kurulum hâlâ önemli.** Bu değişiklik yazılım tarafında yapılıyor, ama hiçbir algoritma kötü yerleştirilmiş bir beacon'ı ya da çok zayıf sinyali sihirli şekilde düzeltemez. Beacon yerleşimi ve salon eşikleri, kongre öncesi saha testiyle kalibre edilmeli.

## 4. Veritabanı ve altyapıda ne değişecek?

- **Yeni bir kalıcı tablo yok.** Beacon-sinyal yumuşatma verisi (Adım 1-2) Redis'te tutulacak — geçici, otomatik silinen (birkaç saatlik ömür), rapor amaçlı olmayan bir veri.
- **Var olan bir alanın anlamı zenginleşiyor:** Ziyaret kayıtlarındaki güven skoru alanı, şu an "yüksek/orta/düşük" yerine artık gerçek bir %0-100 değeri tutacak. Eski kayıtlar bozulmuyor — algoritmanın sürüm numarası (v2 → v3) sayesinde eski ve yeni veriler karışmadan ayırt edilebiliyor.
- **İki küçük yeni alan ekleniyor:** kararın gerekçesi (Adım 6) ve kullanıcının anlık durumu (Adım 7) için.
- **Ayarlanabilir parametreler**, projenin zaten kullandığı "kongre başına panelden ayarlanabilir değer" deseniyle (bugünkü "mobil gönderim aralığı" ayarına benzer şekilde) ekleniyor — ayrı bir yapılandırma tablosu **kurulmuyor**, çünkü bu ölçekte gereksiz karmaşıklık olurdu.
- **Yeni bir ham veri alanı toplanmıyor.** Telefon modeli/pil/Bluetooth durumu gibi ek bilgiler mobil uygulamadan toplanmayacak — bunun nedeni §6'da açıklanıyor.

## 5. Panelde yeni ne göreceğiz?

| Yeni gösterge | Ne işe yarar |
|---|---|
| Gerçek % güven skoru | "Yüksek/orta/düşük" yerine/yanında net bir sayı (ör. "%92 güvenle Salon 2") |
| Kullanıcı başına özet | Toplam süre, ziyaret edilen salon sayısı, giriş-çıkış sayısı, ortalama güven skoru, ilk/son görülme zamanı |
| Salon başına ortalama güven skoru | O salonun beacon yerleşiminin ne kadar "net" çalıştığının göstergesi |
| Reddedilen/anormal okuma oranı | Bir beacon'ın veya bölgenin sinyal ortamının ne kadar "gürültülü" olduğunun göstergesi |
| Beacon başına ortalama RSSI ve görülen kullanıcı sayısı | Mevcut "Beacon Sağlığı" raporuna eklenen iki yeni sütun |
| "Neden bu karar?" açıklaması | Mevcut "Ham Gözlem Akışı" debug panelinde, karar gerekçesini gösteren bir ek görünüm |
| İçeride / Belirsiz / Sinyal Yok ayrımı | Takip Sağlığı ve Canlı Takip sayfalarında üç ayrı, isimlendirilmiş durum |

## 6. Bilerek YAPMAYACAĞIMIZ şeyler (ve neden)

Bu tasarım hazırlanırken önerilen ama **bilinçli olarak kapsam dışı bırakılan** maddeler var — ileride "unutulmuş" sanılmaması için burada açıkça listeliyoruz:

- **Ayrı bir "Replay Engine" (geçmiş veriyi yeni algoritmayla yeniden işleyen sistem) kurmuyoruz.** Çünkü bu yetenek zaten mimaride var: `docs/decisions.md`'de baştan beri yazılı olduğu gibi, ham veri hiç değiştirilmeden saklanıyor ve karar mantığı sürüm numaralı (`algorithmVersion`) tutuluyor — tam olarak "geçmiş verinin yeniden işlenebilmesi" için. Gerçek ihtiyaç doğduğunda (ör. bir pilottan sonra) bu, büyük bir alt-sistem değil, küçük bir script olarak eklenebilir.
- **Ham gözleme telefon pili/Bluetooth durumu/izin durumu gibi yeni alanlar eklemiyoruz.** Telefon modeli ve işletim sistemi zaten cihaz kaydında tutuluyor. Mobil uygulamanın "kaynak/güven" bilgisi göndermemesi zaten dokümante edilmiş bilinçli bir mimari karar (basitlik, iki platform arası tutarlılık). Bunu değiştirmek yeni mobil geliştirme gerektiriyor ve mobil tarafın gerçek önceliğiyle (offline veri kalıcılığı, push bildirimleri) çakışıyor.
- **Ayrı bir "AlgorithmConfig" tablosu kurmuyoruz.** Yeni parametreler, projenin zaten kullandığı kongre-bazlı ayar deseniyle mevcut Kongre kaydına ekleniyor. "İleride farklı bir algoritmaya geçilebilir" ihtimali için şimdiden soyut bir yapı kurmak, henüz doğmamış bir ihtiyaç için erken karmaşıklık.
- **Ayrı bir "Telemetry" sistemi kurmuyoruz.** Karar gerekçesi kaydı (§3, Adım 6) ve mevcut loglama zaten bu ihtiyacın büyük kısmını karşılıyor.
- **Panel tasarımını şimdi tam detaylandırmıyoruz.** Veri modeli ve algoritma uygulanıp gerçek veri şekli netleşmeden panel ekranlarını ayrıntılandırmak, sonradan baştan yazmak anlamına gelebilir. Gerekirse ayrı, o aşamada hazırlanacak bir doküman olur.

## 7. Bilinmesi gereken ödünleşimler

- **Biraz daha yavaş tepki:** Yumuşatma ve doğrulama katmanları, gerçek bir salon değişikliğinin panelde görünmesini birkaç saniye-onlarca saniye geciktirebilir — bu, yanlış alarmları azaltmanın makul bir bedeli.
- **Bazen "belirsiz" cevabı alacaksınız:** İki salonun sinyali gerçekten çok yakınsa, sistem artık zorla bir taraf seçmek yerine dürüstçe belirsizliği gösterecek — bu bir eksiklik değil, doğru davranış.
- **Saha testi hâlâ zorunlu:** Yazılım, kötü beacon yerleşimini telafi edemez; kalibrasyon adımları planınızda kalmalı.
- **Redis artık bu iş için de kullanılıyor:** Yeni bir servis kurulmuyor (zaten çalışıyor) ama Redis'in ayakta kalması artık salon-tespit kararı için de önemli hale geliyor (öncesinde yalnızca bildirim zamanlaması için önemliydi).

## 8. Sıradaki adım

Bu özet onaylandıktan sonra, `docs/algoritma-v3-uygulama-talimati.md` dosyası yeni bir Claude Code oturumuna verilerek uygulama başlatılabilir. Bu iki doküman hazırlanırken projede herhangi bir kod değişikliği yapılmadı.
