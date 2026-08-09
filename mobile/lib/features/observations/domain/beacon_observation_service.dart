import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_beacon/flutter_beacon.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/observation_models.dart';

enum ObservationServiceStatus {
  initializing,
  active,
  error,
  unauthorized,
  // Faz 6.2: backend, gonderilen deviceId'nin bu kullaniciya ait
  // OLMADIGINI (403 - kayit hic yok VEYA baska kullaniciya ait) soylerse
  // buraya gecilir. `unauthorized` (401, token gecersiz) ile KARISTIRILMAZ -
  // ikisinin kurtarma yolu farkli: 401 oturumu dusurur, bu ise yalnizca
  // cihaz kaydini yeniler (bkz. ObservationLifecycleNotifier, bu servisin
  // KENDISI bir kurtarma eylemi YAPMAZ, yalnizca durumu bildirir).
  deviceInvalid,
}

class ObservationServiceState {
  const ObservationServiceState({
    required this.status,
    required this.pendingSnapshotCount,
    this.lastBatchResult,
    this.errorMessage,
  });

  final ObservationServiceStatus status;
  final int pendingSnapshotCount;
  final String? lastBatchResult;
  final String? errorMessage;
}

class BeaconObservationService with WidgetsBindingObserver {
  // `this._appVersion` onerisi UYGULANMADI: disariya ACIK bir ozel
  // (private) parametre adi dayatirdi, disaridan `appVersion:` olarak
  // cagirilamazdi (public API kirilirdi). Ayni sebeple `beaconUuid` da
  // `this._beaconUuid` olarak alinmadi.
  BeaconObservationService({
    required this.deviceId,
    required String beaconUuid,
    ApiClient? apiClient,
    String appVersion = '1.0.0',
    // Faz 6.2: cihaz kaydi gecersizlesip yeniden kaydolunca (bkz.
    // ObservationServiceStatus.deviceInvalid), cagiran taraf ESKI servisin
    // henuz gonderilmemis kuyrugunu BURADAN yeni servise tasiyabilsin diye -
    // aksi halde kurtarma sirasinda o gozlemler sessizce kaybolurdu. Karar
    // mantigina (hangi observation ne zaman kuyruga girer/gonderilir)
    // dokunmaz, yalnizca BASLANGIC kuyrugunu doldurur.
    List<ObservationSnapshot> initialQueue = const [],
  }) : _apiClient = apiClient ?? ApiClient(),
       // ignore: prefer_initializing_formals
       _appVersion = appVersion,
       // ignore: prefer_initializing_formals
       _beaconUuid = beaconUuid,
       _queue = List.of(initialQueue);

  final String deviceId;
  final ApiClient _apiClient;
  // Faz 6: artik cagiran taraftan (gercek PackageInfo.version) geliyor -
  // yalnizca veri kaynagi degisti, asagidaki hicbir zamanlama/karar mantigi
  // DOKUNULMADI (bkz. docs/decisions.md, Faz 6 kisiti §1).
  final String _appVersion;
  final _uuid = const Uuid();

  // Faz 6.1: artik cagiran taraftan (backend `/mobile/bootstrap`'in
  // dondurdugu `Congress.beaconUuid`) geliyor - eskiden burada sabit bir
  // POC UUID'si vardi ('E2C56DB5-DFFB-48D2-B060-D0F5A71096E0'), bu da
  // yalnizca o UUID'ye sahip kongrede tesadufen calisiyordu, farkli bir
  // kongrede sessizce hicbir beacon bulamazdi. `required` olmasi bilerek -
  // gecersiz/bos bir varsayilanla sessizce "calisiyor gibi gorunup" hicbir
  // sey bulamamak, hic baslamamaktan kotudur (bkz. Faz 6.1 talimati §2).
  final String _beaconUuid;

  // Foreground duty-cycle: surekli tarama yerine periyodik pencere.
  // Pil uyarisini ve gereksiz surekli Bluetooth taramasini onlemek icin.
  static const Duration _foregroundCycleInterval = Duration(seconds: 10);
  static const Duration _foregroundRangingWindow = Duration(seconds: 4);

