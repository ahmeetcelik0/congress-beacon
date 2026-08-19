import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/network/cached_content_notifier.dart';
import '../../../models/mobile_content_models.dart';
import '../../auth/application/auth_session_provider.dart';

/// Bes kucuk icerik ucu (duyuru/sponsor/konusmaci/mekan/genel-bilgi) icin
/// bellek-ici onbellekli Notifier'lar - hepsi ayni basit deseni izler
/// (bkz. Faz 7 talimati §1 "bunlar kucuk; bellek ici onbellek + hata
/// durumunda son bilinen veri yeterli"), bu yuzden tek dosyada toplandi.

class AnnouncementsNotifier
    extends CachedContentNotifier<MobileAnnouncementsResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'announcements_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileAnnouncementsResponse decode(dynamic json) =>
      MobileAnnouncementsResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileAnnouncements, requiresAuth: true);
  }
}

final announcementsProvider =
    AsyncNotifierProvider.autoDispose<
      AnnouncementsNotifier,
      MobileAnnouncementsResponse
    >(AnnouncementsNotifier.new);

class SponsorsNotifier extends CachedContentNotifier<MobileSponsorsResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'sponsors_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileSponsorsResponse decode(dynamic json) =>
      MobileSponsorsResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileSponsors, requiresAuth: true);
  }
}

final sponsorsProvider =
    AsyncNotifierProvider.autoDispose<SponsorsNotifier, MobileSponsorsResponse>(
      SponsorsNotifier.new,
    );

class SpeakersNotifier extends CachedContentNotifier<MobileSpeakersResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'speakers_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileSpeakersResponse decode(dynamic json) =>
      MobileSpeakersResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileSpeakers, requiresAuth: true);
  }
}

final speakersProvider =
    AsyncNotifierProvider.autoDispose<SpeakersNotifier, MobileSpeakersResponse>(
      SpeakersNotifier.new,
    );

class VenuesNotifier extends CachedContentNotifier<MobileVenuesResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'venues_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileVenuesResponse decode(dynamic json) =>
      MobileVenuesResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileVenues, requiresAuth: true);
  }
}

final venuesProvider =
    AsyncNotifierProvider.autoDispose<VenuesNotifier, MobileVenuesResponse>(
      VenuesNotifier.new,
    );

class InfoSectionsNotifier
    extends CachedContentNotifier<MobileInfoSectionsResponse> {
  @override
  String get cacheKey {
    final congressId = ref.watch(authSessionProvider).value?.activeCongressId;
    return 'info_sections_$congressId';
  }

  @override
  bool get isPersistent => false;

  @override
  MobileInfoSectionsResponse decode(dynamic json) =>
      MobileInfoSectionsResponse.fromJson(json as Map<String, dynamic>);

  @override
  Future<ApiGetResult> fetchRemote(ApiClient client, String? etag) {
    return client.get(ApiEndpoints.mobileInfoSections, requiresAuth: true);
  }
}

final infoSectionsProvider =
    AsyncNotifierProvider.autoDispose<
      InfoSectionsNotifier,
      MobileInfoSectionsResponse
    >(InfoSectionsNotifier.new);
