import type ExcelJS from 'exceljs';

// Faz 13b: bu sayfa DB sorgusu YAPMAZ - defterdeki her sayfanın her
// sütununu elle belgeleyen statik bir referans. Sıra, ilgili sayfanın
// gerçek sütun sırasıyla AYNI tutuldu (o sayfadaki `setupDataWorksheet`
// çağrısından kopyalandı) - biri değişirse diğeri de güncellenmeli.
type SozlukSatiri = {
  sayfa: string;
  sutun: string;
  anlami: string;
  birim: string;
  yorumlama: string;
};

const SOZLUK: SozlukSatiri[] = [
  // --- Kapak ---
  {
    sayfa: 'Kapak',
    sutun: '(tüm sayfa)',
    anlami:
      'Kongre bilgisi, uygulanan filtreler, sayfa bazında satır sayıları ve veri tazeliği uyarıları.',
    birim: '-',
    yorumlama:
      'Kendi kendini açıklayan bir özet sayfasıdır (Alan/Değer biçiminde) - ayrıca sözlük satırı gerektirmez.',
  },
  // --- Ham Gözlem ---
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Kullanıcı / userId',
    anlami: 'Gözlemi gönderen katılımcı.',
    birim: '-',
    yorumlama: '-',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Cihaz',
    anlami: 'Gözlemi gönderen fiziksel cihazın kimliği (deviceId).',
    birim: '-',
    yorumlama: 'Cihaz ve RSSI sayfasındaki deviceId ile eşleşir.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Gözlem zamanı (TR)',
    anlami:
      "Cihazın beacon'ı GÖRDÜĞÜ an (mobil tarafta üretilen zaman damgası).",
    birim: 'TR saati',
    yorumlama:
      'Analiz için asıl referans budur - sunucuya varış GECİKMELİ olabilir, gerçek "ne zaman oradaydı" sorusunun cevabı bu sütundur.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Sunucuya varış (TR)',
    anlami: 'Gözlemin sunucuya ULAŞTIĞI an.',
    birim: 'TR saati',
    yorumlama:
      'Gözlem zamanından ÇOK sonraysa (bkz. Gecikme sütunu) cihaz çevrimdışı kuyrukta bekletmiş demektir - bu normal bir durumdur, hata değildir.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Gecikme (sn)',
    anlami: 'Sunucuya varış ile gözlem zamanı arasındaki fark.',
    birim: 'saniye',
    yorumlama:
      'Büyük değerler (dakikalar/saatler) çevrimdışı kuyruktan gelen veriyi gösterir - kapak sayfasındaki "veri hâlâ akıyor olabilir" uyarısıyla birlikte okunmalı.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'observationId / batchId / UUID',
    anlami:
      "Gözlemin ve ait olduğu gönderim partisinin benzersiz kimlikleri, beacon'ın yayınladığı ham UUID.",
    birim: '-',
    yorumlama:
      'Teknik izleme/hata ayıklama için - analizde genelde kullanılmaz.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Major / Minor',
    anlami: "Beacon'ın yayınladığı ham kimlik numaraları.",
    birim: '-',
    yorumlama:
      'Beacon eşleşmediğinde (bkz. aşağı) salonu bulmanın tek yolu budur.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Beacon eşleşti',
    anlami:
      "Bu UUID/major/minor kombinasyonu kayıtlı bir Beacon'a karşılık geliyor mu.",
    birim: '1/0',
    yorumlama:
      '0 ise bu gözlem HİÇBİR salona bağlanamaz - Veri Kalitesi raporundaki "eşleşmeyen gözlem" oranıyla ilişkilidir.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'beaconId / Beacon etiketi / Atanan salon',
    anlami:
      'Eşleşen beacon kaydı, onun okunabilir etiketi ve o an atandığı salon.',
    birim: '-',
    yorumlama: 'beaconId boşsa eşleşme yok demektir (yukarıdaki sütuna bakın).',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'RSSI (dBm)',
    anlami: 'Ölçülen sinyal gücü.',
    birim: 'dBm',
    yorumlama:
      '0 veya pozitifse GERÇEK bir ölçüm DEĞİLDİR (bkz. Sentinel sütunu ve tuzak #3) - negatif ne kadar küçükse sinyal o kadar zayıftır.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'Sentinel',
    anlami:
      'RSSI >= 0 mı - yani "bu taramada güvenilir ölçüm alınamadı" sinyali mi.',
    birim: '1/0',
    yorumlama: '1 ise bu satır algoritma tarafından ATILIR, ortalamaya girmez.',
  },
  {
    sayfa: 'Ham Gözlem',
    sutun: 'txPower / Uygulama sürümü',
    anlami:
      "Beacon'ın yayınladığı verici gücü, gözlemi gönderen mobil uygulamanın sürümü.",
    birim: '-',
    yorumlama:
      'Teknik bağlam - kalibrasyon ve sürüm bazlı sorun ayıklama için.',
  },
  // --- Dakika Özeti ---
  {
    sayfa: 'Dakika Özeti',
    sutun: 'Dakika (TR)',
    anlami: 'Gözlemlerin YUVARLANDIĞI dakika damgası.',
    birim: 'TR saati',
    yorumlama:
      'Aynı kullanıcı/beacon için aynı dakikadaki TÜM okumalar tek satırda özetlenir.',
  },
  {
    sayfa: 'Dakika Özeti',
    sutun: 'Beacon / Atanan salon',
    anlami: 'Bu dakikada görülen beacon ve onun atandığı salon.',
    birim: '-',
    yorumlama: '-',
  },
  {
    sayfa: 'Dakika Özeti',
    sutun: 'Okuma sayısı / Geçerli okuma / Sentinel sayısı',
    anlami:
      'Bu dakikadaki toplam okuma, RSSI<0 olan (geçerli) okuma ve RSSI>=0 olan (sentinel) okuma sayıları.',
    birim: 'adet',
    yorumlama:
      'Geçerli okuma azsa o dakikaki istatistikler az sayıya dayanır, güvenilirliği düşüktür.',
  },
  {
    sayfa: 'Dakika Özeti',
    sutun: 'Ortalama RSSI / Medyan RSSI / Min RSSI / Max RSSI',
    anlami:
      'O dakikadaki GEÇERLİ (sentinel hariç) RSSI değerlerinin istatistikleri.',
    birim: 'dBm',
    yorumlama:
      'Medyan, ortalamadan belirgin şekilde farklıysa o dakikada ani/aykırı bir sıçrama olmuş demektir.',
  },
  // --- Salon Ziyaretleri ---
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'Başlangıç / Bitiş / Son doğrulama (TR)',
    anlami:
      'Ziyaretin başladığı an, kapandığı an (açıksa boş) ve son kez algoritma tarafından doğrulandığı an.',
    birim: 'TR saati',
    yorumlama:
      'Açık ziyaretlerde "Bitiş" YOKTUR - "Süre" o durumda ŞU ANA KADAR geçen süredir, gerçek kalış süresi değildir (bkz. tuzak #6).',
  },
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'Süre (dk) / Süre',
    anlami:
      'Ziyaretin dakika cinsinden sayısal ve okunabilir ("1 sa 23 dk") gösterimi.',
    birim: 'dakika',
    yorumlama:
      'Kapanış tipi "Bayat temizlik" ise bu süre TAHMİNDİR, ölçülmemiştir.',
  },
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'Açık mı',
    anlami: 'Ziyaret hâlâ devam ediyor mu (kapanmamış).',
    birim: '1/0',
    yorumlama:
      'Rapor oluşturulduğu ANDAKİ durumu yansıtır, gerçek zamanlı değildir.',
  },
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'Güven düzeyi',
    anlami:
      'Ziyaretin başladığı andaki güven yüzdesinden türetilen etiket (yüksek/orta/düşük).',
    birim: '-',
    yorumlama:
      "Geriye dönük uyumluluk için tutulur - ham güven puanı Giriş-Çıkış Olayları'ndadır.",
  },
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'Algoritma sürümü',
    anlami: 'Bu ziyareti üreten karar algoritmasının sürümü.',
    birim: '-',
    yorumlama: 'v2/v3 arası GÜVEN PUANLARI karşılaştırılamaz (bkz. tuzak #2).',
  },
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'Kapanış tipi',
    anlami:
      '"Normal çıkış" (algoritma kapattı), "Bayat temizlik" (arka plan işi kapattı, kişi doğrulama göndermeyi bırakmış) veya "Hâlâ açık".',
    birim: '-',
    yorumlama: 'Bayat temizlikte son birkaç dakika TAHMİNDİR (bkz. tuzak #6).',
  },
  {
    sayfa: 'Salon Ziyaretleri',
    sutun: 'O sıradaki oturum',
    anlami: 'Ziyaretle EN ÇOK ÖRTÜŞEN program oturumu (varsa).',
    birim: '-',
    yorumlama:
      'Birden fazla oturumla kesişiyorsa en çok örtüşen seçilir, diğerleri gösterilmez.',
  },
  // --- Kullanıcı-Salon Özeti ---
  {
    sayfa: 'Kullanıcı-Salon Özeti',
    sutun: 'Ziyaret sayısı / Toplam süre / Ortalama ziyaret / En uzun ziyaret',
    anlami:
      'Bu kullanıcının bu salondaki TÜM ziyaretlerinin toplamı/ortalaması/en uzunu.',
    birim: 'adet / dakika',
    yorumlama: '-',
  },
  {
    sayfa: 'Kullanıcı-Salon Özeti',
    sutun: 'İlk giriş / Son çıkış (TR)',
    anlami: 'Bu kullanıcının bu salondaki EN ERKEN girişi ve EN GEÇ çıkışı.',
    birim: 'TR saati',
    yorumlama: 'Açık ziyaretlerde "Son çıkış" boş kalabilir.',
  },
  {
    sayfa: 'Kullanıcı-Salon Özeti',
    sutun: 'Kullanıcı toplamına oranı (%)',
    anlami:
      'Bu salonda geçirilen sürenin, kullanıcının TÜM salonlardaki toplam süresine oranı.',
    birim: '%',
    yorumlama:
      'Bir katılımcının zamanının çoğunu hangi salonda geçirdiğini gösterir.',
  },
  // --- Giriş-Çıkış Olayları ---
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Tip',
    anlami: 'GİRİŞ mi ÇIKIŞ mı.',
    birim: '-',
    yorumlama:
      'Her ziyaretin bir GİRİŞ olayı, kapandıysa bir de ÇIKIŞ olayı vardır.',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Güven puanı (%)',
    anlami:
      'Kararın verildiği andaki güven yüzdesi (v3) ya da ham dB marjı (v2).',
    birim: '% (v3) / dBm (v2)',
    yorumlama:
      'Algoritma sürümüne bakmadan karşılaştırma YAPILAMAZ (bkz. tuzak #1 ve #2).',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Kazanan salon ortalama dBm',
    anlami:
      'Karar anında eşiği geçen (kazanan) salonun yumuşatılmış (EMA) ortalama sinyal gücü.',
    birim: 'dBm',
    yorumlama:
      "Hiçbir salon eşiği geçmediyse (ÇIKIŞ'ta candidates boş olabilir) bu hücre boştur.",
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'En yakın rakiple fark (%)',
    anlami: 'Eşiği geçen ilk iki salon arasındaki güven yüzdesi farkı.',
    birim: '%',
    yorumlama:
      'Küçükse (belirsizlik marjının altındaysa) karar "belirsiz" sayılmıştır (bkz. yandaki sütun).',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Belirsiz miydi',
    anlami: 'Karar anında iki salon neredeyse eşit mi görünüyordu.',
    birim: '1/0',
    yorumlama:
      'Trace\'te doğrudan YOKTUR, "en yakın rakiple fark < belirsizlik marjı" formülüyle TÜRETİLİR (bkz. Kongre Ayarları sayfası).',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Elenen aykırı okuma',
    anlami:
      'Bu karara giden pencerede Hampel filtresiyle elenmiş RSSI okuma sayısı.',
    birim: 'adet',
    yorumlama: 'Yüksekse o anki sinyal ortamı gürültülü demektir.',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Görülen salon sayısı / Eşiği geçen salon sayısı',
    anlami:
      'Karar anında sinyali algılanan TÜM salon sayısı ve bunlardan eşiği geçenlerin sayısı.',
    birim: 'adet',
    yorumlama:
      'Görülen > eşiği geçen ise bazı salonlar aday olmuş ama yeterince güçlü olmamış demektir.',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'İkinci salon adı / İkinci salon yüzdesi',
    anlami: 'Güven yüzdesine göre İKİNCİ sıradaki salon ve onun yüzdesi.',
    birim: '-',
    yorumlama:
      'Bu salon eşiği GEÇMEMİŞ de olabilir - "kazanan" olduğu anlamına gelmez.',
  },
  {
    sayfa: 'Giriş-Çıkış Olayları',
    sutun: 'Tam karar izi (JSON) / İz kesildi mi',
    anlami:
      'Kararın TAM ham verisi (tüm adaylar, tüm beacon okumaları) JSON metni olarak.',
    birim: '-',
    yorumlama:
      'Excel hücresi 32.767 karakterle sınırlıdır - bu sınırı aşan izler kesilir, kesilme "İz kesildi mi" sütununda 1 ile işaretlenir (sessizce kesilmez). Detaylı inceleme için Karar Detayı sayfasına bakın.',
  },
  // --- Karar Detayı ---
  {
    sayfa: 'Karar Detayı',
    sutun: 'Sıra',
    anlami:
      'Bu adayın, o karardaki güven yüzdesine göre azalan sıradaki konumu (1 = en yüksek yüzde).',
    birim: '-',
    yorumlama:
      'Sıra 1 olması KAZANAN olduğu anlamına GELMEZ - eşiği geçmemiş olabilir (bkz. yandaki sütun).',
  },
  {
    sayfa: 'Karar Detayı',
    sutun: 'Kazanan mı',
    anlami:
      'Bu aday, eşiği geçen adaylar arasında yüzdesi en yüksek olan mı (yani gerçek karar bu mu).',
    birim: '1/0',
    yorumlama:
      'Bir olayda EN FAZLA bir satır 1 olabilir; hiçbiri 1 değilse o olayda kazanan salon yoktu.',
  },
  {
    sayfa: 'Karar Detayı',
    sutun: 'Ortalama EMA (dBm) / Yüzde',
    anlami:
      'Bu salon için yumuşatılmış ortalama sinyal gücü ve tüm adaylar arasındaki güven yüzdesi.',
    birim: 'dBm / %',
    yorumlama: 'Yüzde GÖRECELİDİR - tek aday varsa %100 çıkar (bkz. tuzak #1).',
  },
  {
    sayfa: 'Karar Detayı',
    sutun: 'Eşiği geçti mi / Salon eşiği (dBm)',
    anlami:
      'Bu adayın kendi salon eşiğini (Hall.rssiThreshold) geçip geçmediği ve o eşiğin değeri.',
    birim: '1/0 / dBm',
    yorumlama:
      'Gerçek koruma HER ZAMAN bu eşiktir, yüzde değil (bkz. tuzak #1).',
  },
  {
    sayfa: 'Karar Detayı',
    sutun:
      'Katkı veren beacon sayısı / Kabul edilen okuma sayısı / Bayat (grace) beacon sayısı',
    anlami:
      "Bu salon-adayı için hesaba katılan TÜM beacon'lar, bunlardan taze/geçerli okuma vereni ve son bilinen (donmuş) değeriyle katılanı.",
    birim: 'adet',
    yorumlama:
      'Bayat sayısı yüksekse bu salonun kararı TAZE veriye değil ESKİ bir değere dayanıyor demektir (bkz. tuzak #4).',
  },
  // --- Cihaz ve RSSI ---
  {
    sayfa: 'Cihaz ve RSSI',
    sutun: 'Platform / Cihaz modeli / İşletim sistemi sürümü / Uygulama sürümü',
    anlami: 'Cihazın işletim sistemi, modeli, OS ve uygulama sürümü.',
    birim: '-',
    yorumlama:
      'Belirli bir cihaz/sürüm kombinasyonunda sinyal kalitesi sistematik olarak düşükse donanım/yazılım kaynaklı bir sorun olabilir.',
  },
  {
    sayfa: 'Cihaz ve RSSI',
    sutun: 'Toplam okuma / Sentinel sayısı / Sentinel oranı / Geçerli okuma',
    anlami:
      'Bu cihaz-beacon çifti için toplam okuma ve bunların ne kadarının sentinel (geçersiz) olduğu.',
    birim: 'adet / %',
    yorumlama:
      'Sentinel oranı yüksekse bu cihaz sıkça "ölçüm alamıyor" demektir - tuzak #3.',
  },
  {
    sayfa: 'Cihaz ve RSSI',
    sutun: 'Ortalama RSSI / Medyan RSSI / Standart sapma / Min RSSI / Max RSSI',
    anlami:
      'Bu cihaz-beacon çiftinin GEÇERLİ RSSI değerlerinin istatistiksel özeti.',
    birim: 'dBm',
    yorumlama:
      'Standart sapma yüksekse sinyal İSTİKRARSIZ demektir (kararsız bir konumda, kalabalık arasında vb.).',
  },
  {
    sayfa: 'Cihaz ve RSSI',
    sutun: 'İlk okuma / Son okuma (TR)',
    anlami: 'Bu cihaz-beacon çiftinin bu aralıktaki ilk ve son gözlem zamanı.',
    birim: 'TR saati',
    yorumlama: '-',
  },
  {
    sayfa: 'Cihaz ve RSSI',
    sutun: 'Beklenen okuma sayısı / Gerçekleşme oranı (%)',
    anlami:
      '(Son okuma - İlk okuma) / gönderim aralığına göre teorik olarak beklenen okuma sayısı ve gerçek/beklenen oranı.',
    birim: 'adet / %',
    yorumlama:
      'Düşükse cihaz veri KAYBEDİYOR demektir - bu durumda "kişi salonda değildi" YORUMU YANLIŞTIR, "cihaz susmuştu" olabilir (bkz. tuzak #7).',
  },
  // --- Gönderim Sağlığı ---
  {
    sayfa: 'Gönderim Sağlığı',
    sutun: 'batchId / clientBatchId',
    anlami:
      'Sunucu tarafında ve mobil cihaz tarafında üretilen parti kimlikleri.',
    birim: '-',
    yorumlama:
      "Aynı clientBatchId farklı batchId'lerle GÖRÜNMEMELİDİR - görünüyorsa yineleme koruması incelenmeli.",
  },
  {
    sayfa: 'Gönderim Sağlığı',
    sutun: 'Kabul edilen / Yinelenen / Reddedilen',
    anlami:
      'Bu partideki gözlemlerden kaçının kabul edildiği, yinelenen (zaten vardı) sayıldığı veya reddedildiği.',
    birim: 'adet',
    yorumlama:
      'Reddedilen sürekli yüksekse mobil-sunucu arasında bir uyumsuzluk (saat kayması, format hatası) olabilir.',
  },
  {
    sayfa: 'Gönderim Sağlığı',
    sutun:
      'Önceki partiden geçen süre (sn) / Beklenen aralık (sn) / Sapma (sn)',
    anlami:
      'Aynı cihazın bir önceki partisiyle arasındaki gerçek süre, teorik beklenen süre ve aradaki fark.',
    birim: 'saniye',
    yorumlama:
      'Sapma büyükse (dakikalar) o cihaz o süre boyunca veri GÖNDEREMEMİŞ demektir - bir kesinti işaretidir.',
  },
  // --- Katılımcılar ---
  {
    sayfa: 'Katılımcılar',
    sutun: 'Kongre kaydı aktif mi',
    anlami:
      'Bu katılımcının kongre kaydının hâlâ aktif olup olmadığı (pasif kayıtlar iptal/silinmiş sayılır).',
    birim: '1/0',
    yorumlama:
      'Pasif bir kayıtta geçmiş gözlem/ziyaret verisi YİNE DE görünebilir - kayıt durumu geçmiş veriyi silmez.',
  },
  {
    sayfa: 'Katılımcılar',
    sutun: 'Cihaz sayısı',
    anlami:
      'Bu kullanıcıya kayıtlı TOPLAM cihaz sayısı (bu aralıkla sınırlı değil).',
    birim: 'adet',
    yorumlama:
      "Birden fazlaysa Cihaz ve RSSI sayfasında bu kullanıcının birden fazla deviceId'si görünür.",
  },
  {
    sayfa: 'Katılımcılar',
    sutun: 'İlk görülme / Son görülme (TR)',
    anlami: 'Bu aralıktaki ilk ve son BeaconObservation zamanı.',
    birim: 'TR saati',
    yorumlama:
      'İkisi de boşsa bu kullanıcıdan bu aralıkta HİÇ veri gelmemiştir.',
  },
  {
    sayfa: 'Katılımcılar',
    sutun: 'Toplam gözlem sayısı / Toplam ziyaret sayısı / Toplam süre',
    anlami:
      'Bu aralıktaki toplam ham gözlem sayısı, salon ziyareti sayısı ve toplam kalış süresi.',
    birim: 'adet / dakika',
    yorumlama:
      'Gözlem sayısı yüksek ama ziyaret sayısı düşükse kişi çoğu zaman tek bir salonda kalmış demektir.',
  },
  {
    sayfa: 'Katılımcılar',
    sutun: 'Gönderilen bildirim sayısı / Açılan bildirim sayısı',
    anlami:
      'Bu kullanıcıya bu aralıkta gönderilen ve açılan (okunan) bildirim sayısı.',
    birim: 'adet',
    yorumlama: '-',
  },
  // --- Beacon Envanteri ---
  {
    sayfa: 'Beacon Envanteri',
    sutun: 'Atandığı salon / hallId',
    anlami:
      "Beacon'ın EN GÜNCEL atandığı salon (aktifse o, değilse en son atanan).",
    birim: '-',
    yorumlama: 'Boşsa bu beacon HİÇ bir salona atanmamıştır.',
  },
  {
    sayfa: 'Beacon Envanteri',
    sutun: 'Salon kapasitesi / Salon eşiği (dBm) / Beacon eşiği (dBm)',
    anlami:
      "Salonun fiziksel kapasitesi, salon seviyesi RSSI eşiği ve (varsa) bu beacon'a özel eşik.",
    birim: 'kişi / dBm',
    yorumlama:
      'Beacon eşiği doluysa salon eşiğinin YERİNE bu değer kullanılır.',
  },
  {
    sayfa: 'Beacon Envanteri',
    sutun: 'Aktif mi / Kurulum tarihi / Kaldırılma tarihi',
    anlami:
      'Bu atamanın şu an geçerli olup olmadığı, kurulduğu ve (varsa) kaldırıldığı tarih.',
    birim: '1/0 / TR saati',
    yorumlama:
      'Aktif değilse ve kaldırılma tarihi boşsa, atama PASİFLEŞTİRİLMİŞ ama kaldırma tarihi girilmemiştir.',
  },
  {
    sayfa: 'Beacon Envanteri',
    sutun: 'Kalibrasyon notu / Yerleşim notu',
    anlami: 'Saha ekibinin elle girdiği serbest metin notlar.',
    birim: '-',
    yorumlama: '-',
  },
  {
    sayfa: 'Beacon Envanteri',
    sutun: 'Bu aralıktaki okuma sayısı / Ortalama RSSI (bu aralıkta)',
    anlami:
      "Bu beacon'ın bu tarih aralığında ürettiği TOPLAM (filtre uygulanmamış) gözlem sayısı ve ortalama sinyali.",
    birim: 'adet / dBm',
    yorumlama:
      'Sıfırsa bu beacon bu aralıkta HİÇ görülmemiştir - fiziksel olarak kapalı/arızalı olabilir.',
  },
  // --- Kongre Ayarları ---
  {
    sayfa: 'Kongre Ayarları',
    sutun: 'Ayar / Değer / Ne işe yarar',
    anlami:
      'Bu kongrenin panelden ayarlanabilir algoritma parametreleri ve kod içi sabitler.',
    birim: '-',
    yorumlama:
      'İki farklı test turunu karşılaştırırken ÖNCE bu sayfadaki değerlerin AYNI olduğunu doğrulayın (bkz. tuzak #2 ve sayfanın kendi açıklaması).',
  },
  // --- Program ---
  {
    sayfa: 'Program',
    sutun: 'Süre (dk) / Sunum sayısı / Anahtar kelimeler',
    anlami:
      'Oturumun dakika cinsinden süresi, içerdiği sunum sayısı ve tanımlı anahtar kelimeleri.',
    birim: 'dakika / adet',
    yorumlama: '-',
  },
  {
    sayfa: 'Program',
    sutun: 'Bu aralıkta salonda bulunan tekil kişi sayısı',
    anlami:
      'Bu oturumun süresiyle KESİŞEN ziyaretlerdeki FARKLI katılımcı sayısı.',
    birim: 'kişi',
    yorumlama:
      'Salonun toplam ziyaret sayısı DEĞİLDİR (bir kişi birden fazla ziyaret üretmiş olabilir) - GERÇEK katılım büyüklüğünü gösterir.',
  },
];

