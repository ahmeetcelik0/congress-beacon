import 'package:url_launcher/url_launcher.dart';

/// Sponsor web sitesi / mekan haritası / telefon eylemleri icin ortak
/// acma yardimcisi - Faz 7'deki 3 farkli ekran (Sponsorlar, Mekanlar,
/// Genel Bilgi'nin Markdown baglantilari) ayni deneme/hata yutma
/// mantigini TEKRARLAMAZ. Acilamayan bir baglanti SESSIZCE yutulur -
/// kullaniciya crash/hata ekrani yerine dokunma hicbir sey yapmamis
/// gibi kalir (bkz. Faz 7 talimati §6 "hata durumunda sessiz dusus").
Future<void> openExternalUrl(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    // Kasitli olarak yutuldu, bkz. yukaridaki yorum.
  }
}

Future<void> openPhoneNumber(String phoneNumber) =>
    openExternalUrl('tel:$phoneNumber');
