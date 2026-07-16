class RegisterDeviceRequest {
  const RegisterDeviceRequest({
    required this.platform,
  });

  final String platform;

  Map<String, dynamic> toJson() {
    return {
      'platform': platform,
    };
  }
}

class Device {
  const Device({
    required this.id,
    required this.userId,
    required this.platform,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String platform;
  final String createdAt;
  final String updatedAt;

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id'] as String,
      userId: json['userId'] as String,
      platform: json['platform'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }
}

class PushTokenRequest {
  const PushTokenRequest({
    required this.deviceId,
    required this.pushToken,
  });

  final String deviceId;
  final String pushToken;

  Map<String, dynamic> toJson() {
    return {
      'deviceId': deviceId,
      'pushToken': pushToken,
    };
  }
}
