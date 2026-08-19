# Kongre Beacon

Kongrelerde salon doluluğunu ve katılımcıların bilimsel programa gerçek
katılımını otomatik, arka planda ölçen bir sistem.

## Problem

Kongre organizatörleri ve sponsorlar için "bu oturuma kaç kişi katıldı" ve
"salonlar ne kadar doluydu" soruları bugün ya hiç cevaplanmıyor ya da elle
sayım/tahminle cevaplanıyor. Bu, hem sponsor raporlamasını (bir sponsorun
desteklediği oturuma gerçekten kaç kişi geldi?) hem de gelecek kongrelerin
salon/program planlamasını (hangi konu hangi büyüklükte salon gerektiriyor?)
tahmine dayalı bırakıyor.

## Çözüm

Salonlara yerleştirilen küçük Bluetooth vericiler (iBeacon) ve
katılımcıların telefonuna kurduğu bir mobil uygulama ile, katılımcı hiçbir
şey yapmadan (uygulamayı bir kez kurup izin verdikten sonra) hangi salonda
ne kadar süre bulunduğu otomatik olarak kaydedilir. Bu ölçüm arka planda,
katılımcının uygulamayı açık tutmasına bile gerek kalmadan çalışır.

## Kimin için

- **Kongre/dernek organizatörleri** — canlı salon doluluğu, oturum bazlı
  katılım, kongre sonu raporlama.
- **Sponsorlar** — desteklenen oturuma gerçek katılım verisi.
- **Katılımcılar** — bilimsel programı, kendi konuşma/dinleme programını ve
  kongre bilgilerini tek bir uygulamadan takip eder.

## Katılımcı ne görür

Mobil uygulama üç ana sekmeden oluşur:

- **Ana Sayfa** — kongre bilgisi, "sıradaki sunumum" kartı, duyurular,
  sponsorlar, ana konuşmacılar, mekân bilgileri.
- **Bilimsel Program** — gün/salon bazlı filtrelenebilir program, oturum
  detayları, arama.
- **Profilim** — kayıtlı kongreler arasında geçiş, "benim programım" (kendi
  konuşma/moderatörlük yaptığı oturumlar), bildirim tercihleri.

Oturum başlamadan 10 dakika önce ve başladığı an bildirim alınabilir.
**Takip özelliği katılımcı arayüzünde hiçbir yerde görünmez** — arka planda
sessizce çalışır, katılımcının tek gördüğü şey kendi bilimsel programı ve
kongre içeriğidir.

## Organizatör ne görür

Yetkili panelinden:

- Canlı salon doluluğu ve zaman dilimine göre yoğunluk grafikleri.
- Oturum bazlı katılım, ortalama/medyan kalış süresi.
- Katılımcı bazında salon geçmişi ve güven skoru.
- Veri kalitesi ve beacon sağlığı raporları (hangi beacon veri göndermiyor,
  eşleşmeyen sinyal oranı).
- CSV dışa aktarma.
- Kongre, salon, beacon, katılımcı, bilimsel program ve içerik
  (duyuru/sponsor/mekân/ana konuşmacı) yönetimi — tamamı panelden.

## Öne çıkan yetenekler

- **Bilimsel programın otomatik aktarılması** — PDF/Excel dosyasından
  yapay zeka ile veya zaten yapılandırılmış bir JSON dosyasından, yüzlerce
  oturumu elle girmeden içe aktarma; her satır onaydan önce önizlenip
  düzeltilebilir.
- **Konuşmacı eşleştirme** — bilimsel programdaki isimler, kayıtlı
  katılımcı listesiyle otomatik eşleştirilir; belirsiz/eşleşmeyen isimler
  yetkiliye açıkça gösterilir, asla tahmin edilip yanlış kişiye
  bağlanmaz.
- **Çok kongreli yapı** — bir katılımcı birden fazla kongreye kayıtlı
  olabilir, kongreler arasında geçiş yapabilir.
- **Çevrimdışı dayanıklılık** — kongre salonunda ağ zayıf/yok olsa bile
  katılım verisi telefonda güvenle biriktirilir, ağ döndüğünde otomatik
  gönderilir; kongre programı da önceden indirilmiş şekilde çevrimdışı
  görüntülenebilir.
- **Salon tespit algoritması** — ham sinyal gürültüsünü (aykırı okumalar,
  komşu salon karışması, anlık dalgalanmalar) süzüp güvenilir bir "şu an
  hangi salonda" kararına çeviren, kongre başına ince ayar yapılabilen bir
  sinyal işleme hattı (bkz. `docs/ALGORITMA.md`).

## Gizlilik ve veri kullanımı

- Toplanan veri, katılımcının telefonunun hangi salondaki Bluetooth
  vericilere ne kadar yakın olduğuna dair **salon düzeyinde** sinyal
  ölçümüdür — hassas konum (GPS koordinatı) toplanmaz, yalnızca "hangi
  salon" bilgisi çıkarılır.
- Bu veri yalnızca katılım analizi ve raporlama amacıyla kullanılır.
- Katılımcı uygulamasında **başka bir katılımcının** kişisel bilgisi
  (e-posta, telefon, hangi salonda olduğu) hiçbir zaman görünmez — bu,
  sunucu tarafında yapısal olarak garanti edilir.
- Takip, yalnızca uygulama kuruluyken ve izin verildiğinde çalışır;
  katılımcı istediği an konum iznini kapatabilir.

## Teknik güvence

- **Backend + panel + mobil uygulama**, modern ve yaygın destekli
  teknolojilerle (NestJS, Next.js, Flutter, MySQL) inşa edildi — üçü de
  aktif bakımlı, geniş topluluk desteğine sahip.
- **Çevrimdışı-önce tasarım**: mobil uygulama hem katılım verisini hem
  bilimsel programı yerel olarak saklar; ağ kesintisi veri kaybına yol
  açmaz.
- **Karar mantığı tek elden**: salon tespiti, giriş/çıkış kararları
  tamamen sunucuda üretilir ve versiyonlanır — algoritma iyileştirmeleri
  geçmiş veriyi bozmadan devreye alınabilir.
- **Gerçek cihaz ve gerçek kongre verisiyle doğrulandı**: sistem, gerçek
  bir kongrenin bilimsel programı ve gerçek beacon donanımıyla uçtan uca
  test edilmiştir (bkz. `docs/KARARLAR.md`).
