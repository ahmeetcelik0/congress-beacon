import 'dart:async';

import 'package:beacon/features/observations/domain/beacon_observation_service.dart';
import 'package:beacon/features/observations/domain/observation_queue_store.dart';
import 'package:beacon/models/observation_models.dart';
import 'package:flutter_test/flutter_test.dart';

// Faz 10.1: `_flushWriteBuffer`in eskiden sahip OLMADIGI re-entrancy
// korumasini dogrudan test eder. `enqueueAll`i istegimize gore geciktiren
// bu sahte kuyruk, iki flush cagrisinin GERCEKTEN cakismasini (birinci
// hala `await enqueueAll(...)`de askidayken ikincisinin baslamasini)
// kontrollu bicimde uretmemizi saglar - `Future.delayed` gibi zamanlamaya
// dayali kirilgan bir yontem yerine.
class _SlowFakeQueueStore implements ObservationQueueStore {
  final List<QueuedObservation> written = [];
  final List<Completer<void>> _pending = [];
  int enqueueAllCallCount = 0;
  bool shouldThrowOnce = false;

  @override
  Future<void> enqueueAll(List<QueuedObservation> items) async {
    enqueueAllCallCount++;
    if (shouldThrowOnce) {
      shouldThrowOnce = false;
      throw Exception('sahte disk hatasi');
    }
    final completer = Completer<void>();
    _pending.add(completer);
    await completer.future;
    written.addAll(items);
  }

  /// En eski bekleyen `enqueueAll` cagrisini tamamlar - cagrilma sirasina
  /// gore FIFO (testte hangi flush'in "once" bittigini kontrol etmek icin).
  void completeOldestPending() {
    _pending.removeAt(0).complete();
  }

  int get pendingCount => _pending.length;

  @override
  Future<void> enqueue(QueuedObservation item) async => written.add(item);

  @override
  Future<List<QueuedObservation>> peekBatch({required int limit}) async => [];

  @override
  Future<void> removeSent(List<String> observationIds) async {}

  @override
  Future<int> count() async => written.length;

  @override
  Future<int> pruneOlderThan(Duration age) async => 0;

  @override
  Future<int> pruneOverCapacity(int maxRows) async => 0;

  @override
  Future<int> clearForScopeChange() async => 0;
}

ObservationSnapshot _snapshot(String id) => ObservationSnapshot(
  observationId: id,
  observedAt: DateTime(2026, 8, 18).toIso8601String(),
  beacons: const [
    ObservedBeacon(uuid: 'UUID-1', major: 1, minor: 1, rssi: -60),
  ],
  appVersion: '1.0.0',
);

