import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/device_info_helper.dart';
import '../../../core/config/package_info_provider.dart';
import '../../../core/network/api_client_provider.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../models/auth_models.dart';
import '../../auth/application/auth_session_provider.dart';
import '../../devices/data/device_repository.dart';
import '../../notifications/application/push_notification_lifecycle_provider.dart';
import '../data/bootstrap_repository.dart';
import '../data/sqlite_observation_queue_store.dart';
import '../domain/beacon_observation_service.dart';
import '../domain/observation_queue_store.dart';

final deviceRepositoryProvider = Provider<DeviceRepository>((ref) {
  return DeviceRepository(ref.watch(apiClientProvider));
});

final bootstrapRepositoryProvider = Provider<BootstrapRepository>((ref) {
  return BootstrapRepository(ref.watch(apiClientProvider));
});

// Faz 8: uygulama omru boyunca TEK bir ornek - hem bu bildirici (kapsam
// degisiminde temizlik icin) hem de `BeaconObservationService` (yazma/okuma
// icin) AYNI kalici kuyruga erisir. Depolama SQLite oldugu icin (tek dosya)
// birden fazla ornek olsa da fiziksel olarak ayni veriye yazardi, ama tek
// Dart nesnesi paylasmak DB baglantisini bir kez acar.
final observationQueueStoreProvider = Provider<ObservationQueueStore>((ref) {
  return SqliteObservationQueueStore();
});

/// `BeaconObservationService`nin YAŞAM DÖNGÜSÜNÜ uygulama seviyesinde
/// yönetir (bkz. Faz 6 talimatı §7 - "servisin ömrü bir ekranın ömrüne
/// bağlı olmamalı"). Bu sınıf servisin İÇ mantığına HİÇ dokunmaz, yalnızca
/// KİMİN ne zaman `start()`/`stop()` çağıracağına karar verir:
///
/// - Token + deviceId + seçili kongre hepsi doluyken BAŞLAR.
/// - Oturum düşünce (401/çıkış) veya kongre seçimi kalkınca DURUR.
/// - Aktif kongre DEĞİŞTİĞİNDE durdurup yeni kongre için yeniden başlar
///   (observation'lar doğru kongreye yazılsın).
/// - Sekme değişimi, ekran geçişi, kabuğun yeniden kurulması bu döngüyü
///   ETKİLEMEZ - hiçbir widget bu provider'ı `dispose` edip durdurmaz;
///   yalnızca uygulama kökünde (`main.dart`) bir kez izlenir ve kalıcı kalır.
class ObservationLifecycleNotifier extends Notifier<BeaconObservationService?> {
  String? _startedForCongressId;
  // Faz 8: kongre AYNI kalsa bile FARKLI bir kullanici giris yaparsa
  // (ör. ayni cihazda hesap degisimi) kalici kuyrugun eski kullaniciya
  // ait kalmasini onlemek icin ayrica takip edilir (bkz. _sync ve
  // _clearQueueForScopeChange).
  String? _startedForUserId;
  String? _beaconUuid;

  // `state` (Riverpod'un izlenebilir alani) ile AYNI degeri tasiyan duz bir
  // Dart alani - `onDispose` icinde `state`i OKUYAMAYIZ (Riverpod 3.x, yasam
  // dongusu geri cagirmalari icinde Ref/state kullanimini ACIKCA yasakliyor:
  // "Cannot use Ref or modify other providers inside life-cycles"). Bu, ilk
  // widget testinde TAM OLARAK bu sekilde yakalandi - bkz. test/widget_test.dart.
  BeaconObservationService? _service;

  // Faz 6.2: servisin `deviceInvalid` durumuna gectigini yakalamak icin
  // (bkz. asagidaki _onServiceState / _recoverFromInvalidDevice).
  StreamSubscription<ObservationServiceState>? _serviceStateSubscription;
  bool _isRecoveringDevice = false;
  int _consecutiveDeviceRecoveryFailures = 0;
  DateTime? _deviceRecoveryBackoffUntil;
  static const int _maxConsecutiveDeviceRecoveryFailures = 3;
  static const Duration _deviceRecoveryBackoff = Duration(seconds: 60);

  @override
  BeaconObservationService? build() {
    ref.listen<AsyncValue<MeResponse?>>(authSessionProvider, (previous, next) {
      unawaited(_sync(next));
    }, fireImmediately: true);

    ref.onDispose(() {
      unawaited(_serviceStateSubscription?.cancel());
      final current = _service;
      if (current != null) {
        unawaited(current.stop());
      }
    });

    return null;
  }

