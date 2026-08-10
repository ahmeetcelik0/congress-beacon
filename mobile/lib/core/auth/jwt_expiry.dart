import 'dart:convert';

/// Bir JWT'nin `exp` alaninin YEREL degerlendirmesinin sonucu.
///
/// **Guvenlik gerekcesi (bkz. Faz 7.1 talimati):** bu, imza DOGRULAMASI
/// DEGILDIR ve amaclamaz - token zaten CIHAZDA bizim tarafimizdan
/// saklaniyor, burada savunulacak bir "sunucu mu istemci mi" saldirgan
/// modeli yok. Amac yalnizca, agsizken kullanicinin DAHA ONCE mesru
/// sekilde gordugu KENDI verisini (onbellekteki `MeResponse`) gostermeye
/// devam edip etmeyecegimize karar vermek. Sunucu tarafi iptal
/// (`tokenVersion` artisi - ör. sifre degisikligi) ag donduğu an zaten
/// `/auth/me` ile uygulanir; bu yerel kontrol yalnizca AG YOKKEN devreye
/// giren bir "makul sure gecti mi" filtresidir.
enum JwtStatus {
  /// `exp` cozumlendi ve (tolerans dahil) henuz gecmedi.
  valid,

  /// `exp` cozumlendi ve gecti.
  expired,

  /// Token cozumlenemedi (bicimsiz, `exp` alani yok/turu yanlis) - GUVENLI
  /// TARAF secilir: cagiran taraf bunu `expired` gibi ele almalidir.
  undecodable,
}

/// JWT'nin orta bolumunu (payload) cozup bir Map olarak doner; cozumlenemezse
/// `null` doner. `checkJwtExpiry`/`extractJwtSubject` ayni mantigi tekrar
/// etmesin diye paylasilan tek nokta.
Map<String, dynamic>? _decodeJwtPayload(String token) {
  final parts = token.split('.');
  if (parts.length != 3) return null;
  try {
    // JWT payload'i dolgusuz (unpadded) base64url'dir - `base64Url.decode`
    // dogrudan cagrilirsa "Invalid base64" firlatir. `normalize` eksik
    // dolguyu (`=`) ekler VE `-`/`_` karakterlerini cozumler.
    final normalized = base64Url.normalize(parts[1]);
    final payloadBytes = base64Url.decode(normalized);
    final payload = jsonDecode(utf8.decode(payloadBytes));
    return payload is Map<String, dynamic> ? payload : null;
  } catch (_) {
    return null;
  }
}

/// Saklanan JWT'nin `exp` (Unix saniye, UTC) alanini okuyup yerel saatle
/// karsilastirir. Ek paket GEREKTIRMEZ - yalnizca `dart:convert`.
///
/// [clockSkewTolerance]: cihaz saati sunucuyla birebir senkron olmayabilir
/// diye kucuk bir pay - varsayilan 60 saniye.
JwtStatus checkJwtExpiry(
  String token, {
  DateTime? now,
  Duration clockSkewTolerance = const Duration(seconds: 60),
}) {
  final payload = _decodeJwtPayload(token);
  if (payload == null) return JwtStatus.undecodable;

  final expValue = payload['exp'];
  if (expValue is! int) return JwtStatus.undecodable;

  final expiresAt = DateTime.fromMillisecondsSinceEpoch(
    expValue * 1000,
    isUtc: true,
  );
  final effectiveNow = (now ?? DateTime.now()).toUtc();
  if (effectiveNow.isAfter(expiresAt.add(clockSkewTolerance))) {
    return JwtStatus.expired;
  }
  return JwtStatus.valid;
}

/// JWT'nin `sub` (kullanici ID) alanini okur - cevrimdisi onbellekteki
/// `MeResponse`in, token'i SAKLAYAN kullaniciya ait olup olmadigini
/// dogrulamak icin kullanilir (bkz. Faz 7.1 talimati "farkli bir hesapla
/// giris yapildiginda eski onbellek kullanilmamali"). Cozumlenemezse `null`.
String? extractJwtSubject(String token) {
  final payload = _decodeJwtPayload(token);
  final sub = payload?['sub'];
  return sub is String ? sub : null;
}
