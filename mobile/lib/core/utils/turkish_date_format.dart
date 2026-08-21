/// Turkce tarih/saat bicimlendirme yardimcilari - Faz 7'deki tum ekranlar
/// (Ana Sayfa, Program, icerik listeleri) ayni bicimi kullanir, her ekran
/// kendi `_turkishMonths` dizisini TEKRAR TANIMLAMAZ.
///
/// ONEMLI: API'den gelen TUM tarihler UTC'dir (bkz. docs/decisions.md,
/// Faz 5 "Tarihler her zaman UTC ISO 8601"). Buradaki her fonksiyon
/// `toIstanbulTime()` cagirir - cagiran taraf AYRICA yerel saate
/// cevirmemeli (cift donusum yanlis sonuc verir).
///
/// Faz 12: eskiden `.toLocal()` kullaniliyordu - bu, CIHAZIN kendi saat
/// dilimini varsayiyordu. Yurt disindaki bir katilimcinin telefonunda
/// (ör. Almanya, UTC+2/+1) kongre saatleri KAYARDI - Turkiye'de 15:00
/// baslayan bir oturum o telefonda "14:00" gibi yanlis gorunurdu (bkz.
/// docs/decisions.md "Faz 12"). `toIstanbulTime()` cihaz saatinden
/// TAMAMEN BAGIMSIZ, HER ZAMAN Turkiye saatini gosterir.
library;

/// Turkiye 2016'dan beri kalici UTC+3 uyguluyor, yaz saati DEGISTIRMIYOR -
/// bu yuzden sabit +3 saatlik bir kaydirma burada GUVENLE kullanilabilir.
/// `timezone` paketi BILINCLI olarak eklenmedi (uygulama boyutunu
/// buyutur, IANA veritabaninin tamamini tasimaya bu tek sabit icin
/// gerek yok) - bu sabit backend/panelin `Europe/Istanbul` (Intl/IANA
/// uzerinden hesaplanan) karsiligiyla AYNI sonucu uretir, yalnizca
/// yontemi farkli (bkz. docs/decisions.md "Faz 12").
const _istanbulOffset = Duration(hours: 3);

/// UTC bir `DateTime`i "Istanbul'da gorunen saat" bilesenlerini (gun/ay/
/// yil/saat/dakika) DOGRU tasiyan bir `DateTime`e cevirir. DONEN DEGER
/// HALA `isUtc == true` olarak isaretlidir - bu BILINCLI: yalnizca
/// `.day`/`.hour`/`.weekday` gibi GETTER'LARI okumak icin kullanilir
/// (UTC DateTime'larin getter'lari HICBIR donusum yapmadan ham degeri
/// okur, bu yuzden dogru sonucu verir). Bu deger ASLA API'ye geri
/// gonderilmemeli veya gercek bir zaman ani gibi KARSILASTIRILMAMALI -
/// yalnizca EKRANDA GOSTERIM icindir.
DateTime toIstanbulTime(DateTime dateTime) {
  return dateTime.toUtc().add(_istanbulOffset);
}

const _turkishMonths = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

// DateTime.weekday 1=Pazartesi..7=Pazar doner - index 0 buna gore kaydirilir.
const _turkishWeekdays = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
];

String _twoDigits(int value) => value.toString().padLeft(2, '0');

/// Program ekranindaki gun sekmeleri icin KISA tarih - "09.04" (gun.ay,
/// YIL YOK). Kongre suresi tipik olarak tek yil icinde gectigi ve sekmeler
/// dar bir yatay serit icinde yan yana durdugu icin yil bilgisi gereksiz
/// kalabalik yaratir (bkz. Faz 10 talimati, "hangisi dar ekranda daha
/// okunur" degerlendirmesi - docs/decisions.md).
String formatShortDate(DateTime date) {
  final local = toIstanbulTime(date);
  return '${_twoDigits(local.day)}.${_twoDigits(local.month)}';
}

/// Program ekranindaki gun sekmeleri icin tarih - "09.04.2026" (gun.ay.yil).
String formatShortDateWithYear(DateTime date) {
  final local = toIstanbulTime(date);
  return '${_twoDigits(local.day)}.${_twoDigits(local.month)}.${local.year}';
}

/// "Perşembe"
String formatTurkishWeekday(DateTime date) {
  final local = toIstanbulTime(date);
  return _turkishWeekdays[local.weekday - 1];
}

/// Bir DateTime'i GUN GRUPLAMA anahtarina cevirir - saat/dakika/saniye
/// ATILIR, yalnizca YEREL takvim gunu kalir ("2026-04-09"). Program
/// ekranindaki gun sekmeleri VE oturumlarin hangi sekmeye ait oldugunun
/// filtrelenmesi AYNI anahtari kullanir (bkz. features/program/
/// presentation/program_page.dart) - boylece kanonik semada OPSIYONEL olan
/// `day.label`e (bkz. docs/decisions.md "Faz 4d") DEGIL, HER ZAMAN gercek
/// `startTime`e dayanir; `day.label` hic set edilmemis olsa bile gun
/// sekmeleri dogru calisir.
String dayKey(DateTime dateTime) {
  final local = toIstanbulTime(dateTime);
  return '${local.year.toString().padLeft(4, '0')}-${_twoDigits(local.month)}-${_twoDigits(local.day)}';
}

/// "15 Mayıs 2026"
String formatTurkishDate(DateTime date) {
  final local = toIstanbulTime(date);
  return '${local.day} ${_turkishMonths[local.month - 1]} ${local.year}';
}

/// "15–18 Mayıs 2026" (ikisi de doluysa), tek biri doluysa onu, ikisi de
/// bosea "Tarih belirtilmemiş" doner.
String formatTurkishDateRange(DateTime? start, DateTime? end) {
  if (start == null && end == null) return 'Tarih belirtilmemiş';
  if (start != null && end != null) {
    return '${formatTurkishDate(start)} – ${formatTurkishDate(end)}';
  }
  return formatTurkishDate(start ?? end!);
}

/// "14:30"
String formatTime(DateTime dateTime) {
  final local = toIstanbulTime(dateTime);
  return '${_twoDigits(local.hour)}:${_twoDigits(local.minute)}';
}

/// "14:30–15:15"
String formatTimeRange(DateTime start, DateTime end) {
  return '${formatTime(start)}–${formatTime(end)}';
}

/// Onbellek/tazelik bandi icin - bugunse yalnizca saat, degilse tarih+saat.
/// "Son güncelleme: 14:32" / "Son güncelleme: 15 Mayıs, 14:32"
///
/// Faz 12: "bugun mu" karsilastirmasi da kongre (Istanbul) saatine gore
/// yapilir - `now` da `toIstanbulTime`den geciyor. Ikisi FARKLI referans
/// (biri Istanbul, digeri cihaz) kullansaydi, yurt disindaki bir cihazda
/// "bugun" yanlis hesaplanabilirdi (bkz. docs/decisions.md "Faz 12").
String formatUpdatedAt(DateTime generatedAt) {
  final local = toIstanbulTime(generatedAt);
  final now = toIstanbulTime(DateTime.now());
  final isToday =
      local.year == now.year &&
      local.month == now.month &&
      local.day == now.day;
  if (isToday) {
    return 'Son güncelleme: ${formatTime(generatedAt)}';
  }
  return 'Son güncelleme: ${formatTurkishDate(generatedAt)}, ${formatTime(generatedAt)}';
}