  Future<void> _sync(AsyncValue<MeResponse?> authState) async {
    final me = authState.value;
    final hasValidSession =
        me != null && !me.mustChangePassword && me.activeCongressId != null;

    if (!hasValidSession) {
      // `stop()` ONCE cagrilir - servisin tamponundaki gonderilmemis birkac
      // kaydin, olasi bir kapsam temizliginden ONCE kalici kuyruga yazilmis
      // olmasini garantiler (bkz. BeaconObservationService.stop() yorumu).
      await _stopService();

      // Faz 8: kuyruk YALNIZCA kullanici ACIKCA "Cikis Yap" bastiysa
      // temizlenir - 401/token suresi yerel olarak dolmus gibi ISTEMSIZ
      // oturum dususlerinde DOKUNULMAZ (bkz. explicitLogoutSignalProvider
      // yorumu - ayni kullanici tekrar giris yaparsa kuyruk KAYBOLMASIN).
      if (ref.read(explicitLogoutSignalProvider)) {
        ref.read(explicitLogoutSignalProvider.notifier).consume();
        await _clearQueueForScopeChange('cikis yapildi');
      }
      return;
    }

    final activeCongressId = me.activeCongressId!;
    final activeUserId = me.user.id;

    // Zaten dogru kongre VE kullanici icin calisiyor - hicbir sey yapma. Bu
    // kontrol, /auth/me her tazelendiginde (ör. baska bir ekrandan refresh)
    // servisin gereksiz yere durdurulup yeniden baslatilmasini ONLER.
    if (_service != null &&
        _startedForCongressId == activeCongressId &&
        _startedForUserId == activeUserId) {
      if (kDebugMode) {
        debugPrint(
          '[ObservationLifecycle] NO-OP - $activeCongressId icin zaten '
          'calisiyor (ör. /auth/me sekme gecisi/kabuk yeniden cizimiyle '
          'tazelendi ama servis DURMADI/YENIDEN BASLAMADI)',
        );
      }
      return;
    }

    // Faz 8: kongre veya kullanici GERCEKTEN degistiyse (ilk baslatma
    // DEGIL - onceki deger null degilse), kalici kuyruktaki eski-kapsamli
    // kayitlarin YANLIS kongreye/kullaniciya gonderilmesini onlemek icin
    // temizlenmesi gerekir (bkz. Faz 8 talimati §5). Karar, `_stopService()`
    // eski degerleri SIFIRLAMADAN ONCE, burada verilir.
    String? scopeChangeReason;
    if (_startedForUserId != null && _startedForUserId != activeUserId) {
      scopeChangeReason = 'farkli kullanici girisi';
    } else if (_startedForCongressId != null &&
        _startedForCongressId != activeCongressId) {
      scopeChangeReason = 'kongre degisimi';
    }

    await _stopService();

    if (scopeChangeReason != null) {
      await _clearQueueForScopeChange(scopeChangeReason);
    }

    final storage = ref.read(secureStorageProvider);
    var deviceId = await storage.getDeviceId();
    deviceId ??= await _registerDevice();
    if (deviceId == null) {
      // Cihaz kaydi basarisiz oldu (ag hatasi vb.) - servis baslatilamaz.
      // Bir sonraki senkronizasyon tetiklendiginde (ör. /auth/me yeniden
      // cagrildiginda) tekrar denenir.
      return;
    }

    final beaconUuid = await _resolveBeaconUuid(activeCongressId);
    if (beaconUuid == null) {
      // Gecerli bir UUID yoksa (ilk kez, ag yok, cevrimdisi onbellek de
      // bos) servis KESINLIKLE baslatilmaz - yanlis/varsayilan bir UUID'yle
      // sessizce "calisiyor gibi gorunup" hicbir beacon bulamamak, hic
      // baslamamaktan kotudur (bkz. Faz 6.1 talimati §2). Bir sonraki
      // senkronizasyonda tekrar denenir.
      if (kDebugMode) {
        debugPrint(
          '[ObservationLifecycle] BASLATILAMADI - congressId=$activeCongressId '
          'icin gecerli bir beaconUuid yok (bootstrap basarisiz + cevrimdisi '
          'onbellek de bos/farkli kongreye ait)',
        );
      }
      return;
    }

    final packageInfo = await ref.read(packageInfoProvider.future);
    final service = BeaconObservationService(
      deviceId: deviceId,
      beaconUuid: beaconUuid,
      congressId: activeCongressId,
      userId: activeUserId,
      queueStore: ref.read(observationQueueStoreProvider),
      apiClient: ref.read(apiClientProvider),
      appVersion: packageInfo.version,
    );
    _startedForCongressId = activeCongressId;
    _startedForUserId = activeUserId;
    _beaconUuid = beaconUuid;
    _service = service;
    state = service;
    _serviceStateSubscription?.cancel();
    _serviceStateSubscription = service.stateStream.listen(_onServiceState);
    if (kDebugMode) {
      debugPrint(
        '[ObservationLifecycle] START congressId=$activeCongressId '
        'userId=$activeUserId deviceId=$deviceId beaconUuid=$beaconUuid '
        '(uygulama kok seviyesinde - ekran/sekme gecisleri bunu DURDURMAZ)',
      );
    }
    await service.start();
  }

