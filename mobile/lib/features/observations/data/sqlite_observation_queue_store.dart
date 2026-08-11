import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../../../models/observation_models.dart';
import '../domain/observation_queue_store.dart';

/// `ObservationQueueStore`nin SQLite implementasyonu. MySQL'in YERINE GECMEZ
/// - sunucuya ulasilamadiginda gonderilmeyi bekleyen gozlemler icin telefon
/// UZERINDE tek bir dosyaya yazan gecici bir tampondur (bkz. Faz 8 talimati
/// "Neden SQLite - MySQL'in yerine gecmiyor"). Tablo, MySQL semasinin kopyasi
/// DEGILDIR - yalnizca "gonderilmeyi bekleyen gozlem"i tasiyan birkac kolon.
///
/// Test edilebilirlik: bu sinif `openDatabase`i (sqflite'in GLOBAL
/// `databaseFactory`si uzerinden) kullanir - testler
/// `databaseFactory = databaseFactoryFfi` atayip [databasePath] parametresine
/// `inMemoryDatabasePath` vererek gercek SQLite semantigini (UNIQUE, ORDER BY,
/// DELETE) cihaz/emulator OLMADAN dogrulayabilir.
class SqliteObservationQueueStore implements ObservationQueueStore {
  SqliteObservationQueueStore({String? databasePath})
    : _databasePathOverride = databasePath;

  final String? _databasePathOverride;
  Database? _database;
  Future<Database>? _openFuture;

  static const String _table = 'observation_queue';

  Future<Database> get _db {
    final existing = _database;
    if (existing != null) return Future.value(existing);
    return _openFuture ??= _open();
  }

  /// Yalnizca testler icin: sqflite ayni [databasePath] icin ACIK bir
  /// baglantiyi tekrar `openDatabase` cagrildiginda YENIDEN kullanir - testler
  /// arasinda `inMemoryDatabasePath` ile izolasyon saglamak icin her testten
  /// sonra baglanti kapatilmalidir (bkz. sqlite_observation_queue_store_test.dart).
  /// Uretimde COGRAFI olarak TEK bir saglayici (Provider) ornegi uygulama
  /// omru boyunca yasadigi icin ASLA cagrilmaz.
  @visibleForTesting
  Future<void> close() async {
    final db = _database;
    _database = null;
    _openFuture = null;
    if (db != null) {
      await db.close();
    }
  }

  Future<Database> _open() async {
    final path =
        _databasePathOverride ??
        p.join(await getDatabasesPath(), 'observation_queue.db');
    final db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE $_table (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            observation_id TEXT    NOT NULL UNIQUE,
            observed_at    TEXT    NOT NULL,
            beacons_json   TEXT    NOT NULL,
            app_version    TEXT,
            congress_id    TEXT    NOT NULL,
            user_id        TEXT    NOT NULL,
            created_at     TEXT    NOT NULL
          )
        ''');
        await db.execute(
          'CREATE INDEX idx_queue_created ON $_table(created_at)',
        );
      },
    );
    _database = db;
    return db;
  }

  Map<String, Object?> _toRow(QueuedObservation item) {
    return {
      'observation_id': item.snapshot.observationId,
      'observed_at': item.snapshot.observedAt,
      'beacons_json': jsonEncode(
        item.snapshot.beacons.map((b) => b.toJson()).toList(),
      ),
      'app_version': item.snapshot.appVersion,
      'congress_id': item.congressId,
      'user_id': item.userId,
      'created_at': item.createdAt.toIso8601String(),
    };
  }

  QueuedObservation _fromRow(Map<String, Object?> row) {
    final beaconsJson = jsonDecode(row['beacons_json']! as String) as List;
    return QueuedObservation(
      snapshot: ObservationSnapshot(
        observationId: row['observation_id']! as String,
        observedAt: row['observed_at']! as String,
        beacons: beaconsJson
            .map((b) => ObservedBeacon.fromJson(b as Map<String, dynamic>))
            .toList(),
        appVersion: row['app_version'] as String?,
      ),
      congressId: row['congress_id']! as String,
      userId: row['user_id']! as String,
      createdAt: DateTime.parse(row['created_at']! as String),
    );
  }

  @override
  Future<void> enqueue(QueuedObservation item) async {
    final db = await _db;
    await db.insert(
      _table,
      _toRow(item),
      conflictAlgorithm: ConflictAlgorithm.ignore,
    );
  }

  @override
  Future<void> enqueueAll(List<QueuedObservation> items) async {
    if (items.isEmpty) return;
    final db = await _db;
    final batch = db.batch();
    for (final item in items) {
      batch.insert(
        _table,
        _toRow(item),
        conflictAlgorithm: ConflictAlgorithm.ignore,
      );
    }
    await batch.commit(noResult: true);
  }

  @override
  Future<List<QueuedObservation>> peekBatch({required int limit}) async {
    final db = await _db;
    final rows = await db.query(
      _table,
      orderBy: 'created_at ASC',
      limit: limit,
    );
    return rows.map(_fromRow).toList();
  }

  @override
  Future<void> removeSent(List<String> observationIds) async {
    if (observationIds.isEmpty) return;
    final db = await _db;
    final placeholders = List.filled(observationIds.length, '?').join(',');
    await db.delete(
      _table,
      where: 'observation_id IN ($placeholders)',
      whereArgs: observationIds,
    );
  }

  @override
  Future<int> count() async {
    final db = await _db;
    final result = await db.rawQuery('SELECT COUNT(*) AS c FROM $_table');
    return Sqflite.firstIntValue(result) ?? 0;
  }

  @override
  Future<int> pruneOlderThan(Duration age) async {
    final db = await _db;
    final cutoff = DateTime.now().toUtc().subtract(age).toIso8601String();
    final deleted = await db.delete(
      _table,
      where: 'created_at < ?',
      whereArgs: [cutoff],
    );
    if (deleted > 0 && kDebugMode) {
      debugPrint(
        '[ObservationQueue] $deleted kayit SILINDI (yaslanma, >${age.inHours}sa)',
      );
    }
    return deleted;
  }

  @override
  Future<int> pruneOverCapacity(int maxRows) async {
    final db = await _db;
    final total = await count();
    final over = total - maxRows;
    if (over <= 0) return 0;
    // En eski `over` kaydin id'lerini bulup silen alt-sorgu - `LIMIT` DELETE
    // icinde dogrudan desteklenmedigi icin (sqflite/sqlite3 varsayilan derleme).
    final deleted = await db.rawDelete(
      '''
      DELETE FROM $_table WHERE id IN (
        SELECT id FROM $_table ORDER BY created_at ASC LIMIT ?
      )
      ''',
      [over],
    );
    if (deleted > 0 && kDebugMode) {
      debugPrint(
        '[ObservationQueue] $deleted kayit SILINDI (tavan asimi, >$maxRows)',
      );
    }
    return deleted;
  }

  @override
  Future<int> clearForScopeChange() async {
    final db = await _db;
    return db.delete(_table);
  }
}
