import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/content_cache_service.dart';
import 'api_client.dart';
import 'api_client_provider.dart';

/// Mobil `/mobile/*` yanit modellerinin ortak sozlesmesi - hepsi
/// `generatedAt` tasir (bkz. `shared/openapi.yaml`, tum `Mobile*Response`
/// semalari). Ekranlarda "Son guncelleme: ..." metni bunun uzerinden
/// gosterilir - onbellekten mi agdan mi geldigine BAKMAKSIZIN her zaman
/// SUNUCUNUN urettigi zamani yansitir.
abstract class HasGeneratedAt {
  DateTime get generatedAt;
}

/// Onbellek-once-agdan-dogrula deseninin TEK yazildigi yer (bkz. Faz 7
/// talimati §1 "Bu mantigi her ekranda ayri ayri yazma"). Alt siniflar
/// yalnizca HANGI ucun cagrilacagini, JSON'un nasil modele cevrilecegini
/// ve onbellegin kalici mi gecici mi olacagini bildirir - okuma/yazma/ETag/
/// hata-durumunda-eski-veriyi-koruma mantigi burada tek seferliktir.
///
/// Akis: `build()` once onbellegi (varsa) okuyup ondan turetilen degeri
/// DENER; onun uzerine agdan (varsa ETag ile) taze veri ceker. Ag
/// basarisiz olursa VE onbellekte gecerli bir deger varsa, o deger
/// SESSIZCE state olarak donuyor - `AsyncError` ATILMAZ (ekran hata
/// yerine "bayat ama gorunur" veri gosterir, tazelik `generatedAt` ile
/// anlasilir). Onbellek de yoksa hata yukari (AsyncError) tasinir - ekran
/// bunu gercek bir "tekrar dene" durumu olarak gosterir.
abstract class CachedContentNotifier<T extends HasGeneratedAt>
    extends AsyncNotifier<T> {
  /// Onbellek anahtari - COGU durumda aktif kongre ID'sini icermelidir
  /// (bkz. alt siniflarin `cacheKey` uygulamasi) ki kongre degistiginde
  /// BASKA bir kongrenin onbellegi yanlislikla gosterilmesin.
  String get cacheKey;

  /// true ise `content_cache/<key>.json` dosyasina kalici yazilir VE ETag
  /// ile dogrulanir (yalniz buyuk/nadiren-degisen icerik icin - bkz. Faz 7
  /// talimati §1). false ise yalnizca bellek-ici, ETag GONDERILMEZ (kucuk
  /// icerik uclari - her seferinde tam yanit cekilir, basit tutulur).
  bool get isPersistent;

  T decode(dynamic json);

  /// `etag`, yalnizca `isPersistent` true ise VE onbellekte bir tane varsa
  /// doludur - alt siniflar bunu `ApiClient.get(..., etag: etag)`e
  /// AYNEN gecirir.
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag);

  @override
  Future<T> build() => _load();

  /// Asagi cekerek yenile (pull-to-refresh) BUNU cagirir - onbellegi
  /// TEKRAR okur (degismedi, no-op) ve agi tekrar dener. Ayri bir
  /// "zorla yenile" bayragina gerek yok: ETag zaten "degismediyse 304"
  /// davranisini sagliyor, gercekten degistiyse normal akis zaten
  /// yeni veriyi yazar. `ref.invalidateSelf()` + `future` beklemek,
  /// Riverpod'un KENDI "onceki veriyi yukleme sirasinda da eristirilebilir
  /// tut" mekanizmasini kullanir (bkz. `AsyncValue.copyWithPrevious` -
  /// bu, paket DISINDAN dogrudan cagrilamayan bir ic API, framework
  /// invalidation sirasinda bunu KENDISI uygular).
  Future<void> refresh() async {
    ref.invalidateSelf();
    await future;
  }

  Future<T> _load() async {
    final cache = ref.read(contentCacheServiceProvider);
    final cached = isPersistent
        ? await cache.readPersistent(cacheKey)
        : cache.readMemory(cacheKey);

    T? cachedValue;
    if (cached != null) {
      try {
        cachedValue = decode(cached.json);
      } catch (_) {
        // Bozuk/eski semali onbellek girdisi - yoksay, agdan devam et.
        cachedValue = null;
      }
    }

    final client = ref.read(apiClientProvider);
    try {
      final result = await fetchRemote(
        client,
        isPersistent ? cached?.etag : null,
      );

      if (result.notModified) {
        // Sunucu 304 dedi: onbellekteki veri hala guncel. Teoride
        // `cachedValue` burada mutlaka dolu olmali (304 almak icin zaten
        // bir ETag gondermistik, bu da onbellekte veri oldugu anlamina
        // gelir) - yine de savunmaci bir null kontrolu birakiliyor.
        if (cachedValue != null) return cachedValue;
        throw ApiException(
          'Sunucu değişiklik olmadığını bildirdi ama yerel önbellek boş.',
        );
      }

      final value = decode(result.data);
      final envelope = CacheEnvelope(
        json: result.data,
        etag: result.etag,
        cachedAt: DateTime.now(),
      );
      if (isPersistent) {
        await cache.writePersistent(cacheKey, envelope);
      } else {
        cache.writeMemory(cacheKey, envelope);
      }
      return value;
    } on ApiException {
      // Ag hatasi (cevrimdisi, zaman asimi, sunucu 5xx...) - onbellekte
      // gecerli bir deger VARSA ona sessizce dus (ekran hata yerine bayat
      // veri + tazelik bilgisi gosterir). Onbellek de yoksa hata gercek:
      // yukari firlatilir, `AsyncValue.guard`/varsayilan AsyncNotifier
      // hata yakalamasi bunu `AsyncError`e cevirir.
      if (cachedValue != null) return cachedValue;
      rethrow;
    }
  }
}
