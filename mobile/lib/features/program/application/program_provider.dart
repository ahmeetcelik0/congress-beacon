import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/cached_content_notifier.dart';
import '../../../models/mobile_content_models.dart';
import '../../auth/application/auth_session_provider.dart';

/// `GET /mobile/program` - FiLTRESIZ, kongrenin TUM programi tek seferde
/// cekilip KALICI olarak (dosya + ETag) onbelleklenir (bkz. Faz 7 talimati
/// §1, §3). Gun/salon filtresi ve arama TAMAMEN yerelde
/// (`program_page.dart`) yapilir - sunucunun `day`/`hallId`/`search`
/// parametreleri BILEREK kullanilmiyor, cevrimdisi calisabilmek icin
/// (bkz. talimat: "Program onbellekte oldugu icin aramayi yerelde yap").
class ProgramNotifier extends CachedContentNotifier<MobileProgramResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'program_$congressId';
  }

  @override
  bool get isPersistent => true;

  @override
  MobileProgramResponse decode(dynamic json) =>
      MobileProgramResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(
      ApiEndpoints.mobileProgram,
      requiresAuth: true,
      etag: etag,
    );
  }
}

final programProvider =
    AsyncNotifierProvider.autoDispose<ProgramNotifier, MobileProgramResponse>(
      ProgramNotifier.new,
    );

/// `GET /mobile/my-program` - katilimcinin kendi konusmaci/moderator/
/// tartismaci oldugu program (Profilim sekmesindeki "Benim Programim"
/// bolumu icin, bkz. Faz 7 talimati §5).
class MyProgramNotifier extends CachedContentNotifier<MobileMyProgramResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'my_program_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileMyProgramResponse decode(dynamic json) =>
      MobileMyProgramResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileMyProgram, requiresAuth: true);
  }
}

final myProgramProvider =
    AsyncNotifierProvider.autoDispose<
      MyProgramNotifier,
      MobileMyProgramResponse
    >(MyProgramNotifier.new);
