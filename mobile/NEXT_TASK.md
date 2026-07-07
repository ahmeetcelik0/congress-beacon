# Congress Beacon — Mobil Sıradaki Görev

## Kullanım Kuralı
Bu dosyada aynı anda yalnızca bir aktif görev bulunur.

Antigravity bir görev çalıştırmadan önce:
1. Kök `README.md` dosyasını oku.
2. `mobile/AGENTS.md` dosyasını oku.
3. Bu dosyayı oku.
4. Yalnızca `Aktif Görev` bölümündeki işi uygula.
5. Görev sonunda testleri çalıştır, sonucu `Görev Sonucu` bölümüne yaz ve dur.
6. Kullanıcı açıkça onay vermeden görevi tamamlanmış kabul etme, checklist işaretleme veya sonraki göreve geçme.

## Görev Durumu
`HAZIR`

## Aktif Görev
NEXT_TASK.md dosyasına yeni aktif görev ekle ve ardından yalnızca bu görevi uygula.

Başlık:
Oturum Bazlı Uygulama Açılış Yönlendirmesi

Amaç:
Uygulama açıldığında güvenli depodaki oturuma göre doğru ekrana yönlendirmek. BeaconTestPage uygulamanın başlangıç ekranı olmayacak; yalnızca ParticipantHomePage içindeki test butonundan manuel açılacak.

Kurallar:
1. Uygulama açılışında SecureStorageService üzerinden accessToken ve deviceId kontrol edilsin.
2. accessToken veya deviceId yoksa PilotLoginPage açılsın.
3. İkisi de varsa ParticipantHomePage açılsın.
4. Açılış kontrolü sırasında kısa, sade bir yükleniyor ekranı gösterilsin.
5. ParticipantHomePage içinde observation batch isteği 401 Unauthorized dönerse:
   - accessToken ve deviceId güvenli depodan silinsin.
   - Kullanıcıya “Oturumunuz sona erdi. Lütfen tekrar giriş yapın.” mesajı gösterilsin.
   - Navigator stack temizlenerek PilotLoginPage açılır.
6. Token doğrulamak için yeni endpoint veya ek API isteği ekleme.
7. BeaconTestPage yalnızca manuel test ekranı olarak korunsun.
8. Yeni paket ekleme.
9. Arka plan, Swift, kalıcı offline kuyruk, salon karar mantığı, backend/web/shared/docs/README.md/AGENTS.md ve Git işlemi yapma.
10. flutter analyze ve flutter test çalıştır.
11. Gerçek cihaz testi yapılmadan görevi TAMAMLANDI yapma; NEXT_TASK.md içine “kullanıcı testi bekleniyor” yaz.

Görev Sonucu:
Kullanıcı testi bekleniyor.