void main() {
  late _SlowFakeQueueStore store;
  late BeaconObservationService service;

  setUp(() {
    store = _SlowFakeQueueStore();
    service = BeaconObservationService(
      deviceId: 'device-1',
      beaconUuid: 'UUID-1',
      congressId: 'congress-1',
      userId: 'user-1',
      queueStore: store,
    );
  });

  test(
    'cakisan iki flush cagrisi RangeError firlatmiyor, veri kaybolmuyor/'
    'ikilenmiyor (Faz 10.1 - eski kod bu senaryoda cokerdi)',
    () async {
      // 1) Tampona 3 kayit ekle, ilk flush'i baslat - `enqueueAll` sahte
      //    kuyrukta askida kalir (henuz tamamlanmadi).
      service.debugEnqueueSnapshotForTest(_snapshot('a'));
      service.debugEnqueueSnapshotForTest(_snapshot('b'));
      service.debugEnqueueSnapshotForTest(_snapshot('c'));
      final flushA = service.debugFlushWriteBufferForTest();

      // enqueueAll'in gercekten cagrilip askida kaldigini bekle (event loop'a
      // bir tur birak).
      await Future<void>.delayed(Duration.zero);
      expect(store.pendingCount, 1);

      // 2) A hala askidayken (eski koddaki asil yaris senaryosu) tampona
      //    2 YENI kayit ekle - gercekte bu, A'nin `await enqueueAll(...)`de
      //    beklerken gelen yeni ranging sonuclarini temsil eder.
      service.debugEnqueueSnapshotForTest(_snapshot('d'));
      service.debugEnqueueSnapshotForTest(_snapshot('e'));

      // 3) Ikinci bir flush TETIKLE - A hala bitmemisken. Zincirleme
      //    sayesinde B, A bitene kadar KENDI `_doFlush()`ini BASLATMAZ.
      final flushB = service.debugFlushWriteBufferForTest();
      await Future<void>.delayed(Duration.zero);
      // B henuz baslamadi - store'da hala yalnizca A'nin cagrisi bekliyor.
      expect(store.pendingCount, 1);
      expect(store.enqueueAllCallCount, 1);

      // 4) A'yi tamamla - `_doFlush`i A'nin 3 kaydini yazip tampondan
      //    cikarmali, tamponda yalnizca d/e (2 kayit) kalmali.
      store.completeOldestPending();
      await flushA;
      expect(service.debugWriteBufferLengthForTest, 2);
      expect(service.debugPersistedCountForTest, 3);

      // 5) Simdi B'nin `_doFlush()`i baslamis olmali (zincirdeki sira geldi) -
      //    kendi enqueueAll cagrisi asilikta bekliyor olmali.
      await Future<void>.delayed(Duration.zero);
      expect(store.pendingCount, 1);
      expect(store.enqueueAllCallCount, 2);

      // 6) B'yi tamamla.
      store.completeOldestPending();
      await flushB;

      // Sonuc: hicbir istisna atilmadi (test buraya ulastiysa zaten kanit),
      // toplam 5 farkli kayit TAM OLARAK BIR KEZ yazildi, tampon bosaldi,
      // sayac dogru.
      expect(store.written.map((w) => w.snapshot.observationId).toSet(), {
        'a',
        'b',
        'c',
        'd',
        'e',
      });
      expect(store.written.length, 5);
      expect(service.debugWriteBufferLengthForTest, 0);
      expect(service.debugPersistedCountForTest, 5);
    },
  );

  test(
    'enqueueAll hata firlatirsa tampon KORUNUR (mevcut davranis, '
    'regresyon degil)',
    () async {
      store.shouldThrowOnce = true;
      service.debugEnqueueSnapshotForTest(_snapshot('x'));
      service.debugEnqueueSnapshotForTest(_snapshot('y'));

      await service.debugFlushWriteBufferForTest();

      expect(service.debugWriteBufferLengthForTest, 2);
      expect(service.debugPersistedCountForTest, 0);
      expect(store.written, isEmpty);

      // Bir sonraki flush (hata gecmisti) basarili olup tamponu bosaltmali -
      // bu kez `enqueueAll` gercekten askida kalir, sahte kuyrugun
      // completer'ini biz tamamlamaliyiz (aksi halde test asilir).
      final secondFlush = service.debugFlushWriteBufferForTest();
      await Future<void>.delayed(Duration.zero);
      expect(store.pendingCount, 1);
      store.completeOldestPending();
      await secondFlush;

      expect(service.debugWriteBufferLengthForTest, 0);
      expect(service.debugPersistedCountForTest, 2);
    },
  );

  test(
    'ust uste (seri) N flush cagrisi da hicbirini dusurmeden hepsini yazar',
    () async {
      for (var i = 0; i < 5; i++) {
        service.debugEnqueueSnapshotForTest(_snapshot('n$i'));
        // Her ekleme sonrasi flush tetikle ama AWAIT ETME - gercek
        // koddaki `unawaited(_flushWriteBuffer())` deseniyle ayni.
        unawaited(service.debugFlushWriteBufferForTest());
      }
      // Tum bekleyen enqueueAll cagrilarini sirayla tamamla.
      while (store.pendingCount > 0 || service.debugWriteBufferLengthForTest > 0) {
        await Future<void>.delayed(Duration.zero);
        if (store.pendingCount > 0) store.completeOldestPending();
      }
      await Future<void>.delayed(Duration.zero);

      expect(store.written.length, 5);
      expect(
        store.written.map((w) => w.snapshot.observationId).toSet(),
        {'n0', 'n1', 'n2', 'n3', 'n4'},
      );
      expect(service.debugWriteBufferLengthForTest, 0);
      expect(service.debugPersistedCountForTest, 5);
    },
  );
}
