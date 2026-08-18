/// Faz 5 `/mobile/*` okuma uclarina karsilik gelen modeller (bkz.
/// `shared/openapi.yaml`, `Mobile` tag'i). Hepsi elle yazilmis
/// `fromJson` - projede kod ureteci (freezed/json_serializable)
/// kullanilmiyor (bkz. `models/auth_models.dart` ile ayni desen).
library;

import '../core/network/cached_content_notifier.dart';

enum ProgramRoleType {
  moderator,
  speaker,
  discussant;

  static ProgramRoleType fromJson(String value) => switch (value) {
    'MODERATOR' => ProgramRoleType.moderator,
    'SPEAKER' => ProgramRoleType.speaker,
    'DISCUSSANT' => ProgramRoleType.discussant,
    _ => ProgramRoleType.speaker,
  };

  /// Arayuzde beacon/teknik terim degil, dogrudan roldeki Turkce etiket
  /// (bkz. Faz 7 talimati §2/§5).
  String get label => switch (this) {
    ProgramRoleType.moderator => 'Moderatör',
    ProgramRoleType.speaker => 'Konuşmacı',
    ProgramRoleType.discussant => 'Tartışmacı',
  };
}

class MobileProgramRole {
  const MobileProgramRole({
    required this.id,
    required this.type,
    required this.rawName,
  });

  final String id;
  final ProgramRoleType type;
  // Katilimciya HER ZAMAN unvanli/ham hali gosterilir (bkz. Faz 7 talimati
  // §3) - `userId`/`matchStatus` mobil ekranlarda hic gosterilmedigi icin
  // (kisisel veri siniri, bkz. docs/decisions.md Faz 5) modele alinmadi.
  final String rawName;

  factory MobileProgramRole.fromJson(Map<String, dynamic> json) {
    return MobileProgramRole(
      id: json['id'] as String,
      type: ProgramRoleType.fromJson(json['type'] as String),
      rawName: json['rawName'] as String,
    );
  }
}

class MobilePresentation {
  const MobilePresentation({
    required this.id,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.abstract,
    required this.roles,
  });

  final String id;
  final String title;
  final DateTime? startTime;
  final DateTime? endTime;
  final String? abstract;
  final List<MobileProgramRole> roles;

