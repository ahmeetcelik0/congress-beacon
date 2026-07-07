class PilotLoginRequest {
  const PilotLoginRequest({
    required this.congressCode,
    required this.congressAccessCode,
    required this.firstName,
    required this.lastName,
    required this.phoneLast4,
  });

  final String congressCode;
  final String congressAccessCode;
  final String firstName;
  final String lastName;
  final String phoneLast4;

  Map<String, dynamic> toJson() {
    return {
      'congressCode': congressCode,
      'congressAccessCode': congressAccessCode,
      'firstName': firstName,
      'lastName': lastName,
      'phoneLast4': phoneLast4,
    };
  }
}

class PilotLoginResponse {
  const PilotLoginResponse({
    required this.accessToken,
    required this.user,
    required this.congress,
  });

  final String accessToken;
  final AuthUser user;
  final AuthCongress congress;

  factory PilotLoginResponse.fromJson(Map<String, dynamic> json) {
    return PilotLoginResponse(
      accessToken: json['accessToken'] as String,
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
      congress: AuthCongress.fromJson(json['congress'] as Map<String, dynamic>),
    );
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.role,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String role;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      role: json['role'] as String,
    );
  }
}

class AuthCongress {
  const AuthCongress({
    required this.id,
    required this.name,
    required this.code,
    required this.beaconUuid,
  });

  final String id;
  final String name;
  final String code;
  final String beaconUuid;

  factory AuthCongress.fromJson(Map<String, dynamic> json) {
    return AuthCongress(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String,
      beaconUuid: json['beaconUuid'] as String,
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
  final dynamic message; // Can be a string or a list of strings
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
