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
import '../data/bootstrap_repository.dart';
import '../domain/beacon_observation_service.dart';

final deviceRepositoryProvider = Provider<DeviceRepository>((ref) {
  return DeviceRepository(ref.watch(apiClientProvider));
});

final bootstrapRepositoryProvider = Provider<BootstrapRepository>((ref) {
  return BootstrapRepository(ref.watch(apiClientProvider));
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

  // `state` (Riverpod'un izlenebilir alani) ile AYNI degeri tasiyan duz bir
  // Dart alani - `onDispose` icinde `state`i OKUYAMAYIZ (Riverpod 3.x, yasam
  // dongusu geri cagirmalari icinde Ref/state kullanimini ACIKCA yasakliyor:
  // "Cannot use Ref or modify other providers inside life-cycles"). Bu, ilk
  // widget testinde TAM OLARAK bu sekilde yakalandi - bkz. test/widget_test.dart.
  BeaconObservationService? _service;

  @override
  BeaconObservationService? build() {
    ref.listen<AsyncValue<MeResponse?>>(authSessionProvider, (previous, next) {
      unawaited(_sync(next));
    }, fireImmediately: true);

    ref.onDispose(() {
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
      await _stopService();
      return;
    }

    final activeCongressId = me.activeCongressId!;

    // Zaten dogru kongre icin calisiyor - hicbir sey yapma. Bu kontrol,
    // /auth/me her tazelendiginde (ör. baska bir ekrandan refresh) servisin
    // gereksiz yere durdurulup yeniden baslatilmasini ONLER.
    if (_service != null && _startedForCongressId == activeCongressId) {
      if (kDebugMode) {
        debugPrint(
          '[ObservationLifecycle] NO-OP - $activeCongressId icin zaten '
          'calisiyor (ör. /auth/me sekme gecisi/kabuk yeniden cizimiyle '
          'tazelendi ama servis DURMADI/YENIDEN BASLAMADI)',
        );
      }
      return;
    }

    await _stopService();

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
      apiClient: ref.read(apiClientProvider),
      appVersion: packageInfo.version,
    );
    _startedForCongressId = activeCongressId;
    _service = service;
    state = service;
    if (kDebugMode) {
      debugPrint(
        '[ObservationLifecycle] START congressId=$activeCongressId '
        'deviceId=$deviceId beaconUuid=$beaconUuid (uygulama kok '
        'seviyesinde - ekran/sekme gecisleri bunu DURDURMAZ)',
      );
    }
    await service.start();
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
      return device.id;
    } catch (_) {
      return null;
    }
  }

  Future<void> _stopService() async {
    final current = _service;
    if (current == null) return;
    final previousCongressId = _startedForCongressId;
    _service = null;
    _startedForCongressId = null;
    state = null;
    if (kDebugMode) {
      debugPrint(
        '[ObservationLifecycle] STOP congressId=$previousCongressId '
        '(oturum dustu / kongre degisti / uygulama kapaniyor)',
      );
    }
    await current.stop();
  }
}

final observationLifecycleProvider =
    NotifierProvider<ObservationLifecycleNotifier, BeaconObservationService?>(
      ObservationLifecycleNotifier.new,
    );