  factory MobilePresentation.fromJson(Map<String, dynamic> json) {
    return MobilePresentation(
      id: json['id'] as String,
      title: json['title'] as String,
      startTime: json['startTime'] != null
          ? DateTime.parse(json['startTime'] as String)
          : null,
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
      abstract: json['abstract'] as String?,
      roles: (json['roles'] as List<dynamic>)
          .map((e) => MobileProgramRole.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MobileSession {
  const MobileSession({
    required this.id,
    required this.hallId,
    required this.hallName,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.description,
    required this.sessionType,
    required this.dayLabel,
    required this.keywords,
    required this.series,
    required this.roles,
    required this.presentations,
  });

  final String id;
  final String hallId;
  final String hallName;
  final String title;
  final DateTime startTime;
  final DateTime endTime;
  final String? description;
  final String? sessionType;
  final String? dayLabel;
  final String? keywords;
  // Faz 4d'nin `event.series` alani - Faz 10'da ilk kez mobile'a acildi
  // (bkz. docs/decisions.md "Faz 10").
  final String? series;
  final List<MobileProgramRole> roles;
  final List<MobilePresentation> presentations;

  factory MobileSession.fromJson(Map<String, dynamic> json) {
    final hall = json['hall'] as Map<String, dynamic>;
    return MobileSession(
      id: json['id'] as String,
      hallId: json['hallId'] as String,
      hallName: hall['name'] as String,
      title: json['title'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      description: json['description'] as String?,
      sessionType: json['sessionType'] as String?,
      dayLabel: json['dayLabel'] as String?,
      keywords: json['keywords'] as String?,
      series: json['series'] as String?,
      roles: (json['roles'] as List<dynamic>)
          .map((e) => MobileProgramRole.fromJson(e as Map<String, dynamic>))
          .toList(),
      presentations: (json['presentations'] as List<dynamic>)
          .map((e) => MobilePresentation.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MobileProgramResponse implements HasGeneratedAt {
  const MobileProgramResponse({
    required this.generatedAt,
    required this.sessions,
  });

  @override
  final DateTime generatedAt;
  final List<MobileSession> sessions;

  factory MobileProgramResponse.fromJson(Map<String, dynamic> json) {
    return MobileProgramResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      sessions: (json['sessions'] as List<dynamic>)
          .map((e) => MobileSession.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MobileNextSession {
  const MobileNextSession({
    required this.sessionId,
    required this.presentationId,
    required this.title,
    required this.hallName,
    required this.startTime,
    required this.endTime,
    required this.roleType,
    required this.isOngoing,
  });

  final String sessionId;
  final String? presentationId;
  final String title;
  final String hallName;
  final DateTime startTime;
  final DateTime endTime;
  final ProgramRoleType roleType;
  final bool isOngoing;

  factory MobileNextSession.fromJson(Map<String, dynamic> json) {
    return MobileNextSession(
      sessionId: json['sessionId'] as String,
      presentationId: json['presentationId'] as String?,
      title: json['title'] as String,
      hallName: json['hallName'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      roleType: ProgramRoleType.fromJson(json['roleType'] as String),
      isOngoing: json['isOngoing'] as bool,
    );
  }
}

class MobileMyProgramItem {
  const MobileMyProgramItem({
    required this.sessionId,
    required this.presentationId,
    required this.title,
    required this.hallName,
    required this.startTime,
    required this.endTime,
    required this.roleType,
  });

  final String sessionId;
  final String? presentationId;
  final String title;
  final String hallName;
  final DateTime startTime;
  final DateTime endTime;
  final ProgramRoleType roleType;

  factory MobileMyProgramItem.fromJson(Map<String, dynamic> json) {
    return MobileMyProgramItem(
      sessionId: json['sessionId'] as String,
      presentationId: json['presentationId'] as String?,
      title: json['title'] as String,
      hallName: json['hallName'] as String,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: DateTime.parse(json['endTime'] as String),
      roleType: ProgramRoleType.fromJson(json['roleType'] as String),
    );
  }
}

class MobileMyProgramResponse implements HasGeneratedAt {
  const MobileMyProgramResponse({
    required this.generatedAt,
    required this.items,
  });

  @override
  final DateTime generatedAt;
  final List<MobileMyProgramItem> items;

  factory MobileMyProgramResponse.fromJson(Map<String, dynamic> json) {
    return MobileMyProgramResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      items: (json['items'] as List<dynamic>)
          .map((e) => MobileMyProgramItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MobileHomeCongress {
  const MobileHomeCongress({
    required this.id,
    required this.name,
    required this.fullName,
    required this.startDate,
    required this.endDate,
    required this.description,
    required this.coverImageUrl,
    required this.mainVenueName,
  });

  final String id;
  final String name;
  final String? fullName;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? description;
  final String? coverImageUrl;
  final String? mainVenueName;

  /// Karttaki basligin altinda gosterilecek resmi ad - `fullName` boluysa
  /// ona, degilse kisa `name`e duser.
  String get displayName => fullName ?? name;

  factory MobileHomeCongress.fromJson(Map<String, dynamic> json) {
    return MobileHomeCongress(
      id: json['id'] as String,
      name: json['name'] as String,
      fullName: json['fullName'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'] as String)
          : null,
      description: json['description'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      mainVenueName: json['mainVenueName'] as String?,
    );
  }
}

class MobileHomeCounts {
  const MobileHomeCounts({
    required this.announcements,
    required this.sponsors,
    required this.speakers,
    required this.venues,
    required this.infoSections,
    required this.sessions,
  });

  final int announcements;
  final int sponsors;
  final int speakers;
  final int venues;
  final int infoSections;
  final int sessions;

  factory MobileHomeCounts.fromJson(Map<String, dynamic> json) {
    return MobileHomeCounts(
      announcements: json['announcements'] as int,
      sponsors: json['sponsors'] as int,
      speakers: json['speakers'] as int,
      venues: json['venues'] as int,
      infoSections: json['infoSections'] as int,
      sessions: json['sessions'] as int,
    );
  }
}

class MobileHomeAnnouncementsSummary {
  const MobileHomeAnnouncementsSummary({
    required this.hasPinned,
    required this.latestPublishedAt,
  });

  final bool hasPinned;
  final DateTime? latestPublishedAt;

  factory MobileHomeAnnouncementsSummary.fromJson(Map<String, dynamic> json) {
    return MobileHomeAnnouncementsSummary(
      hasPinned: json['hasPinned'] as bool,
      latestPublishedAt: json['latestPublishedAt'] != null
          ? DateTime.parse(json['latestPublishedAt'] as String)
          : null,
    );
  }
}

class MobileHomeResponse implements HasGeneratedAt {
  const MobileHomeResponse({
    required this.generatedAt,
    required this.congress,
    required this.counts,
    required this.announcements,
    required this.myNextSession,
  });

  @override
  final DateTime generatedAt;
  final MobileHomeCongress congress;
  final MobileHomeCounts counts;
  final MobileHomeAnnouncementsSummary announcements;
  final MobileNextSession? myNextSession;

  factory MobileHomeResponse.fromJson(Map<String, dynamic> json) {
    return MobileHomeResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      congress: MobileHomeCongress.fromJson(
        json['congress'] as Map<String, dynamic>,
      ),
      counts: MobileHomeCounts.fromJson(json['counts'] as Map<String, dynamic>),
      announcements: MobileHomeAnnouncementsSummary.fromJson(
        json['announcements'] as Map<String, dynamic>,
      ),
      myNextSession: json['myNextSession'] != null
          ? MobileNextSession.fromJson(
              json['myNextSession'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class MobileAnnouncement {
  const MobileAnnouncement({
    required this.id,
    required this.title,
    required this.body,
    required this.isPinned,
    required this.publishedAt,
  });

  final String id;
  final String title;
  final String body;
  final bool isPinned;
  final DateTime publishedAt;

  factory MobileAnnouncement.fromJson(Map<String, dynamic> json) {
    return MobileAnnouncement(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      isPinned: json['isPinned'] as bool,
      publishedAt: DateTime.parse(json['publishedAt'] as String),
    );
  }
}

class MobileAnnouncementsResponse implements HasGeneratedAt {
  const MobileAnnouncementsResponse({
    required this.generatedAt,
    required this.announcements,
  });

  @override
  final DateTime generatedAt;
  final List<MobileAnnouncement> announcements;

  factory MobileAnnouncementsResponse.fromJson(Map<String, dynamic> json) {
    return MobileAnnouncementsResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      announcements: (json['announcements'] as List<dynamic>)
          .map((e) => MobileAnnouncement.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

enum SponsorTier {
  platinum,
  gold,
  silver,
  bronze,
  supporter;

  static SponsorTier fromJson(String value) => switch (value) {
    'PLATINUM' => SponsorTier.platinum,
    'GOLD' => SponsorTier.gold,
    'SILVER' => SponsorTier.silver,
    'BRONZE' => SponsorTier.bronze,
    'SUPPORTER' => SponsorTier.supporter,
    _ => SponsorTier.supporter,
  };

  String get label => switch (this) {
    SponsorTier.platinum => 'Platin',
    SponsorTier.gold => 'Altın',
    SponsorTier.silver => 'Gümüş',
    SponsorTier.bronze => 'Bronz',
    SponsorTier.supporter => 'Destekçi',
  };
}

class MobileSponsor {
  const MobileSponsor({
    required this.id,
    required this.name,
    required this.tier,
    required this.logoUrl,
    required this.websiteUrl,
    required this.description,
  });

  final String id;
  final String name;
  final SponsorTier tier;
  final String? logoUrl;
  final String? websiteUrl;
  final String? description;

  factory MobileSponsor.fromJson(Map<String, dynamic> json) {
    return MobileSponsor(
      id: json['id'] as String,
      name: json['name'] as String,
      tier: SponsorTier.fromJson(json['tier'] as String),
      logoUrl: json['logoUrl'] as String?,
      websiteUrl: json['websiteUrl'] as String?,
      description: json['description'] as String?,
    );
  }
}

class MobileSponsorsResponse implements HasGeneratedAt {
  const MobileSponsorsResponse({
    required this.generatedAt,
    required this.sponsors,
  });

  @override
  final DateTime generatedAt;
  // Sunucu ZATEN prestij sirasina gore doner (PLATINUM -> SUPPORTER) -
  // mobil tekrar SIRALAMAZ (bkz. shared/openapi.yaml).
  final List<MobileSponsor> sponsors;

  factory MobileSponsorsResponse.fromJson(Map<String, dynamic> json) {
    return MobileSponsorsResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      sponsors: (json['sponsors'] as List<dynamic>)
          .map((e) => MobileSponsor.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MobileSpeaker {
  const MobileSpeaker({
    required this.id,
    required this.fullName,
    required this.title,
    required this.institution,
    required this.country,
    required this.bio,
    required this.photoUrl,
  });

  final String id;
  final String fullName;
  final String? title;
  final String? institution;
  final String? country;
  final String? bio;
  final String? photoUrl;

  factory MobileSpeaker.fromJson(Map<String, dynamic> json) {
    return MobileSpeaker(
      id: json['id'] as String,
      fullName: json['fullName'] as String,
      title: json['title'] as String?,
      institution: json['institution'] as String?,
      country: json['country'] as String?,
      bio: json['bio'] as String?,
      photoUrl: json['photoUrl'] as String?,
    );
  }
}

class MobileSpeakersResponse implements HasGeneratedAt {
  const MobileSpeakersResponse({
    required this.generatedAt,
    required this.speakers,
  });

  @override
  final DateTime generatedAt;
  final List<MobileSpeaker> speakers;

  factory MobileSpeakersResponse.fromJson(Map<String, dynamic> json) {
    return MobileSpeakersResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      speakers: (json['speakers'] as List<dynamic>)
          .map((e) => MobileSpeaker.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

enum VenueType {
  main,
  hotel;

  static VenueType fromJson(String value) =>
      value == 'MAIN' ? VenueType.main : VenueType.hotel;
}

class MobileVenue {
  const MobileVenue({
    required this.id,
    required this.type,
    required this.name,
    required this.address,
    required this.city,
    required this.phone,
    required this.websiteUrl,
    required this.mapUrl,
    required this.description,
    required this.imageUrl,
  });

  final String id;
  final VenueType type;
  final String name;
  final String? address;
  final String? city;
  final String? phone;
  final String? websiteUrl;
  final String? mapUrl;
  final String? description;
  final String? imageUrl;

  factory MobileVenue.fromJson(Map<String, dynamic> json) {
    return MobileVenue(
      id: json['id'] as String,
      type: VenueType.fromJson(json['type'] as String),
      name: json['name'] as String,
      address: json['address'] as String?,
      city: json['city'] as String?,
      phone: json['phone'] as String?,
      websiteUrl: json['websiteUrl'] as String?,
      mapUrl: json['mapUrl'] as String?,
      description: json['description'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class MobileVenuesResponse implements HasGeneratedAt {
  const MobileVenuesResponse({required this.generatedAt, required this.venues});

  @override
  final DateTime generatedAt;
  // Sunucu MAIN'i basa koyar, mobil tekrar SIRALAMAZ.
  final List<MobileVenue> venues;

  factory MobileVenuesResponse.fromJson(Map<String, dynamic> json) {
    return MobileVenuesResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      venues: (json['venues'] as List<dynamic>)
          .map((e) => MobileVenue.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class MobileInfoSection {
  const MobileInfoSection({
    required this.id,
    required this.title,
    required this.body,
  });

  final String id;
  final String title;
  // Markdown formatinda - `flutter_markdown_plus` ile render edilir
  // (bkz. Faz 7 talimati §1, §4).
  final String body;

  factory MobileInfoSection.fromJson(Map<String, dynamic> json) {
    return MobileInfoSection(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
    );
  }
}

class MobileInfoSectionsResponse implements HasGeneratedAt {
  const MobileInfoSectionsResponse({
    required this.generatedAt,
    required this.infoSections,
  });

  @override
  final DateTime generatedAt;
  final List<MobileInfoSection> infoSections;

  factory MobileInfoSectionsResponse.fromJson(Map<String, dynamic> json) {
    return MobileInfoSectionsResponse(
      generatedAt: DateTime.parse(json['generatedAt'] as String),
      infoSections: (json['infoSections'] as List<dynamic>)
          .map((e) => MobileInfoSection.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
