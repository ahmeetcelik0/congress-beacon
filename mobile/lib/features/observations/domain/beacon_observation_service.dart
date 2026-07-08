import 'dart:async';

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

class BeaconObservationService {
  BeaconObservationService({
    required this.deviceId,
    ApiClient? apiClient,
  }) : _apiClient = apiClient ?? ApiClient();

  final String deviceId;
  final ApiClient _apiClient;
  final _uuid = const Uuid();

  // The main region to scan. In reality, we might have multiple, or one open region.
  // The user rule implies scanning for congress beacons, maybe we just scan all beacons or the specific UUID.
  // We'll use the same UUID from POC, or just listen to all beacons if possible. 
  // Let's use the POC UUID for now, as we don't have the backend beaconUuid injected here yet,
  // or we can just scan for everything. The POC uses 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0'.
  static const String _defaultRegionUuid = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

  final List<ObservationSnapshot> _queue = [];
  bool _isBatching = false;

  StreamSubscription<RangingResult>? _rangingSubscription;
  StreamSubscription<MonitoringResult>? _monitoringSubscription;
  Timer? _batchTimer;
  List<Region>? _regions;

  final _stateController = StreamController<ObservationServiceState>.broadcast();

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
    _emitState(ObservationServiceState(
      status: ObservationServiceStatus.initializing,
      pendingSnapshotCount: _queue.length,
      lastBatchResult: _currentState.lastBatchResult,
    ));

    try {
      final isReady = await flutterBeacon.initializeScanning;
      if (!isReady) {
        _emitState(ObservationServiceState(
          status: ObservationServiceStatus.error,
          pendingSnapshotCount: _queue.length,
          lastBatchResult: _currentState.lastBatchResult,
          errorMessage: 'Tarama hazır değil. Bluetooth veya izinler kapalı olabilir.',
        ));
        return;
      }

      final regions = <Region>[
        Region(
          identifier: 'kongre-salon-beaconlari',
          proximityUUID: _defaultRegionUuid,
        ),
      ];
      _regions = regions;

      _startRanging(regions);

      // Region monitoring isletim sistemi seviyesinde calisir (Bluetooth acikken
      // uygulama arka planda/sonlandirilmis olsa bile iOS giris/cikis olaylarini
      // yakalayabilir - kullanici uygulamayi elle kapatmadigi surece). Ranging tek
      // basina arka planda guvenilir degildir; monitoring burada, taramanin
      // herhangi bir nedenle durmus olmasi ihtimaline karsi tetikleyici gorevi gorur.
      _monitoringSubscription = flutterBeacon.monitoring(regions).listen(
        _onMonitoringResult,
        onError: (error) {
          _emitState(ObservationServiceState(
            status: _currentState.status,
            pendingSnapshotCount: _queue.length,
            lastBatchResult: _currentState.lastBatchResult,
            errorMessage: 'Bölge izleme hatası: $error',
          ));
        },
      );

      _batchTimer = Timer.periodic(const Duration(seconds: 10), (_) {
        _trySendBatch();
      });

      _emitState(ObservationServiceState(
        status: ObservationServiceStatus.active,
        pendingSnapshotCount: _queue.length,
        lastBatchResult: _currentState.lastBatchResult,
      ));
    } catch (e) {
      _emitState(ObservationServiceState(
        status: ObservationServiceStatus.error,
        pendingSnapshotCount: _queue.length,
        lastBatchResult: _currentState.lastBatchResult,
        errorMessage: 'Başlatma hatası: $e',
      ));
    }
  }

  void _startRanging(List<Region> regions) {
    _rangingSubscription?.cancel();
    _rangingSubscription = flutterBeacon.ranging(regions).listen(
      _onRangingResult,
      onError: (error) {
        _emitState(ObservationServiceState(
          status: ObservationServiceStatus.error,
          pendingSnapshotCount: _queue.length,
          lastBatchResult: _currentState.lastBatchResult,
          errorMessage: 'Tarama hatası: $error',
        ));
      },
    );
  }

  void _onMonitoringResult(MonitoringResult result) {
    final entered =
        result.monitoringEventType == MonitoringEventType.didEnterRegion ||
            result.monitoringState == MonitoringState.inside;

    if (entered && _regions != null) {
      _startRanging(_regions!);
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

    _emitState(ObservationServiceState(
      status: _currentState.status,
      pendingSnapshotCount: _queue.length,
      lastBatchResult: _currentState.lastBatchResult,
      errorMessage: _currentState.errorMessage,
    ));

    if (_queue.length >= 10) {
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

      final response = ObservationBatchResponse.fromJson(responseJson as Map<String, dynamic>);
      
      // Sadece gönderilenleri temizle.
      _queue.removeWhere((item) => batchToProcess.contains(item));

      _emitState(ObservationServiceState(
        status: _currentState.status,
        pendingSnapshotCount: _queue.length,
        lastBatchResult: 'Accepted: ${response.acceptedCount}, Dup: ${response.duplicateCount}, Rej: ${response.rejectedCount}',
        errorMessage: _currentState.errorMessage,
      ));

    } catch (e) {
      if (e is ApiException && e.statusCode == 401) {
        _emitState(ObservationServiceState(
          status: ObservationServiceStatus.unauthorized,
          pendingSnapshotCount: _queue.length,
          lastBatchResult: 'Hata: Yetkisiz (401)',
          errorMessage: e.message,
        ));
      } else {
        // Hata durumunda kayıtlar silinmez, olduğu gibi kalır.
        _emitState(ObservationServiceState(
          status: _currentState.status,
          pendingSnapshotCount: _queue.length,
          lastBatchResult: 'Hata: Gönderilemedi', // Veya e.toString() gibi
          errorMessage: _currentState.errorMessage,
        ));
      }
    } finally {
      _isBatching = false;
    }
  }

  Future<void> stop() async {
    _batchTimer?.cancel();
    await _rangingSubscription?.cancel();
    await _monitoringSubscription?.cancel();
    await _stateController.close();
  }
}