  /// Faz 8: kalici kuyrugu TAMAMEN temizler - kongre/kullanici degisimi
  /// veya acik cikista cagrilir (bkz. `_sync` ve explicitLogoutSignalProvider
  /// yorumu). Hangi kayitlarin silinecegine karar vermek (yani NE ZAMAN
  /// cagrilacagini bilmek) CAGIRAN tarafin sorumlulugu - depolama katmani
  /// (`ObservationQueueStore.clearForScopeChange`) kosulsuz siler.
  Future<void> _clearQueueForScopeChange(String reason) async {
    final deleted = await ref
        .read(observationQueueStoreProvider)
        .clearForScopeChange();
    if (kDebugMode) {
      debugPrint(
        '[ObservationQueue] $deleted kayit SILINDI (kapsam degisimi: $reason)',
      );
    }
  }

  // Faz 6.2: backend'in "bu cihaz bu kullaniciya ait degil" (403) hatasini
  // servis KENDI KARAR VERMEDEN dogrudan bildirir (bkz.
  // beacon_observation_service.dart ObservationServiceStatus.deviceInvalid)
  // - kurtarma eylemi (yeniden kayit) BURADA, cagiran katmanda yapilir.
  void _onServiceState(ObservationServiceState serviceState) {
    if (serviceState.status != ObservationServiceStatus.deviceInvalid) return;
    unawaited(_recoverFromInvalidDevice());
  }

  Future<void> _recoverFromInvalidDevice() async {
    // Ayni anda birden fazla kurtarma denemesi calismasin (deviceInvalid
    // durumu, cozulene kadar HER basarisiz batch denemesinde tekrar
    // yayinlanir - bkz. _trySendBatch).
    if (_isRecoveringDevice) return;

    final backoffUntil = _deviceRecoveryBackoffUntil;
    if (backoffUntil != null && DateTime.now().isBefore(backoffUntil)) {
      return; // hala bekleme suresinde - saniyede bir deneme YAPILMAZ.
    }

    final failingService = _service;
    final congressId = _startedForCongressId;
    final userId = _startedForUserId;
    final beaconUuid = _beaconUuid;
    if (failingService == null ||
        congressId == null ||
        userId == null ||
        beaconUuid == null) {
      return;
    }

    _isRecoveringDevice = true;
    try {
      if (kDebugMode) {
        debugPrint(
          '[ObservationLifecycle] KURTARMA - cihaz kaydi gecersiz (403), '
          'yeniden kaydolunuyor (deneme '
          '${_consecutiveDeviceRecoveryFailures + 1}/'
          '$_maxConsecutiveDeviceRecoveryFailures)',
        );
      }

      await ref.read(secureStorageProvider).deleteDeviceId();
      final newDeviceId = await _registerDevice();

      if (newDeviceId == null) {
        _consecutiveDeviceRecoveryFailures++;
        if (_consecutiveDeviceRecoveryFailures >=
            _maxConsecutiveDeviceRecoveryFailures) {
          _deviceRecoveryBackoffUntil = DateTime.now().add(
            _deviceRecoveryBackoff,
          );
          if (kDebugMode) {
            debugPrint(
              '[ObservationLifecycle] KURTARMA DURDURULDU - '
              '$_consecutiveDeviceRecoveryFailures ardisik basarisiz '
              'deneme, $_deviceRecoveryBackoff sonra tekrar denenecek.',
            );
          }
        } else if (kDebugMode) {
          debugPrint(
            '[ObservationLifecycle] KURTARMA BASARISIZ - cihaz yeniden '
            'kaydedilemedi (ag hatasi olabilir), bir sonraki basarisiz '
            'gonderimde tekrar denenecek.',
          );
        }
        return;
      }

      // `stop()` tampondaki gonderilmemis birkac kaydi kalici kuyruga
      // yazar (bkz. BeaconObservationService.stop() yorumu) - Faz 8
      // ONCESINDE burada `pendingSnapshots`/`initialQueue` ile ELLE
      // tasinan kuyruk artik GEREKSIZ: kuyruk congressId+userId'ye gore
      // KALICI oldugu icin, YENI servis AYNI kongre/kullanici icin ayni
      // kalici kuyruga otomatik erisir - degisen tek sey deviceId.
      await _stopService();

      final packageInfo = await ref.read(packageInfoProvider.future);
      final newService = BeaconObservationService(
        deviceId: newDeviceId,
        beaconUuid: beaconUuid,
        congressId: congressId,
        userId: userId,
        queueStore: ref.read(observationQueueStoreProvider),
        apiClient: ref.read(apiClientProvider),
        appVersion: packageInfo.version,
      );
      _startedForCongressId = congressId;
      _startedForUserId = userId;
      _beaconUuid = beaconUuid;
      _service = newService;
      state = newService;
      _serviceStateSubscription?.cancel();
      _serviceStateSubscription = newService.stateStream.listen(
        _onServiceState,
      );
      _consecutiveDeviceRecoveryFailures = 0;
      _deviceRecoveryBackoffUntil = null;

      if (kDebugMode) {
        final pendingCount = await ref
            .read(observationQueueStoreProvider)
            .count();
        debugPrint(
          '[ObservationLifecycle] KURTARMA BASARILI - yeni '
          'deviceId=$newDeviceId ile kalici kuyruktaki $pendingCount '
          'kayitla yeniden baslatildi.',
        );
      }
      await newService.start();
    } finally {
      _isRecoveringDevice = false;
    }
  }

