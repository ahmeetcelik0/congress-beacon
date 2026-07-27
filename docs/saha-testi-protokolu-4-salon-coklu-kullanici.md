# Saha Testi Protokolü — 4 Salon, 8 Beacon, 3 Telefon (Prod Sunucu)

> Ev testinin (`docs/saha-testi-protokolu-ev.md`) büyütülmüş hâli. Orada tek kişi/tek beacon ile bulduğumuz iki gerçek hata (Hampel pencere kilitlenmesi, tek-beacon "ışınlanma") zaten düzeltildi ve `staleGraceSeconds` mekanizması eklendi. Bu test artık şunları sınıyor: **çoklu kullanıcı**, **salon başına 2 beacon birleştirmesi**, **4 salon arası softmax karşılaştırması**, ve **gerçek bir kongre ölçeğine yakın hareket**.

## 0. Ön koşul — sunucu güncel

Sunucu (`45.133.36.26`) `develop` branch'ine güncellendi (v3 algoritma + grace-suresi düzeltmesi), migration'lar uygulandı, `{"status":"ok"}` health check ve prod veri bütünlüğü doğrulandı. Panel: `https://beacon.photofocustr.com/yetkili`.

---

## 1. Ön hazırlık (bir kere)

### 1.1 Yeni, temiz bir kongre oluşturun

Prod'daki mevcut "Test"/"Test Kongresi" kayıtlarıyla karışmasın diye panelden **yeni bir kongre** açın (ör. "4 Salon Testi"). 8 beacon'ınızın gerçek UUID/Major/Minor değerlerini (ev testinde olduğu gibi bir BLE tarayıcıyla — nRF Connect/LightBlue) önceden not edin.

### 1.2 Salon ve beacon yapısı

4 salon oluşturun, her birine 2'şer beacon atayın (toplam 8). Beacon'ları salonlara yerleştirirken **ev testinde öğrendiğimiz şunu** unutmayın: Minew E7'nin menzili küçük mekanlar için fazla güçlü olabilir — salonlar arasında mümkün olduğunca fiziksel ayrım (duvar, mesafe) olsun.

### 1.3 3 test kullanıcısı

Her telefonla ayrı bir isimle pilot girişi yapın (ör. "Test A", "Test B", "Test C") — birbirinden ayırt edilebilir olsun, karar izinde ve raporlarda kim olduğunuzu hemen görebilesiniz.

### 1.4 Başlangıç parametreleri

Ev testinde doğrulanan değerlerle başlayın, sahada gerekirse ince ayar yapın:

