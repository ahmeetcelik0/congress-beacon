# Salon Tespit Algoritması v3 — Ev Ortamında Saha Testi Protokolü

> Bu doküman, `docs/algoritma-v3-uygulama-talimati.md` §8 "Faz G — Saha testi"nin küçük ölçekli, evde 3 beacon ile yapılacak ilk turudur. Amaç kod değiştirmek değil, gerçek donanımla algoritmanın davranışını gözlemlemek ve gerekirse panelden parametre ince ayarı yapmaktır.

## 0. Bilinmesi gereken kısıtlar (dürüstçe, önden)

- **Minew E7'nin sinyal menzili kongre salonu ölçeği için ayarlanmıştır** (10-30 m mertebesinde). Ev odaları arası mesafe genelde 2-5 m'dir — beacon'lar birbirlerinin odasından da güçlü görünebilir. Bu bir yazılım kusuru değildir; talimatın kendisi bunu söylüyor: *"hiçbir algoritma kötü yerleştirilmiş bir beacon'ı ya da çok zayıf sinyali sihirli şekilde düzeltemez."* Mümkünse Minew'in kendi yapılandırma uygulamasından (Minew'in BLE config app'i) verici gücünü (TX power) düşürmeyi deneyin; düşüremiyorsanız beacon'ları evin en uzak noktalarına ve mümkünse duvar arkasına yerleştirin.
- **Tek kişilik test**: Evde muhtemelen tek telefonla test edeceksiniz. Bu, "aynı anda birden fazla katılımcı" senaryosunu kapsamaz ama backend zaten kullanıcı bazlı çalıştığı için bu bir eksiklik değildir — tek kullanıcı testi algoritmanın karar mantığını tam olarak sınar.
- **iOS arka plan kısıtı** (`docs/decisions.md`'de belgeli): uygulama arka plana atılırsa veya ekran kilitlenirse ranging farklı davranabilir. **Önce uygulamayı ön planda tutarak test edin**, arka plan testini ikinci öncelik yapın.
- **Bu, yeni bir "Test Kongre" verisiyle karışmasın diye ayrı bir kongre üzerinde yapılacak** (bkz. Adım 2). Daha önceki curl ile ürettiğim sahte "Test Kongre / Salon 1 / Salon 2" verisi gerçek beacon'ları temsil etmiyor; onunla karıştırmayın.

## 1. Ön hazırlık — bir kere yapılır

### 1.1 Beacon'ların gerçek kimliğini öğrenin

Panelde bir beacon kaydı oluşturmak için beacon'ın **gerçekten yayınladığı** `UUID`, `Major`, `Minor` değerlerini bilmeniz gerekir (Minew config app'inde ayarladığınız değerler, ya da fabrika varsayılanı).

1. Telefonunuza bir BLE tarayıcı uygulaması kurun: **nRF Connect** (Android/iOS) veya **LightBlue** (iOS).
2. Beacon'ları tek tek açıp tarayın; her biri için `iBeacon UUID`, `Major`, `Minor` değerlerini not edin.
3. **Aynı kongredeki tüm beacon'lar ortak bir UUID kullanır** (`docs/decisions.md`) — muhtemelen 3'ü de aynı UUID'yi, farklı `Major`/`Minor` kombinasyonuyla yayınlıyordur. Major genelde "salon" anlamına gelir; 3 farklı odayı 3 farklı `Major` ile modelleyebilir, ya da hepsini aynı Major'da farklı `Minor` ile bırakıp panelde 3 ayrı salona farklı beacon olarak atayabilirsiniz — panel `Major`/`Minor` kombinasyonunu esas alır, salon ataması `HallBeacon` ilişkisiyle yapılır, `Major`'ın "salon" anlamı gelmesi zorunlu değildir.

### 1.2 Panelde yeni bir kongre kurun

`http://localhost:3000/congresses` sayfasında:

1. **Kongre oluştur**: ad "Ev Testi", kod örn. `EVTEST`, pilot erişim kodu örn. `0000`, Beacon UUID = 1.1'de okuduğunuz gerçek UUID.
2. **Salonlar** sayfasında evinizdeki test odalarına karşılık gelen salonları oluşturun (Faz 1'de 1, Faz 2'de 2, Faz 3'te 3 — aşağıya bakın). RSSI eşiğini şimdilik varsayılan `-70` bırakın; **Adım 3'te gerçek ölçümle kalibre edeceğiz.**
3. **Beacon'lar** sayfasında 3 beacon'ı gerçek `Major`/`Minor` değerleriyle kaydedin.
4. **Beacon'lar → salon eşleştirme**: her beacon'ı ilgili salona atayın.

### 1.3 Telefon ↔ Mac ağ bağlantısı

Mobil uygulama varsayılan olarak üretim sunucusuna bağlanır; yerel backend'e bağlanması için **derleme zamanında** adres verilmesi gerekir (`mobile/lib/core/config/app_config.dart`).

1. Mac'inizin bu anki yerel ağ IP'si: **`192.168.6.117`** (bu, ağ değişirse veya Mac yeniden bağlanırsa değişebilir — değişirse `ipconfig getifaddr en0` ile tekrar öğrenin).
2. Telefon ve Mac **aynı Wi-Fi ağında** olmalı.
3. Uygulamayı gerçek cihazda şu komutla çalıştırın (mobile/ klasöründe):
   ```bash
   flutter run --dart-define=API_BASE_URL=http://192.168.6.117:3001
   ```
4. macOS ilk bağlantıda "Gelen bağlantılara izin ver" diye sorabilir — **izin verin**, aksi halde telefon backend'e ulaşamaz.
5. Backend ve panel zaten çalışır durumda olmalı (`docker compose ps` ile MySQL/Redis, `npm run start:dev` backend, `npm run dev` panel).

### 1.4 Uygulamada giriş yapın

Uygulamadaki "Pilot Girişi" ekranında sırasıyla:
- **Kongre Kodu**: `EVTEST`
- **Kongre Erişim Kodu**: `0000` (1.2'de belirlediğiniz)
- **Ad / Soyad**: herhangi bir isim (ör. "Berke Test")
- **Telefon Son 4 Hane**: herhangi 4 rakam (yalnızca aynı kişiyi tekrar tanımak için, raporlarda görünmez)

### 1.5 Gönderim aralığını hızlandırın (opsiyonel ama önerilir)

Panelde **Canlı Takip** sayfasında, kongre seçiliyken görünen "Mobil gönderim aralığı" kutusunu **5 saniyeye** düşürün. Varsayılan 10 sn'de test edilebilir ama 5 sn geri bildirimi hızlandırır. Uygulama bunu bir sonraki batch gönderiminde otomatik okur, yeniden derleme gerekmez.

---

## 2. Faz 1 — Tek oda, tek beacon (temel sağlık kontrolü)

**Amaç:** Telefon → backend → panel hattının gerçek donanımla uçtan uca çalıştığını doğrulamak. Henüz karar kalitesini değil, "hiç veri geliyor mu"yu test ediyoruz.

1. Beacon'lardan birini bir odaya (ör. "Oda A") koyun, panelde o odaya karşılık gelen tek salonu oluşturmuş olun.
2. Telefonla odaya girin, uygulamayı **ön planda** açık tutun.
3. Panelde `/attendance` → Canlı Takip'i açık tutun, ~30-60 saniye bekleyin.
4. **Beklenen:** "Şu An İçeride" 1 kişi gösterir, salon dolulukta o odanın altında 1 kişi görünür, **Karar Gerekçesi** panelinde bir "Giriş kararı" belirir (tek salon olduğu için yüzde `%100` çıkması normaldir — bu salonlar-arası görecelik ölçer, sinyal kalitesini değil).
5. Odadan uzaklaşın (mümkünse evin en uzak köşesi/başka kat), birkaç dakika bekleyin.
6. **Beklenen:** Ziyaret kapanır (EXIT), Takip Sağlığı'nda "sinyal yok" görünür.

**Bu fazda bir şey çalışmıyorsa** önce §5 "Sorun giderme"ye bakın — Faz 2/3'e geçmeden önce bu temel hat çalışmalı.

## 3. Faz 2 — İki bitişik oda (v3'ün asıl motivasyon senaryosu)

**Amaç:** Tam olarak bu değişikliğin yapılma nedeni olan senaryoyu test etmek: *"salonlar yan yana/üst üste olup birbirinin sinyaline karıştığında kararsız sonuçlar"* (`docs/algoritma-v3-degisiklik-ozeti.md`).

1. İki bitişik odayı seçin (aralarında ince duvar/kapı olan), her birine bir beacon koyun.
2. Panelde 2. salonu oluşturun, 2. beacon'ı ona atayın.
3. Aşağıdaki noktalarda durup her birinde **en az 30 saniye** bekleyin (bu noktalar projenin kendi pilot checklist'inden alınıyor, README §"Ortak pilot checklist'i"):
   - **Oda A ortası**
   - **Kapı önü / eşik** (iki odanın sınırında) — burada sistemin dürüstçe **Belirsiz (AMBIGUOUS)** demesi beklenir, zorla bir taraf seçmemesi.
   - **Oda B ortası**
   - **Koridor** (varsa, her iki sinyalin de zayıf olduğu bir nokta) — burada **Sinyal Yok** ya da düşük güvenli bir salon beklenir.
4. Her durakta panelde şunlara bakın:
   - **Canlı Takip**: hangi salonda görünüyor, kaç kişi.
   - **Karar Gerekçesi** paneli: o anki (veya bir önceki) kararın `decisionTrace`'i — iki salonun yüzdeleri, aralarındaki fark (`runnerUpGapPct`), kaç okuma anormal sayılıp elendi.
   - **Takip Sağlığı**: `İçeride / Belirsiz / Sinyal yok` durumu.
5. Odalar arasında **normal yürüyüş hızıyla** birkaç kez gidip gelin (flapping testi) — ziyaretin sahte şekilde onlarca kez açılıp kapanmaması gerekir (bu, canlı ortamda zaten doğrulanmış bir davranıştır: tek ölçümlük sıçramalar ziyareti bölmemeli).

## 4. Faz 3 — Üç oda (3. beacon dahil)

**Amaç:** Softmax'ın (Katman 4) ikiden fazla salonu aynı anda karşılaştırdığını gerçek veriyle görmek.

1. Üçüncü beacon'ı evin başka bir odasına koyun, panelde 3. salonu oluşturup atayın.
2. Üç oda arasında sırayla dolaşın; her odada durup **Karar Gerekçesi**'nde artık **üç adayın** (`candidates`) birden göründüğünü doğrulayın.
3. Üç odanın ortasına yakın bir noktaya geçebiliyorsanız (ör. evin merkezi bir koridoru), orada durup üç salonun yüzdelerinin nasıl dağıldığına bakın.

## 5. (Opsiyonel) Faz 4 — Aynı odaya 2 beacon

Zaman kalırsa: iki beacon'ı **aynı odaya** koyup üçüncüsünü başka bir odaya taşıyın. Bu, Katman 3'ü (salon içi birden fazla beacon'ın ortalanması) test eder. Panelde o iki beacon'ı da aynı salona atamanız yeterli — kod değişikliği gerekmez.

## 6. Manuel doğrulama (README'nin pilot checklist kuralı)

Testin "doğru" olup olmadığına karar vermenin en güvenilir yolu, kendi elle tuttuğunuz zamanla panelin ürettiği zamanı karşılaştırmaktır (`README.md`: *"Manuel sayım ile panel tahmini karşılaştırıldı"*):

- Her odaya giriş/çıkışınızı telefonunuzun saatiyle not edin (basit bir not defteri/uygulama yeterli).
- Test sonunda panelde **Katılımcı Salon Geçmişi** tablosuna gidin, kendi kaydınızı bulun, giriş/çıkış zamanlarını ve süreleri kendi notlarınızla karşılaştırın.
- Birkaç saniyelik-onlarca saniyelik gecikme beklenen bir davranıştır (yumuşatma + 2-ölçüm doğrulama bunun bedelidir, `docs/algoritma-v3-degisiklik-ozeti.md` §7). Dakikalar süren fark varsa not edin.

## 7. Kalibrasyon döngüsü — panelden ayar

Bir fazda sonuç tatmin etmezse (ör. hep "Belirsiz" çıkıyor, ya da hiç doğru salon seçmiyor), kod değiştirmeden **Canlı Takip → "Algoritma ayarları"** panelinden şu sırayla deneyin:

| Sorun | Denenecek ayar |
|---|---|
| Her yerde/her zaman "Belirsiz" çıkıyor | **Belirsizlik payı**'nı düşürün (ör. 5 → 2-3) |
| Salon değişimleri çok yavaş algılanıyor | **Yumuşatma (EMA α)**'yı artırın (ör. 0.35 → 0.5) — gürültüye karşı biraz daha açık olur ama daha çevik olur |
| Yanlış salon seçiliyor (uzaktaki beacon "kazanıyor") | Önce **salon eşiklerini** (`Salonlar` sayfasında `rssiThreshold`) gerçek ölçümle güncelleyin — bu genelde ilk çözülmesi gereken şeydir, softmax parametreleri değil |
| Tek bir sıçramada anormal davranış | **Outlier sıklığı (k)**'yı artırın (ör. 3 → 4-5, daha az okuma "anormal" sayılır) |
| Sinyal gerçekten titrek/gürültülü bir ortamda | **Outlier penceresi**'ni artırın (ör. 5 → 8) — MAD daha kararlı hesaplanır |

Her değişiklikten sonra **aynı senaryoyu tekrarlayın**, tek seferde birden fazla parametre değiştirmeyin (hangisinin etkili olduğunu ayırt edemezsiniz).

## 8. Salon eşiği kalibrasyonu (en kritik adım)

Ev odaları kongre salonlarından çok daha küçük olduğu için `-70 dBm` varsayılanı muhtemelen **her yerde geçilen** bir değer olacak (ayırt edici olmayacak). Gerçek eşiği bulmak için:

1. Ham Gözlem Akışı (debug) panelini açın.
2. Bir beacon'ın odasında durup RSSI değerlerinin ne olduğuna bakın (muhtemelen `-40` ile `-65` arası).
3. Aynı beacon'dan bir sonraki oda/koridorda RSSI'nin ne olduğuna bakın.
4. İki değer arasında, "içeride" ile "dışarıda"yı ayıracak bir eşik seçin (örn. içerideyken `-55`, dışarıdayken `-75` görüyorsanız eşiği `-65` yapın) ve **Salonlar** sayfasından o salonun `rssiThreshold`'unu güncelleyin.
5. Bu, talimatın kendisinin de söylediği gerçek: **yazılım beacon yerleşimini telafi edemez, saha kalibrasyonu zorunludur.**

---

## Sonuç kaydı şablonu (test sırasında doldurun)

| Faz | Nokta | Beklenen | Panelde görülen | Not |
|---|---|---|---|---|
| 1 | Oda A ortası | İçeride, Oda A | | |
| 1 | Odadan uzak | Sinyal yok | | |
| 2 | Oda A ortası | İçeride, Oda A | | |
| 2 | Kapı eşiği | Belirsiz | | |
| 2 | Oda B ortası | İçeride, Oda B | | |
| 2 | Koridor | Sinyal yok / düşük güven | | |
| 2 | Hızlı gidiş-geliş | Ziyaret bölünmüyor | | |
| 3 | Oda C ortası | İçeride, Oda C (3 aday decisionTrace'te) | | |

---

## Sorun giderme

- **Telefon hiç veri göndermiyor:** Ağ IP'sini kontrol edin (`ipconfig getifaddr en0`), macOS güvenlik duvarı izni verildi mi bakın, `flutter run` komutuna `--dart-define` doğru yazıldı mı kontrol edin.
- **`401`/giriş hatası:** Kongre kodu/erişim kodu panelde oluşturduğunuzla birebir aynı mı (büyük/küçük harf duyarlı olabilir).
- **Beacon hiç eşleşmiyor** (Ham Gözlem Akışı'nda "eşleşmedi" yazıyor): Panelde kayıtlı `UUID`/`Major`/`Minor` ile beacon'ın gerçekte yayınladığı değerler birebir aynı mı — 1.1'deki BLE tarayıcı sonucunu tekrar kontrol edin.
- **Hiçbir zaman giriş açılmıyor:** RSSI, salon eşiğinin (`rssiThreshold`) altında kalıyor olabilir — §8'deki kalibrasyonu yapın.
- **Sürekli "Belirsiz":** `ambiguityMarginPct` çok yüksek olabilir, ya da iki beacon fiziksel olarak birbirine çok yakın/güçlü — beacon'ları uzaklaştırmayı deneyin.

## Test sonrası

Test bittiğinde "Ev Testi" kongresini panelden silebilir veya ileride yeniden kalibrasyon denemek için tutabilirsiniz — silme geri alınamaz bir işlemdir, emin değilseniz tutun.