  // Arka planda ranging'i DURDURMUYORUZ (bkz. _enterBackgroundMode) - bu,
  // uygulamayi iOS'ta arka planda canli tutan mekanizmanin ta kendisi. Pil
  // tasarrufu, gonderim sikligini seyreltmekten geliyor.
  //
  // Gonderim araligi artik sabit degil: panelden (kongre ayari) kontrol
  // edilir ve her batch yanitinda backend'den gelen guncel degerle
  // senkronize edilir (bkz. _trySendBatch). Baslangicta 10sn varsayiliyla
  // baslar, ilk yanit geldiginde gercek degere gunceller.
  static const Duration _defaultBatchInterval = Duration(seconds: 10);
  static const int _minIntervalSeconds = 5;
  static const int _maxIntervalSeconds = 300;
  Duration _batchInterval = _defaultBatchInterval;

  final List<ObservationSnapshot> _queue;
  bool _isBatching = false;
  bool _isForeground = true;

  // iOS'ta arka plan ranging'i, konum izni "Her Zaman" (Always) olmadan
  // guvenilir calismaz - "Uygulamayi Kullanirken" (WhenInUse) izniyle sistem
  // uygulamayi arka plana alir almaz konum/beacon guncellemelerini durdurur.
  // iOS 13+'ta ilk izin dialogu "Always" secenegini dogrudan sunmaz (once
  // WhenInUse verilir, "Always"e yukseltme ayri bir sistem promptudur ve
  // genelde gecikmeli/garantisiz gelir) - bu yuzden durumu kendimiz kontrol
  // edip kullaniciyi Ayarlar'a yonlendirmemiz gerekiyor.
  bool _needsAlwaysLocationPermission = false;
  bool get needsAlwaysLocationPermission => _needsAlwaysLocationPermission;

  Future<void> _refreshAlwaysPermissionStatus() async {
    if (!Platform.isIOS) return;
    try {
      final status = await flutterBeacon.authorizationStatus;
      _needsAlwaysLocationPermission = status != AuthorizationStatus.always;
    } catch (_) {
      // Durum sorgulanamadiysa mevcut bayragi degistirme.
    }
  }

  StreamSubscription<RangingResult>? _rangingSubscription;
  StreamSubscription<MonitoringResult>? _monitoringSubscription;
  Timer? _batchTimer;
  Timer? _dutyCycleTimer;
  Timer? _rangingWindowTimer;
  List<Region>? _regions;

  final _stateController =
      StreamController<ObservationServiceState>.broadcast();

  ObservationServiceState _currentState = const ObservationServiceState(
    status: ObservationServiceStatus.initializing,
    pendingSnapshotCount: 0,
  );

  Stream<ObservationServiceState> get stateStream => _stateController.stream;

  // Faz 6.2: cihaz kurtarma sirasinda (bkz. yukaridaki initialQueue) bu
  // servis `stop()` edilip atilmadan once kuyrugu okuyup yeni servise
  // aktarabilmek icin salt-okunur bir govde - degistirilemez bir kopya
  // doner, cagiran taraf ic kuyruga MUDAHALE edemez.
  List<ObservationSnapshot> get pendingSnapshots => List.unmodifiable(_queue);

  void _emitState(ObservationServiceState state) {
    _currentState = state;
    if (kDebugMode) {
      debugPrint(
        '[BeaconObservationService] state=${state.status.name} '
        'pending=${state.pendingSnapshotCount} '
        'lastBatch=${state.lastBatchResult} '
        'error=${state.errorMessage}',
      );
    }
    if (!_stateController.isClosed) {
      _stateController.add(state);
    }
  }

