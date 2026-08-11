import 'package:beacon/features/observations/data/sqlite_observation_queue_store.dart';
import 'package:beacon/features/observations/domain/observation_queue_store.dart';
import 'package:beacon/models/observation_models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

// Faz 8: `SqliteObservationQueueStore` gercek SQLite semantigini (UNIQUE
// kisiti, ORDER BY, DELETE) test eder - "sahte (fake) kuyruk uygulamasi"
// yerine BILEREK gercek implementasyon secildi (bkz. sqflite_common_ffi'nin
// masaustunde saf FFI ile calisan SQLite motoru): bu davranislarin (siralama,
// tekrar eden ID'nin sessizce yoksayilmasi, yas/tavan silme sorgulari)
// dogrulugu, gercek SQL calistirilmadan anlamli sekilde test edilemez.
void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  QueuedObservation makeItem({
    required String observationId,
    required DateTime createdAt,
    String congressId = 'congress-1',
    String userId = 'user-1',
  }) {
    return QueuedObservation(
      snapshot: ObservationSnapshot(
        observationId: observationId,
        observedAt: createdAt.toIso8601String(),
        beacons: const [
          ObservedBeacon(uuid: 'UUID-1', major: 1, minor: 1, rssi: -60),
        ],
        appVersion: '1.0.0',
      ),
      congressId: congressId,
      userId: userId,
      createdAt: createdAt,
    );
  }

  late SqliteObservationQueueStore store;

  setUp(() {
    // `inMemoryDatabasePath`: her test kendi izole veritabaninda calisir.
    store = SqliteObservationQueueStore(databasePath: inMemoryDatabasePath);
  });

  tearDown(() async {
    // sqflite ayni yol icin ACIK baglantiyi yeniden kullanir - testler
    // arasi veri sizintisini onlemek icin baglanti burada kapatilir.
    await store.close();
  });

  test('enqueue edilen kayit count() ile gorulur', () async {
    await store.enqueue(
      makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
    );
    expect(await store.count(), 1);
  });

  test('enqueueAll toplu ekler', () async {
    await store.enqueueAll([
      makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
      makeItem(observationId: 'obs-2', createdAt: DateTime.utc(2026, 1, 2)),
      makeItem(observationId: 'obs-3', createdAt: DateTime.utc(2026, 1, 3)),
    ]);
    expect(await store.count(), 3);
  });

  test('tekrar eden observation_id sessizce yoksayilir (UNIQUE)', () async {
    final duplicateAt = DateTime.utc(2026, 1, 1);
    await store.enqueue(
      makeItem(observationId: 'obs-1', createdAt: duplicateAt),
    );
    await store.enqueue(
      makeItem(observationId: 'obs-1', createdAt: duplicateAt),
    );
    expect(await store.count(), 1);
  });

  test('peekBatch en eskiden yeniye sirali doner', () async {
    await store.enqueueAll([
      makeItem(observationId: 'obs-3', createdAt: DateTime.utc(2026, 1, 3)),
      makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
      makeItem(observationId: 'obs-2', createdAt: DateTime.utc(2026, 1, 2)),
    ]);

    final batch = await store.peekBatch(limit: 10);

    expect(batch.map((q) => q.snapshot.observationId).toList(), [
      'obs-1',
      'obs-2',
      'obs-3',
    ]);
  });

  test('peekBatch limit ile sinirlanir', () async {
    await store.enqueueAll([
      makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
      makeItem(observationId: 'obs-2', createdAt: DateTime.utc(2026, 1, 2)),
      makeItem(observationId: 'obs-3', createdAt: DateTime.utc(2026, 1, 3)),
    ]);

    final batch = await store.peekBatch(limit: 2);

    expect(batch.length, 2);
    expect(batch.map((q) => q.snapshot.observationId).toList(), [
      'obs-1',
      'obs-2',
    ]);
  });

  test('removeSent yalnizca belirtilen kayitlari siler', () async {
    await store.enqueueAll([
      makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
      makeItem(observationId: 'obs-2', createdAt: DateTime.utc(2026, 1, 2)),
      makeItem(observationId: 'obs-3', createdAt: DateTime.utc(2026, 1, 3)),
    ]);

    await store.removeSent(['obs-1', 'obs-3']);

    final remaining = await store.peekBatch(limit: 10);
    expect(remaining.map((q) => q.snapshot.observationId).toList(), ['obs-2']);
  });

  test(
    'kaydin beacon icerigi ve kapsam bilgisi geri okunurken korunur',
    () async {
      await store.enqueue(
        QueuedObservation(
          snapshot: ObservationSnapshot(
            observationId: 'obs-1',
            observedAt: '2026-01-01T00:00:00.000Z',
            beacons: const [
              ObservedBeacon(
                uuid: 'UUID-1',
                major: 1,
                minor: 2,
                rssi: -55,
                txPower: -59,
              ),
            ],
            appVersion: '1.2.3',
          ),
          congressId: 'congress-42',
          userId: 'user-7',
          createdAt: DateTime.utc(2026, 1, 1),
        ),
      );

      final batch = await store.peekBatch(limit: 1);
      final restored = batch.single;

      expect(restored.congressId, 'congress-42');
      expect(restored.userId, 'user-7');
      expect(restored.snapshot.appVersion, '1.2.3');
      expect(restored.snapshot.beacons.single.uuid, 'UUID-1');
      expect(restored.snapshot.beacons.single.major, 1);
      expect(restored.snapshot.beacons.single.minor, 2);
      expect(restored.snapshot.beacons.single.rssi, -55);
      expect(restored.snapshot.beacons.single.txPower, -59);
    },
  );

  test('pruneOlderThan yalnizca yas sinirindan eski kayitlari siler', () async {
    final now = DateTime.now().toUtc();
    await store.enqueueAll([
      makeItem(
        observationId: 'eski',
        createdAt: now.subtract(const Duration(hours: 100)),
      ),
      makeItem(
        observationId: 'yeni',
        createdAt: now.subtract(const Duration(hours: 1)),
      ),
    ]);

    final deleted = await store.pruneOlderThan(const Duration(hours: 72));

    expect(deleted, 1);
    final remaining = await store.peekBatch(limit: 10);
    expect(remaining.map((q) => q.snapshot.observationId).toList(), ['yeni']);
  });

  test('pruneOverCapacity tavani asan EN ESKI kayitlari siler', () async {
    final now = DateTime.now().toUtc();
    await store.enqueueAll([
      for (var i = 0; i < 5; i++)
        makeItem(
          observationId: 'obs-$i',
          createdAt: now.add(Duration(seconds: i)),
        ),
    ]);

    final deleted = await store.pruneOverCapacity(3);

    expect(deleted, 2);
    final remaining = await store.peekBatch(limit: 10);
    // En yeni 3 kayit (obs-2, obs-3, obs-4) kalmali - en eski 2si (obs-0, obs-1) silindi.
    expect(remaining.map((q) => q.snapshot.observationId).toList(), [
      'obs-2',
      'obs-3',
      'obs-4',
    ]);
  });

  test('pruneOverCapacity tavan asilmadiysa hicbir sey silmez', () async {
    await store.enqueueAll([
      makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
      makeItem(observationId: 'obs-2', createdAt: DateTime.utc(2026, 1, 2)),
    ]);

    final deleted = await store.pruneOverCapacity(10);

    expect(deleted, 0);
    expect(await store.count(), 2);
  });

  test(
    'clearForScopeChange kuyugu tamamen bosaltir ve silinen sayiyi doner',
    () async {
      await store.enqueueAll([
        makeItem(observationId: 'obs-1', createdAt: DateTime.utc(2026, 1, 1)),
        makeItem(observationId: 'obs-2', createdAt: DateTime.utc(2026, 1, 2)),
      ]);

      final deleted = await store.clearForScopeChange();

      expect(deleted, 2);
      expect(await store.count(), 0);
    },
  );
}
