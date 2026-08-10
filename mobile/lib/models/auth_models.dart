/// Faz 1 `/auth/*` sozlesmesine karsilik gelen modeller
/// (bkz. `shared/openapi.yaml`, `Auth` tag'i).
library;

class EmailOrPhoneRequest {
  const EmailOrPhoneRequest({required this.emailOrPhone});

  final String emailOrPhone;

  Map<String, dynamic> toJson() => {'emailOrPhone': emailOrPhone};
}

class MessageResponse {
  const MessageResponse({required this.message});

  final String message;

  factory MessageResponse.fromJson(Map<String, dynamic> json) {
    return MessageResponse(message: json['message'] as String);
  }
}

class LoginRequest {
  const LoginRequest({required this.emailOrPhone, required this.password});

  final String emailOrPhone;
  final String password;

  Map<String, dynamic> toJson() => {
    'emailOrPhone': emailOrPhone,
    'password': password,
  };
}

/// Katilimcinin kendi profil ozeti - baska bir katilimcinin bu sekilde
/// donmesi SOZ KONUSU DEGIL (Faz 5 kisisel veri siniri, yalnizca /auth/me
/// KENDI kullanicisi icin cagirilir).
class AuthUserSummary {
  const AuthUserSummary({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.phone,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String? email;
  final String? phone;

  String get fullName => '$firstName $lastName';

  factory AuthUserSummary.fromJson(Map<String, dynamic> json) {
    return AuthUserSummary(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
    );
  }

  // Faz 7.1: cevrimdisi soguk baslangicta gosterilecek son oturumu yerelde
  // saklamak icin (bkz. `SecureStorageService.saveLastKnownSession`).
  Map<String, dynamic> toJson() => {
    'id': id,
    'firstName': firstName,
    'lastName': lastName,
    'email': email,
    'phone': phone,
  };
}

class AuthCongressSummary {
  const AuthCongressSummary({
    required this.id,
    required this.name,
    required this.code,
    required this.startDate,
    required this.endDate,
  });

  final String id;
  final String name;
  final String code;
  final DateTime? startDate;
  final DateTime? endDate;

  factory AuthCongressSummary.fromJson(Map<String, dynamic> json) {
    return AuthCongressSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String,
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'] as String)
          : null,
    );
  }

  // Faz 7.1: bkz. AuthUserSummary.toJson yorumu.
  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'code': code,
    'startDate': startDate?.toIso8601String(),
    'endDate': endDate?.toIso8601String(),
  };
}

class LoginResponse {
  const LoginResponse({
    required this.accessToken,
    required this.mustChangePassword,
    required this.user,
    required this.congresses,
  });

  final String accessToken;
  final bool mustChangePassword;
  final AuthUserSummary user;
  final List<AuthCongressSummary> congresses;

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['accessToken'] as String,
      mustChangePassword: json['mustChangePassword'] as bool,
      user: AuthUserSummary.fromJson(json['user'] as Map<String, dynamic>),
      congresses: (json['congresses'] as List<dynamic>)
          .map((e) => AuthCongressSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Uygulama acilisinda ve oturum tazelemede kullanilan tek dogruluk
/// kaynagi - token gecerli mi, sifre degistirilmeli mi, aktif kongre
/// secilmis mi, hepsi burada (bkz. core/router/route_redirect.dart).
class MeResponse {
  const MeResponse({
    required this.user,
    required this.activeCongressId,
    required this.mustChangePassword,
    required this.congresses,
  });

  final AuthUserSummary user;
  final String? activeCongressId;
  final bool mustChangePassword;
  final List<AuthCongressSummary> congresses;

  factory MeResponse.fromJson(Map<String, dynamic> json) {
    return MeResponse(
      user: AuthUserSummary.fromJson(json['user'] as Map<String, dynamic>),
      activeCongressId: json['activeCongressId'] as String?,
      mustChangePassword: json['mustChangePassword'] as bool,
      congresses: (json['congresses'] as List<dynamic>)
          .map((e) => AuthCongressSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Su an aktif secili kongrenin ozeti - listede yoksa null (tutarsiz bir
  /// durum, normalde olmamali ama arayuz katmani bunu null-safe ele alsin).
  AuthCongressSummary? get activeCongress {
    if (activeCongressId == null) return null;
    for (final congress in congresses) {
      if (congress.id == activeCongressId) return congress;
    }
    return null;
  }

  // Faz 7.1: bkz. AuthUserSummary.toJson yorumu.
  Map<String, dynamic> toJson() => {
    'user': user.toJson(),
    'activeCongressId': activeCongressId,
    'mustChangePassword': mustChangePassword,
    'congresses': congresses.map((c) => c.toJson()).toList(),
  };
}

class ChangePasswordRequest {
  const ChangePasswordRequest({
    required this.currentPassword,
    required this.newPassword,
  });

  final String currentPassword;
  final String newPassword;

  Map<String, dynamic> toJson() => {
    'currentPassword': currentPassword,
    'newPassword': newPassword,
  };
}

class TokenResponse {
  const TokenResponse({required this.accessToken});

  final String accessToken;

  factory TokenResponse.fromJson(Map<String, dynamic> json) {
    return TokenResponse(accessToken: json['accessToken'] as String);
  }
}

class SelectCongressRequest {
  const SelectCongressRequest({required this.congressId});

  final String congressId;

  Map<String, dynamic> toJson() => {'congressId': congressId};
}

class MyCongressesResponse {
  const MyCongressesResponse({required this.congresses});

  final List<AuthCongressSummary> congresses;

  factory MyCongressesResponse.fromJson(Map<String, dynamic> json) {
    return MyCongressesResponse(
      congresses: (json['congresses'] as List<dynamic>)
          .map((e) => AuthCongressSummary.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class ErrorResponse {
  const ErrorResponse({
    required this.statusCode,
    required this.message,
    required this.error,
  });

  final int statusCode;
  final dynamic
  message; // Tek hata icin String, dogrulama hatalari icin List<String>
  final String error;

  factory ErrorResponse.fromJson(Map<String, dynamic> json) {
    return ErrorResponse(
      statusCode: json['statusCode'] as int? ?? 0,
      message: json['message'],
      error: json['error'] as String? ?? 'Unknown error',
    );
  }

  String get userFriendlyMessage {
    if (message is List) {
      return (message as List).join(', ');
    } else if (message is String) {
      return message as String;
    }
    return error;
  }
}
