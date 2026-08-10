/// Turkce tarih/saat bicimlendirme yardimcilari - Faz 7'deki tum ekranlar
/// (Ana Sayfa, Program, icerik listeleri) ayni bicimi kullanir, her ekran
/// kendi `_turkishMonths` dizisini TEKRAR TANIMLAMAZ.
///
/// ONEMLI: API'den gelen TUM tarihler UTC'dir (bkz. docs/decisions.md,
/// Faz 5 "Tarihler her zaman UTC ISO 8601"). Buradaki her fonksiyon
/// `.toLocal()` cagirir - cagiran taraf AYRICA yerel saate cevirmemeli
/// (cift donusum yanlis sonuc verir).
library;

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

String _twoDigits(int value) => value.toString().padLeft(2, '0');

/// "15 Mayıs 2026"
String formatTurkishDate(DateTime date) {
  final local = date.toLocal();
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
  final local = dateTime.toLocal();
  return '${_twoDigits(local.hour)}:${_twoDigits(local.minute)}';
}

/// "14:30–15:15"
String formatTimeRange(DateTime start, DateTime end) {
  return '${formatTime(start)}–${formatTime(end)}';
}

/// Onbellek/tazelik bandi icin - bugunse yalnizca saat, degilse tarih+saat.
/// "Son güncelleme: 14:32" / "Son güncelleme: 15 Mayıs, 14:32"
String formatUpdatedAt(DateTime generatedAt) {
  final local = generatedAt.toLocal();
  final now = DateTime.now();
  final isToday =
      local.year == now.year &&
      local.month == now.month &&
      local.day == now.day;
  if (isToday) {
    return 'Son güncelleme: ${formatTime(generatedAt)}';
  }
  return 'Son güncelleme: ${formatTurkishDate(generatedAt)}, ${formatTime(generatedAt)}';
}
