import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_beacon/flutter_beacon.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/observation_models.dart';
import 'observation_queue_store.dart';

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
    required String congressId,
    required String userId,
    required ObservationQueueStore queueStore,
    ApiClient? apiClient,
    String appVersion = '1.0.0',
  }) : _apiClient = apiClient ?? ApiClient(),
       // ignore: prefer_initializing_formals
       _appVersion = appVersion,
       // ignore: prefer_initializing_formals
       _beaconUuid = beaconUuid,
       // ignore: prefer_initializing_formals
       _congressId = congressId,
       // ignore: prefer_initializing_formals
       _userId = userId,
       // ignore: prefer_initializing_formals
       _queueStore = queueStore;

  final String deviceId;
  final ApiClient _apiClient;
  final ObservationQueueStore _queueStore;

  // Faz 8: kalici kuyrukta hangi kongre/kullaniciya ait oldugu bilgisiyle
  // birlikte saklanir - kongre/kullanici degisince eski kayitlarin YANLIS
  // kongreye/kullaniciya gonderilmesini onlemek icin sart (bkz.
  // ObservationQueueStore, ObservationLifecycleNotifier kapsam temizligi).
  final String _congressId;
  final String _userId;
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

  // Faz 8: `_onRangingResult` SENKRON bir callback oldugu icin (icine
  // dogrudan `await` konamaz), gozlemler once bu KUCUK bellek tamponuna
  // yazilir; tampon 10 kayda ulasinca VEYA 5 saniyede bir (hangisi once
  // olursa) kalici kuyruga (`_queueStore`) tasinir. Bedeli: uygulama aniden
  // olurse tampondaki en fazla birkac saniyelik veri kaybolur - (b) secenegi
  // (her kayitta dogrudan diske yazmak) yerine BUNUN secilme sebebi: saniyede
  // ~3.3 gozlemle (Faz 6 olcumu) (b) uzun bir kongrede yuz binlerce disk
  // yazimi demek, pil/performans acisindan gereksiz agir (bkz. Faz 8
  // talimati §3).
  static const int _bufferFlushSize = 10;
  static const Duration _bufferFlushInterval = Duration(seconds: 5);
  // Tek istekte gonderilecek azami kayit - kalici kuyruk cok buyuyebildigi
  // icin (ör. 8 saat cevrimdisi ~100.000 gozlem) tum kuyrugu tek seferde
  // gondermek zaman asimi/bellek riski tasir (bkz. Faz 8 talimati §4).
  //
  // Faz 8'de GERCEK cihazda 500'luk bir batch backend'den 413 ("request
  // entity too large") dondurmustu - NestJS/Express'in VARSAYILAN JSON
  // govde siniri ~100KB, 6 beacon'luk (gercek cihazda gorulen tipik
  // yogunluk) 500 gozlemlik bir istek ~375KB'a ulasiyordu. O zaman
  // istemci tarafinda gecici olarak 50'ye dusuruldu. Faz 9'da backend
  // govde siniri 2MB'a cikarildigi icin (bkz. `main.ts`) 500'e GERI
  // ALINDI - 15 beacon/gozlem gibi gercekciligin COK ustunde bir
  // yogunlukta bile (~836KB) yeni sinirin yalnizca %41'i, saglam bir
  // pay birakiyor (bkz. Faz 9 gercek cihaz olcumu, docs/decisions.md).
  static const int _sendBatchLimit = 500;
  // Kuyrukta hala kayit varsa bir sonraki batch'i sunucuyu bogmadan
  // gondermek icin ardisik batch'ler arasindaki kisa bekleme.
  static const Duration _drainRetryDelay = Duration(seconds: 2);
  // Kongre bitmis, veri anlamini yitirmis sayilan yas siniri.
  static const Duration _maxQueueAge = Duration(hours: 72);
  // Diskin dolmamasi icin kuyruk boyutu tavani - asilirsa en eski kayitlar
  // silinir (yeni veri her zaman eskisinden degerlidir).
  static const int _maxQueueRows = 100000;

  final List<ObservationSnapshot> _writeBuffer = [];
  int _persistedCount = 0;
  int get _pendingCount => _persistedCount + _writeBuffer.length;
  Timer? _bufferFlushTimer;
  bool _isBatching = false;
  bool _isForeground = true;

  // `_flushWriteBuffer` BES ayri yerden tetiklenir (periyodik zamanlayici,
  // arka plana gecis, tampon esigi, batch gonderimi oncesi, stop()) ve
  // coguesi `unawaited`dir - eskiden re-entrancy korumasi YOKTU: iki cagri
  // cakisirsa, ikisi de AYNI `_writeBuffer` icerigini kopyalayip kendi
  // `await enqueueAll(...)`inde askiya aliniyor, sonra ikisi de kendi
  // `removeRange(0, toFlush.length)`ini calistirmaya calisiyordu - hizli
  // biten tamponu once bosaltinca, yavas biten kendi payini cikaramayip
  // `RangeError` firlatiyordu (bkz. docs/decisions.md "Faz 10.1"). Bu
  // zincir, HICBIR flush istegini DUSURMEDEN (`if (_isFlushing) return;`
  // gibi bir kisayol arka plana gecerken tamponu diske yazmayi
  // ATLAYABILIRDI - force-quit'te veri kaybi demek olurdu) her cagriyi bir
  // onceki cagrinin bitmesini bekleyip KENDI turunu calistiracak sekilde
  // sıraya sokar - boylece ayni anda en fazla TEK bir `_doFlush()` calisir.
  Future<void> _flushChain = Future<void>.value();

  Future<void> _flushWriteBuffer() {
    final chained = _flushChain.then((_) => _doFlush());
    _flushChain = chained;
    return chained;
  }

  // Faz 8: `stop()` cagrildiginda `_drainQueue`in devam eden bir dongusu
  // OLABILIR (ör. yavas bir ag yanitini bekliyor) - `stop()` bunu iptal
  // ETMEZ, ama bu bayrak dongunun bir SONRAKI `peekBatch` cagrisindan once
  // kontrol edilip erken cikmasini saglar. Amac: kapsam degisiminde (kongre/
  // kullanici degisti, `clearForScopeChange` cagrilacak) ESKI servisin
  // dongusunun, token ARTIK YENI kapsama gecmisken YENI bir gonderim
  // baslatip veriyi yanlis kapsama fatura etmesi ihtimalini daraltmak (bkz.
  // Faz 8 talimati §5 "sessiz veri bozulmasini onle").
  bool _stopped = false;

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
    // Faz 8: kalici kuyruk BU servis ornegiyle degil, congressId+userId ile
    // kapsamli - onceki oturumdan/uygulama kapatilmadan once kalan kayitlar
    // burada devralinir (bkz. Faz 8 talimati "Bitirdiginde" §3 - kapat-ac
    // sonrasi kuyrugun korunmasi bu satirla dogrulanir).
    _persistedCount = await _queueStore.count();
    if (kDebugMode) {
      debugPrint(
        '[ObservationQueue] baslangicta kuyrukta $_persistedCount kayit '
        '(congressId=$_congressId, userId=$_userId)',
      );
    }
    final prunedAge = await _queueStore.pruneOlderThan(_maxQueueAge);
    if (prunedAge > 0) _persistedCount -= prunedAge;

    _bufferFlushTimer?.cancel();
    _bufferFlushTimer = Timer.periodic(_bufferFlushInterval, (_) {
      unawaited(_flushWriteBuffer());
    });

    _emitState(
      ObservationServiceState(
        status: ObservationServiceStatus.initializing,
        pendingSnapshotCount: _pendingCount,
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
            pendingSnapshotCount: _pendingCount,
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
                  pendingSnapshotCount: _pendingCount,
                  lastBatchResult: _currentState.lastBatchResult,
                  errorMessage: 'Bölge izleme hatası: $error',
                ),
              );
            },
          );

      _emitState(
        ObservationServiceState(
          status: ObservationServiceStatus.active,
          pendingSnapshotCount: _pendingCount,
          lastBatchResult: _currentState.lastBatchResult,
        ),
      );
    } catch (e) {
      _emitState(
        ObservationServiceState(
          status: ObservationServiceStatus.error,
          pendingSnapshotCount: _pendingCount,
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

    // Faz 8: iOS uygulamayi bu noktadan sonra habersiz sonlandirabilir - bu
    // yuzden tampondaki yazilmamis gozlemler arka plana gecerken MUTLAKA
    // diske boşaltilmaya calisilir (bkz. Faz 8 talimati §3). `unawaited`:
    // `_enterBackgroundMode` `WidgetsBindingObserver.didChangeAppLifecycleState`
    // sozlesmesi geregi senkron (`void`) olmak ZORUNDA, icine `await` konamaz.
    unawaited(_flushWriteBuffer());
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
                pendingSnapshotCount: _pendingCount,
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

    _writeBuffer.add(snapshot);

    _emitState(
      ObservationServiceState(
        status: _currentState.status,
        pendingSnapshotCount: _pendingCount,
        lastBatchResult: _currentState.lastBatchResult,
        errorMessage: _currentState.errorMessage,
      ),
    );

    // Faz 8: tampon 10 kayda ulastiginda kalici kuyruga tasi (bkz. yukaridaki
    // _bufferFlushSize yorumu) - 5 saniyelik zamanlayici (_bufferFlushTimer)
    // zaten periyodik olarak da tasiyor, bu sadece hizli dolan durumlarda
    // beklemeden tasimayi saglar.
    if (_writeBuffer.length >= _bufferFlushSize) {
      unawaited(_flushWriteBuffer());
    }

    // Arka planda erken gonderim yapmiyoruz: ranging surekli acik oldugu icin
    // kuyruk hizla dolar ve bu yol tetiklenmeye devam ederdi - bu da
    // panelden ayarlanan gonderim sikligini sessizce gecersiz kilardi. Arka
    // planda yalniz _batchTimer'in (_batchInterval) tetiklemesine guveniyoruz.
    if (_isForeground && _pendingCount >= _bufferFlushSize) {
      _trySendBatch();
    }
  }

  /// Tampondaki gozlemleri kalici kuyruga (`_queueStore`) tasir. Yazma
  /// basarisiz olursa (ör. gecici disk hatasi) tampon TEMIZLENMEZ - bir
  /// sonraki flush'ta (5sn zamanlayici veya bir sonraki dolma) tekrar
  /// denenir; boylece basarisiz bir yazimda veri sessizce kaybolmaz.
  ///
  /// YALNIZCA `_flushWriteBuffer()`in zinciri uzerinden cagrilir - bu
  /// sayede ayni anda en fazla TEK bir cagri calisir, `_writeBuffer`
  /// uzerinde yaris durumu olusmaz (bkz. yukaridaki `_flushChain` yorumu).
  Future<void> _doFlush() async {
    if (_writeBuffer.isEmpty) return;
    final toFlush = List<ObservationSnapshot>.from(_writeBuffer);
    final createdAt = DateTime.now().toUtc();
    try {
      await _queueStore.enqueueAll(
        toFlush
            .map(
              (s) => QueuedObservation(
                snapshot: s,
                congressId: _congressId,
                userId: _userId,
                createdAt: createdAt,
              ),
            )
            .toList(),
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[ObservationQueue] tampon diske yazilamadi, tekrar denenecek: $e',
        );
      }
      return;
    }
    // `removeRange` (`clear()` DEGIL): await sirasinda `_onRangingResult`
    // tampona YENI kayit eklemis olabilir - yalnizca BURADA yazilan ilk
    // `toFlush.length` kaydi cikarmak, o yeni kayitlarin kaybolmamasini saglar.
    //
    // Savunma amacli sinir: `_flushChain` sayesinde `_writeBuffer`in bu
    // noktada `toFlush.length`den KISA olmasi beklenmez (tek seferde tek
    // `_doFlush()` calisir) - ama ileride baska bir eszamanlilik yolu
    // acilirsa `RangeError` yerine sessiz/dogru davranis uretmesi icin
    // silinecek adet tamponun o anki uzunlugunu asmaz.
    final removeCount = toFlush.length < _writeBuffer.length
        ? toFlush.length
        : _writeBuffer.length;
    _writeBuffer.removeRange(0, removeCount);
    _persistedCount += toFlush.length;
  }

  // Asagidaki ucu, `_writeBuffer`/`_flushWriteBuffer` YARIS DURUMUNU birim
  // testinde GERCEKTEN uretebilmek icin var (bkz. docs/decisions.md
  // "Faz 10.1") - `_onRangingResult` (tamponu dolduran) ve `start()`
  // (platform kanaliyla gercek beacon taramasi baslatan) testte dogrudan
  // tetiklenemedigi icin bu, private tampon durumuna disaridan erisimin
  // TEK yolu. Sadece testte kullanilir, uretim kodundan cagrilmaz.
  @visibleForTesting
  void debugEnqueueSnapshotForTest(ObservationSnapshot snapshot) {
    _writeBuffer.add(snapshot);
  }

  @visibleForTesting
  Future<void> debugFlushWriteBufferForTest() => _flushWriteBuffer();

  @visibleForTesting
  int get debugWriteBufferLengthForTest => _writeBuffer.length;

  @visibleForTesting
  int get debugPersistedCountForTest => _persistedCount;

  Future<void> _trySendBatch() async {
    if (kDebugMode) {
      debugPrint(
        '[BeaconObservationService] _trySendBatch cagrildi '
        'pending=$_pendingCount isBatching=$_isBatching',
      );
    }
    if (_isBatching || _pendingCount == 0) return;

    _isBatching = true;
    try {
      await _flushWriteBuffer();
      await _drainQueue();
    } finally {
      _isBatching = false;
    }
  }

  /// Kalici kuyruktan en fazla `_sendBatchLimit` kayitlik gruplar halinde,
  /// kuyruk bosalana ya da bir gonderim basarisiz olana kadar KADEMELI
  /// gonderir (bkz. Faz 8 talimati §4 - tek istekte tum kuyrugu gondermenin
  /// tehlikesi: cevrimdisi kalinan uzun surelerde on binlerce kayit birikebilir).
  Future<void> _drainQueue() async {
    while (true) {
      if (_stopped) return;
      final batch = await _queueStore.peekBatch(limit: _sendBatchLimit);
      if (batch.isEmpty) return;

      final ObservationBatchResponse response;
      try {
        final request = ObservationBatchRequest(
          clientBatchId: _uuid.v4(),
          deviceId: deviceId,
          observations: batch.map((q) => q.snapshot).toList(),
        );

        final responseJson = await _apiClient.post(
          ApiEndpoints.observationsBatch,
          body: request.toJson(),
          requiresAuth: true,
        );

        response = ObservationBatchResponse.fromJson(
          responseJson as Map<String, dynamic>,
        );
      } catch (e) {
        if (kDebugMode) {
          final statusCode = e is ApiException ? e.statusCode : null;
          debugPrint(
            '[BeaconObservationService] batch gonderim hatasi '
            'statusCode=$statusCode error=$e',
          );
        }
        _handleSendError(e);
        return; // Hata durumunda kayitlar silinmez, kademeli bosaltma durur.
      }

      _applyServerIntervalIfChanged(response.observationIntervalSeconds);

      // Sadece gönderilenleri temizle - accepted/dup/rejected FARKETMEKSIZIN
      // (sunucu 200 dondugunde ucunu de "gordum" sayariz, orijinal davranis
      // budur, bkz. asagidaki yorum).
      final sentIds = batch.map((q) => q.snapshot.observationId).toList();
      await _queueStore.removeSent(sentIds);
      _persistedCount -= sentIds.length;
      if (_persistedCount < 0) _persistedCount = 0; // savunma amacli

      final prunedCap = await _queueStore.pruneOverCapacity(_maxQueueRows);
      if (prunedCap > 0) _persistedCount -= prunedCap;

      if (kDebugMode) {
        debugPrint(
          '[ObservationQueue] batch gonderildi: ${sentIds.length} kayit, '
          'kuyrukta $_persistedCount kayit kaldi',
        );
      }

      _emitState(
        ObservationServiceState(
          status: _currentState.status,
          pendingSnapshotCount: _pendingCount,
          lastBatchResult:
              'Accepted: ${response.acceptedCount}, Dup: ${response.duplicateCount}, Rej: ${response.rejectedCount}',
          errorMessage: _currentState.errorMessage,
        ),
      );

      if (batch.length < _sendBatchLimit) return; // Kuyruk tukendi.
      // Kuyrukta hala kayit var - sunucuyu bogmadan kisa bir aralikla devam et.
      await Future<void>.delayed(_drainRetryDelay);
    }
  }

  void _handleSendError(Object e) {
    if (e is ApiException && e.statusCode == 401) {
      _emitState(
        ObservationServiceState(
          status: ObservationServiceStatus.unauthorized,
          pendingSnapshotCount: _pendingCount,
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
      // servisi yeniden basalatinca ayni kuyruk tekrar gonderilebilir
      // (kuyruk KALICI oldugu icin artik BASKA bir servis ornegi de
      // olsa ayni congressId+userId kapsamindaki kayitlari gorur).
      _emitState(
        ObservationServiceState(
          status: ObservationServiceStatus.deviceInvalid,
          pendingSnapshotCount: _pendingCount,
          lastBatchResult: 'Hata: Cihaz kaydi gecersiz (403)',
          errorMessage: e.message,
        ),
      );
    } else {
      // Hata durumunda kayıtlar silinmez, olduğu gibi kalır.
      _emitState(
        ObservationServiceState(
          status: _currentState.status,
          pendingSnapshotCount: _pendingCount,
          lastBatchResult: 'Hata: Gönderilemedi', // Veya e.toString() gibi
          errorMessage: _currentState.errorMessage,
        ),
      );
    }
  }

  Future<void> stop() async {
    _stopped = true;
    WidgetsBinding.instance.removeObserver(this);
    _dutyCycleTimer?.cancel();
    _rangingWindowTimer?.cancel();
    _batchTimer?.cancel();
    _bufferFlushTimer?.cancel();
    await _rangingSubscription?.cancel();
    await _monitoringSubscription?.cancel();
    // Faz 8: `stop()` donmeden ONCE tampon diske YAZILMIS olmali (`await`,
    // fire-and-forget DEGIL) - cagiran taraf (ObservationLifecycleNotifier)
    // kongre/kullanici degisiminde `stop()`un hemen ardindan kuyrugu
    // TAMAMEN temizleyebilir (`clearForScopeChange`); flush burada
    // TAMAMLANMADAN o temizlik calisirsa, gec yazilan eski-kapsam kayitlari
    // YANLIS (yeni) kapsamda kalici kuyrukta kalir - tam da onlemeye
    // calistigimiz sessiz veri bozulmasi.
    await _flushWriteBuffer();
    await _stateController.close();
  }
}