  Future<void> start() async {
    _emitState(
      ObservationServiceState(
        status: ObservationServiceStatus.initializing,
        pendingSnapshotCount: _queue.length,
        lastBatchResult: _currentState.lastBatchResult,
      ),
    );

    try {
      final isReady = await flutterBeacon.initializeScanning;
      if (kDebugMode) {
        final authStatus = await flutterBeacon.authorizationStatus;
        debugPrint(
          '[BeaconObservationService] initializeScanning=$isReady '
          'authorizationStatus=$authStatus regionUuid=$_beaconUuid',
        );
      }
      if (!isReady) {
        _emitState(
          ObservationServiceState(
            status: ObservationServiceStatus.error,
            pendingSnapshotCount: _queue.length,
            lastBatchResult: _currentState.lastBatchResult,
            errorMessage:
                'Tarama hazır değil. Bluetooth veya izinler kapalı olabilir.',
          ),
        );
        return;
      }

      final regions = <Region>[
        Region(
          identifier: 'kongre-salon-beaconlari',
          proximityUUID: _beaconUuid,
        ),
      ];
      _regions = regions;

      WidgetsBinding.instance.addObserver(this);

      // start() genelde foreground'dan cagrilir (participant_home_page'in
      // initState'i), ama garantiye almak icin gercek durumu soruyoruz.
      final currentLifecycleState = WidgetsBinding.instance.lifecycleState;
      if (currentLifecycleState == AppLifecycleState.paused) {
        _enterBackgroundMode();
      } else {
        _enterForegroundMode();
      }

      // Region monitoring isletim sistemi seviyesinde calisir (Bluetooth acikken
      // uygulama arka planda/sonlandirilmis olsa bile iOS giris/cikis olaylarini
      // yakalayabilir - kullanici uygulamayi elle kapatmadigi surece). Ranging'in
      // herhangi bir nedenle durmus olmasi ihtimaline karsi, her iki durumda da
      // taramayi yeniden baslatan bir guvenlik agi gorevi gorur (bkz.
      // _onMonitoringResult).
      _monitoringSubscription = flutterBeacon
          .monitoring(regions)
          .listen(
            _onMonitoringResult,
            onError: (error) {
              _emitState(
                ObservationServiceState(
                  status: _currentState.status,
                  pendingSnapshotCount: _queue.length,
                  lastBatchResult: _currentState.lastBatchResult,
                  errorMessage: 'Bölge izleme hatası: $error',
                ),
              );
            },
          );

      _emitState(
        ObservationServiceState(
          status: ObservationServiceStatus.active,
          pendingSnapshotCount: _queue.length,
          lastBatchResult: _currentState.lastBatchResult,
        ),
      );
    } catch (e) {
      _emitState(
        ObservationServiceState(
          status: ObservationServiceStatus.error,
          pendingSnapshotCount: _queue.length,
          lastBatchResult: _currentState.lastBatchResult,
          errorMessage: 'Başlatma hatası: $e',
        ),
      );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
        _enterBackgroundMode();
        break;
      case AppLifecycleState.resumed:
        _enterForegroundMode();
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
        // Gecici ara durumlar (telefon cagrisi, kontrol merkezi, Face ID
        // istemi, uygulama gecis onizlemesi). Gercek arka plana gecis/donus
        // her zaman paused/resumed'da son bulur - Flutter ikisi arasina
        // hidden'i otomatik ekler. Burada bir sey yapmamak, gecici bir
        // titresim icin timer'lari gereksiz yere yikip yeniden kurmaktan
        // kacinir.
        break;
      case AppLifecycleState.detached:
        // Uygulama sonlandiriliyor/henuz baglanmadi - force-quit kenar
        // durumu, kapsam disi (docs/decisions.md).
        break;
    }
  }

  void _enterForegroundMode() {
    _isForeground = true;
    _dutyCycleTimer?.cancel();
    _beginRangingWindow(_foregroundRangingWindow);
    _dutyCycleTimer = Timer.periodic(_foregroundCycleInterval, (_) {
      _beginRangingWindow(_foregroundRangingWindow);
    });
    _restartBatchTimer(_batchInterval);

    // Uygulama her one geldiginde (ilk acilis dahil) izin durumunu tekrar
    // kontrol et - kullanici Ayarlar'dan "Her Zaman" izni verip geri
    // donmus olabilir, arayuzun bunu yansitmasi gerekir.
    unawaited(
      _refreshAlwaysPermissionStatus().then((_) => _emitState(_currentState)),
    );
  }

