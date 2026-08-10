import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

/// Bir onbellek girdisinin tasidigi HAM veri + (varsa) ETag + bu veri
/// CIHAZA ne zaman yazildigi. `cachedAt` sunucunun `generatedAt`inden
/// FARKLIDIR - biri yerel yazma zamani, digeri sunucudaki veri uretim
/// zamani; ekranlarda gosterilen "son guncelleme" metni sunucunun
/// `generatedAt`ini kullanir (bkz. `CachedContentNotifier`), `cachedAt`
/// yalnizca bu serviste bozuk/eksik girdi ayiklamasi icin kullanilir.
class CacheEnvelope {
  const CacheEnvelope({
    required this.json,
    required this.etag,
    required this.cachedAt,
  });

  final dynamic json;
  final String? etag;
  final DateTime cachedAt;

  Map<String, dynamic> _toStorageJson() => {
    'json': json,
    'etag': etag,
    'cachedAt': cachedAt.toIso8601String(),
  };

  factory CacheEnvelope._fromStorageJson(Map<String, dynamic> stored) {
    return CacheEnvelope(
      json: stored['json'],
      etag: stored['etag'] as String?,
      cachedAt: DateTime.parse(stored['cachedAt'] as String),
    );
  }
}

/// Mobil icerik onbelleklemesi icin TEK erisim noktasi - her ekran kendi
/// dosya/Map okuma-yazma mantigini AYRI AYRI yazmaz (bkz. Faz 7 talimati
/// §1). Iki katman sunar:
/// - **Kalici (dosya)**: uygulamanin belge dizininde `content_cache/<key>.json`
///   olarak saklanir, uygulama kapansa/silinip acilsa bile hayatta kalir.
///   Yalnizca `/mobile/program` gibi buyuk ve ETag destekli uclar icin.
/// - **Gecici (bellek-ici)**: sadece `Map` - uygulama surecinde yasar,
///   kapaninca kaybolur. Kucuk icerik uclari icin yeterli (bkz. Faz 7
///   talimati §1 "basit tut" notu) - her ac ilista bir kez agdan
///   cekilmeleri sorun degil, kalici depolamaya deger degil.
class ContentCacheService {
  ContentCacheService();

  final Map<String, CacheEnvelope> _memory = {};
  Directory? _cacheDir;

  Future<Directory> _resolveCacheDir() async {
    final existing = _cacheDir;
    if (existing != null) return existing;
    final docsDir = await getApplicationDocumentsDirectory();
    final dir = Directory('${docsDir.path}/content_cache');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    _cacheDir = dir;
    return dir;
  }

  File _fileFor(Directory dir, String key) => File('${dir.path}/$key.json');

  /// Dosya yoksa, okunamazsa veya govdesi bozuksa (yarim yazim, gecersiz
  /// JSON) sessizce `null` doner - cagiran taraf bunu "onbellek yok" olarak
  /// ele alip agdan devam eder; bozuk dosya kalici bir hataya DONUSMEZ.
  Future<CacheEnvelope?> readPersistent(String key) async {
    try {
      final dir = await _resolveCacheDir();
      final file = _fileFor(dir, key);
      if (!await file.exists()) return null;
      final raw = await file.readAsString();
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return CacheEnvelope._fromStorageJson(decoded);
    } catch (_) {
      return null;
    }
  }

  /// Yazma hatasi (disk dolu, izin sorunu vb.) SESSIZCE yutulur - bir
  /// sonraki basarili cagri yine dener; onbellege yazamamak, o anki
  /// ekranin agdan gelen veriyi gostermesini ENGELLEMEMELI.
  Future<void> writePersistent(String key, CacheEnvelope envelope) async {
    try {
      final dir = await _resolveCacheDir();
      final file = _fileFor(dir, key);
      await file.writeAsString(jsonEncode(envelope._toStorageJson()));
    } catch (_) {
      // Kasitli olarak yutuldu, bkz. yukaridaki yorum.
    }
  }

  CacheEnvelope? readMemory(String key) => _memory[key];

  void writeMemory(String key, CacheEnvelope envelope) {
    _memory[key] = envelope;
  }
}

final contentCacheServiceProvider = Provider<ContentCacheService>((ref) {
  return ContentCacheService();
});
