import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_beacon/flutter_beacon.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/observation_models.dart';

enum ObservationServiceStatus { initializing, active, error, unauthorized }

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
  BeaconObservationService({required this.deviceId, ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final String deviceId;
  final ApiClient _apiClient;
  final _uuid = const Uuid();

  // The main region to scan. In reality, we might have multiple, or one open region.
  // The user rule implies scanning for congress beacons, maybe we just scan all beacons or the specific UUID.
  // We'll use the same UUID from POC, or just listen to all beacons if possible.
  // Let's use the POC UUID for now, as we don't have the backend beaconUuid injected here yet,
  // or we can just scan for everything. The POC uses 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0'.
  static const String _defaultRegionUuid =
      'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

  // Foreground duty-cycle: surekli tarama yerine periyodik pencere.
  // Pil uyarisini ve gereksiz surekli Bluetooth taramasini onlemek icin.
  // Pencere, gonderim araligiyla ayni dongude (10sn) calisir.
  static const Duration _foregroundCycleInterval = Duration(seconds: 10);
  static const Duration _foregroundRangingWindow = Duration(seconds: 4);
  static const Duration _foregroundBatchInterval = Duration(seconds: 10);

  // Arka planda ranging'i DURDURMUYORUZ (bkz. _enterBackgroundMode) - bu,
  // uygulamayi iOS'ta arka planda canli tutan mekanizmanin ta kendisi. Pil
  // tasarrufu, gonderim sikligini seyreltmekten geliyor.
  static const Duration _backgroundBatchInterval = Duration(seconds: 30);

  final List<ObservationSnapshot> _queue = [];
  bool _isBatching = false;
  bool _isForeground = true;

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

  void _emitState(ObservationServiceState state) {
    _currentState = state;
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
          proximityUUID: _defaultRegionUuid,
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
    _restartBatchTimer(_foregroundBatchInterval);
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

    _restartBatchTimer(_backgroundBatchInterval);
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
      appVersion: '1.0.0', // Can be fetched dynamically later
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
    // kuyruk ~10 saniyede dolar ve bu yol tetiklenmeye devam ederdi - bu da
    // hedeflenen 30sn'lik gonderim sikligini sessizce gecersiz kilardi. Arka
    // planda yalniz _batchTimer'in 30sn'lik tetiklemesine guveniyoruz.
    if (_isForeground && _queue.length >= 10) {
      _trySendBatch();
    }
  }

  Future<void> _trySendBatch() async {
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
      if (e is ApiException && e.statusCode == 401) {
        _emitState(
          ObservationServiceState(
            status: ObservationServiceStatus.unauthorized,
            pendingSnapshotCount: _queue.length,
            lastBatchResult: 'Hata: Yetkisiz (401)',
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