  void _enterBackgroundMode() {
    _isForeground = false;

    // Foreground'un pencere/dongu mekanizmasini kapat. _rangingWindowTimer'i
    // iptal etmek kritik: bekleyen bir pencere kapanisi, arka plana
    // gecildikten birkac saniye sonra ranging'i yine de durdurabilirdi.
    _dutyCycleTimer?.cancel();
    _dutyCycleTimer = null;
    _rangingWindowTimer?.cancel();
    _rangingWindowTimer = null;

    // Ranging'i DURDURMUYORUZ. Zaten aciksa dokunmuyoruz; foreground'un "off"
    // araliginda arka plana gecildiyse aciyoruz - ve bir daha kapatmiyoruz.
    // Uygulamayi iOS'ta arka planda canli tutan mekanizma budur; bunu
    // durdurmak (onceki davranis) arka plan veri akisinin tamamen kesilmesine
    // yol acmisti (bkz. commit 6990447 regresyonu, docs/mobile-handoff.md).
    _ensureRangingActive();

    _restartBatchTimer(_batchInterval);
  }

  void _ensureRangingActive() {
    if (_rangingSubscription != null || _regions == null) return;
    _startRanging(_regions!);
  }

  void _restartBatchTimer(Duration interval) {
    _batchTimer?.cancel();
    _batchTimer = Timer.periodic(interval, (_) {
      _trySendBatch();
    });
  }

  // Backend her batch yanitinda panelden ayarlanan guncel gonderim
  // sikligini gonderiyor. Degistiyse zamanlayiciyi hemen bu yeni degerle
  // yeniden baslatiyoruz - kullanici panelden degistirdiginde bir sonraki
  // gonderimden itibaren gecerli olmasi icin.
  void _applyServerIntervalIfChanged(int? intervalSeconds) {
    if (intervalSeconds == null) return;
    final clamped = intervalSeconds.clamp(
      _minIntervalSeconds,
      _maxIntervalSeconds,
    );
    final newInterval = Duration(seconds: clamped);
    if (newInterval == _batchInterval) return;

    _batchInterval = newInterval;
    _restartBatchTimer(_batchInterval);
  }

  void _beginRangingWindow(Duration window) {
    if (_regions == null) return;
    _startRanging(_regions!);
    _rangingWindowTimer?.cancel();
    _rangingWindowTimer = Timer(window, _stopRanging);
  }

  void _stopRanging() {
    _rangingWindowTimer?.cancel();
    _rangingWindowTimer = null;
    _rangingSubscription?.cancel();
    _rangingSubscription = null;
  }

  void _startRanging(List<Region> regions) {
    _rangingSubscription?.cancel();
    _rangingSubscription = flutterBeacon
        .ranging(regions)
        .listen(
          _onRangingResult,
          onError: (error) {
            _emitState(
              ObservationServiceState(
                status: ObservationServiceStatus.error,
                pendingSnapshotCount: _queue.length,
                lastBatchResult: _currentState.lastBatchResult,
                errorMessage: 'Tarama hatası: $error',
              ),
            );
          },
        );
  }

  void _onMonitoringResult(MonitoringResult result) {
    if (kDebugMode) {
      debugPrint(
        '[BeaconObservationService] monitoring '
        'eventType=${result.monitoringEventType} '
        'state=${result.monitoringState}',
      );
    }
    // Ranging bir sekilde durmus olabilir ihtimaline karsi guvenlik agi -
    // hem foreground hem background'da gecerli (orijinal tasarimin ruhu).
    final entered =
        result.monitoringEventType == MonitoringEventType.didEnterRegion ||
        result.monitoringState == MonitoringState.inside;

    if (entered) {
      _ensureRangingActive();
    }
  }

  void _onRangingResult(RangingResult result) {
    if (kDebugMode) {
      debugPrint(
        '[BeaconObservationService] ranging beaconCount=${result.beacons.length} '
        'foreground=$_isForeground',
      );
    }
    if (result.beacons.isEmpty) return;

    final observedBeacons = result.beacons.map((b) {
      return ObservedBeacon(
        uuid: b.proximityUUID,
        major: b.major,
        minor: b.minor,
        rssi: b.rssi,
        txPower: b.txPower,
      );
    }).toList();

    final snapshot = ObservationSnapshot(
      observationId: _uuid.v4(),
      observedAt: DateTime.now().toUtc().toIso8601String(),
      beacons: observedBeacons,
      appVersion: _appVersion,
    );

    _queue.add(snapshot);

    _emitState(
      ObservationServiceState(
        status: _currentState.status,
        pendingSnapshotCount: _queue.length,
        lastBatchResult: _currentState.lastBatchResult,
        errorMessage: _currentState.errorMessage,
      ),
    );

    // Arka planda erken gonderim yapmiyoruz: ranging surekli acik oldugu icin
    // kuyruk hizla dolar ve bu yol tetiklenmeye devam ederdi - bu da
    // panelden ayarlanan gonderim sikligini sessizce gecersiz kilardi. Arka
    // planda yalniz _batchTimer'in (_batchInterval) tetiklemesine guveniyoruz.
    if (_isForeground && _queue.length >= 10) {
      _trySendBatch();
    }
  }