const TUZAKLAR: string[] = [
  '"Güven yüzdesi = sinyal kalitesi" -> HAYIR. Salonlar arası GÖRECELİ bir orandır. Tek salon görünüyorsa sinyal -95 dBm bile olsa %100 çıkar. Gerçek koruma her zaman salon eşiğidir (Hall.rssiThreshold), yüzde değil.',
  '"Güven puanları karşılaştırılabilir" -> v2 ham dB marjı, v3 yüzde. Algoritma sürümü sütununa bakmadan karşılaştırma yapılamaz.',
  '"Her RSSI bir ölçümdür" -> rssi >= 0 ölçüm DEĞİL, "bu taramada değer alınamadı" sinyalidir. Algoritma bunları atar.',
  '"Karar anındaki tüm değerler o an okundu" -> Grace süresi içindeki beacon\'lar son bilinen DONMUŞ değerle hesaba katılır (bayat/stale sütunu).',
  '"NO_SIGNAL = kişi ortamda yok" -> İki farklı gerçekliği birleştirir: zayıf sinyal (koridor, kalibrasyonsuz bölge) ve tamamen susmuş cihaz.',
  '"Ziyaret süresi = gerçek kalış süresi" -> Açık ziyaretlerde "şu ana kadar"dır; bayat kapatmada son 5 dakika ölçülmemiş, tahmin edilmiştir (kapanış tipi sütunu).',
  '"Gözlem yoksa kişi orada değildi" -> Telefon susmuş da olabilir. Cihaz ve RSSI sayfasındaki gerçekleşme oranına bak.',
];