  /// Kongrenin beacon UUID'sini `/mobile/bootstrap`'tan alir. Basarili
  /// olursa (kongre kimligiyle birlikte) yerel olarak saklar. Ag hatasinda
  /// - "cevrimdisi dayaniklilik" (bkz. Faz 6.1 talimati §3) - AYNI kongre
  /// icin daha once kaydedilmis bir UUID varsa onu doner; farkli bir
  /// kongreye ait veya hic yoksa `null` doner (cagiran taraf servisi
  /// baslatmaz).
  Future<String?> _resolveBeaconUuid(String congressId) async {
    final storage = ref.read(secureStorageProvider);
    try {
      final bootstrap = await ref
          .read(bootstrapRepositoryProvider)
          .fetch(congressId);
      final beaconUuid = bootstrap.congress.beaconUuid;
      await storage.saveBeaconUuid(congressId, beaconUuid);
      return beaconUuid;
    } catch (_) {
      final cached = await storage.getBeaconUuidForCongress(congressId);
      if (kDebugMode) {
        debugPrint(
          '[ObservationLifecycle] bootstrap basarisiz - cevrimdisi onbellek '
          '(congressId=$congressId): ${cached ?? "YOK"}',
        );
      }
      return cached;
    }
  }

  Future<String?> _registerDevice() async {
    try {
      final deviceInfo = await collectDeviceInfo();
      final packageInfo = await ref.read(packageInfoProvider.future);
      final device = await ref
          .read(deviceRepositoryProvider)
          .register(
            platform: Platform.isIOS ? 'IOS' : 'ANDROID',
            deviceModel: deviceInfo.model,
            osVersion: deviceInfo.osVersion,
            appVersion: packageInfo.version,
          );
      await ref.read(secureStorageProvider).saveDeviceId(device.id);
      // Faz 9: yeni deviceId, sunucudaki ESKI push token kaydiyla ARTIK
      // eslesmiyor (Faz 6.2 kurtarma akisinda YENI bir Device satiri
      // olusturulur) - GUNCEL FCM token'i bu yeni deviceId ile tekrar
      // gonderilir. Firebase hic baslatilmamissa (izin/yapilandirma yok)
      // sessizce hicbir sey yapmaz (bkz. PushNotificationService).
      unawaited(
        ref
            .read(pushNotificationServiceProvider)
            .reRegisterCurrentTokenIfAvailable(device.id),
      );
      return device.id;
    } catch (_) {
      return null;
    }
  }

  Future<void> _stopService() async {
    final current = _service;
    if (current == null) return;
    final previousCongressId = _startedForCongressId;
    final previousUserId = _startedForUserId;
    await _serviceStateSubscription?.cancel();
    _serviceStateSubscription = null;
    _service = null;
    _startedForCongressId = null;
    _startedForUserId = null;
    _beaconUuid = null;
    state = null;
    if (kDebugMode) {
      debugPrint(
        '[ObservationLifecycle] STOP congressId=$previousCongressId '
        'userId=$previousUserId (oturum dustu / kongre degisti / '
        'uygulama kapaniyor)',
      );
    }
    // Faz 8: `stop()` diskteki tampon yazimini BEKLER (await) - buradaki
    // `await` kaldirilirsa, olasi bir sonraki kapsam temizligi (bkz. `_sync`)
    // henuz yazilmamis kayitlari KACIRABILIR (bkz. BeaconObservationService.
    // stop() yorumu).
    await current.stop();
  }
}

final observationLifecycleProvider =
    NotifierProvider<ObservationLifecycleNotifier, BeaconObservationService?>(
      ObservationLifecycleNotifier.new,
    );