| Parametre | Önerilen başlangıç |
|---|---|
| Sinyal kesintisi toleransı | **10-12 sn** (ev testinde 5sn yetersiz kaldı, telefonların gerçek ~8sn'lik gönderim boşluklarını köprülemek için) |
| Giriş/Çıkış eşiği | 60 / 40 (varsayılan) |
| Belirsizlik payı | 5 (varsayılan) |
| Diğerleri | varsayılan bırakın, ilk turda değiştirmeyin — çok fazla değişkeni aynı anda değiştirmeyin |

### 1.5 Kalibrasyon: her salonun RSSI eşiği

Testten önce, **her salona girip** o salonun beacon'larından tipik RSSI'yi Ham Gözlem Akışı'ndan okuyun, salon dışındaki (koridor/komşu salon) değeri de görün, aradan bir eşik belirleyip **Salonlar** sayfasından `rssiThreshold`'u güncelleyin. Bu adımı atlamayın — ev testinde bulduğumuz en kritik kalibrasyon adımıydı.

### 1.6 Kayıt tutma şablonu (ZORUNLU)

Testin doğruluğunu ölçmenin tek yolu, gerçek hareketinizi bağımsız olarak yazılı tutmak. **Her testçi kendi telefonunun saatiyle**, aşağıdaki gibi bir not tutsun (kağıda, notlar uygulamasına, fark etmez — önemli olan gerçek zamanlı yazmak, sonradan hatırlamaya çalışmamak):

| Saat | Hareket | Salon |
|---|---|---|
| 14:32:10 | Giriş | Salon 1 |
| 14:38:45 | Çıkış → Giriş | Salon 2 |
| ... | ... | ... |

---

## 2. Test fazları

### Faz 1 — Tek tek sağlık kontrolü (paralel değil, sırayla)

Her telefonu **ayrı ayrı**, diğerleri kapalıyken, kendi salonunda 1 dakika test edin (ev testinin Faz 1'i gibi). Amaç: beacon kayıtları/UUID eşleşmesi doğru mu, temel giriş/çıkış çalışıyor mu — 3 telefonu birden karıştırmadan önce tek tek doğrulayın. Bir sorun varsa (yanlış beacon eşleşmesi, eşik çok düşük/yüksek) burada çok daha ucuza bulunur.

### Faz 2 — 3 kişi aynı anda, ayrı salonlarda (çakışma yok)

Her testçi kendi salonuna gidip **en az 5 dakika** sabit dursun (aynı anda, birbirinden habersiz hareket etmeden). Bu, temel çoklu-kullanıcı senaryosunu sınar: her kullanıcının `UserPresenceState`'i birbirinden bağımsız mı, biri diğerini etkiliyor mu?

**Kontrol:** Test sonunda her 3 kullanıcı için ayrı ayrı `attendance/users/:userId/summary` çekin — her birinin `currentlyInside` doğru salonu göstermeli, birbirine karışmamalı.

### Faz 3 — Planlı rotasyon (senkronize geçişler)

Önceden bir rotasyon planı yapın (ör. her testçi 3 dakikada bir saat yönünde bir sonraki salona geçsin) ve **tam olarak plana uyarak** hareket edin — plana uymak, sonradan "hangi salonda ne zaman olmalıydım" sorusunu tartışmaya açık bırakmaz, kanıtlanabilir bir referans oluşturur. Örnek 3 kişilik, 4 salonlu rotasyon (dakika:salon):

```
        Test A     Test B     Test C
00:00   Salon 1    Salon 2    Salon 3
03:00   Salon 2    Salon 3    Salon 4
06:00   Salon 3    Salon 4    Salon 1
09:00   Salon 4    Salon 1    Salon 2
```

Geçiş anlarında (yürüme süresi hariç) her testçi yeni salonda **en az 2 dakika** dursun ki giriş/çıkış streak'i (2 ölçüm üst üste) rahatça tamamlansın.

### Faz 4 — Aynı salonda çakışma

İki testçi **aynı anda aynı salona** girsin, birlikte 2 dakika dursun, sonra biri çıkarken diğeri kalsın. Bu, aynı salonun aynı anda birden fazla kullanıcı tarafından doğru şekilde raporlanıp raporlanmadığını sınar (`Salon Doluluğu`'nda "2 kişi" görünmeli, sonra "1 kişi"ye düşmeli).

### Faz 5 — Sınır/geçiş noktaları

Ev testindeki "kapı eşiği" senaryosunun büyütülmüşü: iki salonun ortak sınırında (duvar, kapı, koridor kesişimi) bir testçi durup en az 30 saniye beklesin. `AMBIGUOUS` durumunun doğru tetiklendiğini kontrol edin. Mümkünse bunu birden fazla salon çifti için tekrarlayın (Salon1-Salon2 arası, Salon2-Salon3 arası, vb.) — her sınırın fiziksel ayrımı farklı olabilir.

### Faz 6 — Hızlı hareket / flapping (büyük ölçek)

Bir testçi, 2 salon arasında normal yürüyüş hızıyla birkaç kez art arda gidip gelsin (ev testinde tek kullanıcıyla doğrulanan flapping-direnci, şimdi diğer 2 kullanıcı da aktifken/arka planda veri üretirken tekrar sınanıyor — sistem kaynak/performans baskısı altında da aynı kararlılığı gösteriyor mu).

---

## 3. Test sonrası — doğruluk kıyaslaması

Bu adım, tam olarak sizin istediğiniz "gerçekten hangi zamanda hangi salonda olduğumu söyleyip veritabanıyla kıyaslama" kısmı:

1. Her testçi kendi elle tuttuğu notu (adım 1.6) paylaşsın.
2. Panelden (veya bana söyleyerek, DB'den) her testçinin `Katılımcı Salon Geçmişi`ni çekin — `attendance/hall-visits?userId=...` ile kendi kayıtlarınızı filtreleyin.
3. Satır satır karşılaştırın: not edilen giriş/çıkış saati ile sistemin kaydettiği `startedAt`/`endedAt` arasındaki fark kaç saniye? (Birkaç saniye-onlarca saniyelik gecikme beklenen davranıştır — yumuşatma + 2-ölçüm doğrulamanın bedeli.)
4. Sapma bulunan her noktada `Karar Gerekçesi` panelinden o ziyaretin `decisionTrace`'ine bakın — hangi salon hangi yüzdeyle kazanmış, hangi beacon donmuş/elenmiş, neden.
5. Faz 4 (çakışma) ve Faz 5 (sınır) sonuçlarını ayrıca değerlendirin — bunlar "doğru/yanlış" değil, "sistemin dürüstçe belirsiz dediği yerler doğru mu" sorusuna cevap verir.

Bana bu notları ve gözlemlerinizi ilettiğinizde, aynı ev testinde yaptığımız gibi DB'den gerçek verileri çekip birebir karşılaştırırız.

---

## 4. Sorun giderme (ev testinden bilinenler)

- **Bir salon hep "az önce çıktı" gibi görünüyor:** `staleGraceSeconds` çok düşük olabilir, telefonunuzun gerçek gönderim boşluğunu (Ham Gözlem Akışı'ndan ardışık okumalar arası saniye farkına bakarak) ölçüp ona göre artırın.
- **İki salon sürekli "Belirsiz":** Salon eşikleri (adım 1.5) kalibre edilmemiş olabilir, ya da beacon'lar fiziksel olarak birbirine çok yakın.
- **Bir kullanıcının verisi diğerini etkiliyormuş gibi görünüyor:** Bu olmamalı (her kullanıcının durumu `userId` bazlı tamamen bağımsız) — böyle bir şey gözlemlerseniz hemen bildirin, bu gerçek bir hata olurdu.
