import '../../../models/observation_models.dart';

/// Kalici kuyruga giren tek bir gozlem - `ObservationSnapshot`in kendisine
/// EK olarak, HANGI kongre/kullanici icin toplandigini da tasir (bkz. Faz 8
/// talimati "kapsam kuralari": kongre/kullanici degisince eski kayitlarin
/// YANLIS kongreye/kullaniciya gonderilmesini onlemek icin bu bilgi SART).
class QueuedObservation {
  const QueuedObservation({
    required this.snapshot,
    required this.congressId,
    required this.userId,
    required this.createdAt,
  });

  final ObservationSnapshot snapshot;
  final String congressId;
  final String userId;
  final DateTime createdAt;
}

/// `BeaconObservationService`nin dogrudan SQLite'a baglanmamasi icin arayuz
/// (bkz. Faz 8 talimati §2) - depolama ileride degisirse servisi etkilemez,
/// testte sahte (fake) bir uygulamayla degistirilebilir.
abstract class ObservationQueueStore {
  /// Tek kayit ekler. Ayni `observationId` zaten kuyruktaysa SESSIZCE
  /// yoksayilir (bkz. tablo tanimi - `observation_id` UNIQUE).
  Future<void> enqueue(QueuedObservation item);

  /// Toplu ekleme - tek islemde (transaction) yazilir.
  Future<void> enqueueAll(List<QueuedObservation> items);

  /// Gonderilecek EN ESKI `limit` kaydi getirir (en eskiden yeniye sirali -
  /// bkz. Faz 8 talimati §4 "Gonderim sirasi en eskiden yeniye olsun").
  Future<List<QueuedObservation>> peekBatch({required int limit});

  /// Basariyla gonderilen kayitlari kuyruktan siler.
  Future<void> removeSent(List<String> observationIds);

  /// Kuyruk boyutu (teshis/log icin).
  Future<int> count();

  /// [age]'den eski kayitlari siler, silinen kayit sayisini dondurur.
  Future<int> pruneOlderThan(Duration age);

  /// Kuyruk [maxRows]'u asiyorsa EN ESKI kayitlari silip sinira ceker,
  /// silinen kayit sayisini dondurur.
  Future<int> pruneOverCapacity(int maxRows);

  /// Kongre/kullanici degisiminde veya cikista kuyrugu TAMAMEN temizler,
  /// silinen kayit sayisini dondurur (bkz. Faz 8 talimati §5 - hangi
  /// kayitlarin silinecegine karar vermek CAGIRAN tarafin - yani
  /// `ObservationLifecycleNotifier`in - sorumlulugudur, cunku eski/yeni
  /// kongre-kullanici kimligini bilen odur).
  Future<int> clearForScopeChange();
}
