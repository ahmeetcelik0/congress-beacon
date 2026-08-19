import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/cached_content_notifier.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../models/mobile_content_models.dart';
import '../../auth/application/auth_session_provider.dart';

/// `GET /mobile/home` - kucuk ve sik degisen bir yanit (siradaki sunum
/// "su an devam ediyor"a donebilir) oldugu icin bellek-ici onbellek
/// yeterli (bkz. Faz 7 talimati §1 "basit tut"). Ekran her acildiginda
/// (autoDispose) taze cekilir; onbellek yalnizca ayni ziyaret icinde
/// yenile/geri-don gibi durumlarda agi tekrar yormamak icin.
class HomeNotifier extends CachedContentNotifier<MobileHomeResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'home_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileHomeResponse decode(dynamic json) =>
      MobileHomeResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileHome, requiresAuth: true);
  }
}

final homeProvider =
    AsyncNotifierProvider.autoDispose<HomeNotifier, MobileHomeResponse>(
      HomeNotifier.new,
    );

/// Duyurular kartinda kirmizi nokta gosterilsin mi - sunucunun
/// `latestPublishedAt`i, cihazda saklanan "son gorulen" damgasindan
/// YENIYSE true (bkz. Faz 7 talimati §2, docs/decisions.md Faz 5). Ekran
/// Duyurular'i actiginda `markAnnouncementsSeen` cagrilip bu provider
/// invalidate edilir - rozet kaybolur.
final announcementsHasUnseenProvider = FutureProvider.autoDispose<bool>((
  ref,
) async {
  final home = await ref.watch(homeProvider.future);
  final latest = home.announcements.latestPublishedAt;
  if (latest == null) return false;

  final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
  if (congressId == null) return false;

  final lastSeen = await ref
      .read(secureStorageProvider)
      .getAnnouncementsLastSeen(congressId);
  if (lastSeen == null) return true;
  return latest.isAfter(lastSeen);
});

/// Duyurular ekrani acildiginda cagrilir - "son gorulen" damgasini SIMDIYE
/// gunceller ve rozet provider'ini invalidate eder ki Ana Sayfa'ya donuldugunde
/// rozet kaybolmus olsun. `WidgetRef` alir (cagiran taraf hep bir
/// ConsumerState/ConsumerWidget icinden cagirir).
Future<void> markAnnouncementsSeen(WidgetRef ref) async {
  final congressId = ref.read(authSessionProvider).value?.activeCongressId;
  if (congressId == null) return;
  await ref
      .read(secureStorageProvider)
      .saveAnnouncementsLastSeen(congressId, DateTime.now());
  ref.invalidate(announcementsHasUnseenProvider);
}