export function yazVeriSozlugu(
  workbook: ExcelJS.stream.xlsx.WorkbookWriter,
): void {
  const worksheet = workbook.addWorksheet('Veri Sözlüğü');
  worksheet.getColumn(1).width = 22;
  worksheet.getColumn(2).width = 36;
  worksheet.getColumn(3).width = 50;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 50;

  const baslik = (text: string) => {
    const row = worksheet.addRow([text]);
    row.font = { bold: true, size: 13 };
    row.commit();
  };
  const bosSatir = () => worksheet.addRow([]).commit();

  baslik('Bölüm 1 — Sütun Sözlüğü');
  const headerRow = worksheet.addRow([
    'Sayfa',
    'Sütun',
    'Anlamı',
    'Birim',
    'Nasıl yorumlanır',
  ]);
  headerRow.font = { bold: true };
  headerRow.commit();

  for (const satir of SOZLUK) {
    const row = worksheet.addRow([
      satir.sayfa,
      satir.sutun,
      satir.anlami,
      satir.birim,
      satir.yorumlama,
    ]);
    row.commit();
  }

  bosSatir();
  bosSatir();
  baslik('Bölüm 2 — Yorumlama Tuzakları');
  const not = worksheet.addRow([
    'Bu bölüm, bu projede SAHADA fiilen yanlış anlaşılmış yedi konuyu listeler.',
  ]);
  not.font = { italic: true };
  not.commit();
  bosSatir();

  TUZAKLAR.forEach((tuzak, index) => {
    const row = worksheet.addRow([`${index + 1}.`, tuzak]);
    row.getCell(1).font = { bold: true };
    row.commit();
  });

  worksheet.commit();
}