  Future<void> _trySendBatch() async {
    if (kDebugMode) {
      debugPrint(
        '[BeaconObservationService] _trySendBatch cagrildi '
        'queueLength=${_queue.length} isBatching=$_isBatching',
      );
    }
    if (_isBatching || _queue.isEmpty) return;

    _isBatching = true;

    // Kuyruktan ayrı bir kopya alıyoruz.
    // Başarılı olursa sadece bu kopyadaki snapshot'ları sileceğiz.
    final batchToProcess = List<ObservationSnapshot>.from(_queue);

    try {
      final request = ObservationBatchRequest(
        clientBatchId: _uuid.v4(),
        deviceId: deviceId,
        observations: batchToProcess,
      );

      final responseJson = await _apiClient.post(
        ApiEndpoints.observationsBatch,
        body: request.toJson(),
        requiresAuth: true,
      );

      final response = ObservationBatchResponse.fromJson(
        responseJson as Map<String, dynamic>,
      );

      _applyServerIntervalIfChanged(response.observationIntervalSeconds);

      // Sadece gönderilenleri temizle.
      _queue.removeWhere((item) => batchToProcess.contains(item));

      _emitState(
        ObservationServiceState(
          status: _currentState.status,
          pendingSnapshotCount: _queue.length,
          lastBatchResult:
              'Accepted: ${response.acceptedCount}, Dup: ${response.duplicateCount}, Rej: ${response.rejectedCount}',
          errorMessage: _currentState.errorMessage,
        ),
      );
    } catch (e) {
      if (kDebugMode) {
        final statusCode = e is ApiException ? e.statusCode : null;
        debugPrint(
          '[BeaconObservationService] batch gonderim hatasi '
          'statusCode=$statusCode error=$e',
        );
      }
      if (e is ApiException && e.statusCode == 401) {
        _emitState(
          ObservationServiceState(
            status: ObservationServiceStatus.unauthorized,
            pendingSnapshotCount: _queue.length,
            lastBatchResult: 'Hata: Yetkisiz (401)',
            errorMessage: e.message,
          ),
        );
      } else if (e is ApiException && e.statusCode == 403) {
        // /observations/batch'te 403'un TEK kaynagi backend'deki cihaz
        // sahiplik kontrolu (bkz. observation-ingestion.service.ts,
        // "Bu cihaz bu kullaniciya ait degil") - Faz 6.1'de sahada 6+
        // dakika sessizce yakalanamayan tam olarak bu hataydi. Kuyruk
        // BILEREK bosaltilmaz - cagiran taraf cihazi yeniden kaydedip
        // servisi yeniden basalatinca ayni kuyruk tekrar gonderilebilsin.
        _emitState(
          ObservationServiceState(
            status: ObservationServiceStatus.deviceInvalid,
            pendingSnapshotCount: _queue.length,
            lastBatchResult: 'Hata: Cihaz kaydi gecersiz (403)',
            errorMessage: e.message,
          ),
        );
      } else {
        // Hata durumunda kayıtlar silinmez, olduğu gibi kalır.
        _emitState(
          ObservationServiceState(
            status: _currentState.status,
            pendingSnapshotCount: _queue.length,
            lastBatchResult: 'Hata: Gönderilemedi', // Veya e.toString() gibi
            errorMessage: _currentState.errorMessage,
          ),
        );
      }
    } finally {
      _isBatching = false;
    }
  }

  Future<void> stop() async {
    WidgetsBinding.instance.removeObserver(this);
    _dutyCycleTimer?.cancel();
    _rangingWindowTimer?.cancel();
    _batchTimer?.cancel();
    await _rangingSubscription?.cancel();
    await _monitoringSubscription?.cancel();
    await _stateController.close();
  }
}
