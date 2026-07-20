class ObservedBeacon {
  const ObservedBeacon({
    required this.uuid,
    required this.major,
    required this.minor,
    required this.rssi,
    this.txPower,
  });

  final String uuid;
  final int major;
  final int minor;
  final int rssi;
  final int? txPower;

  Map<String, dynamic> toJson() {
    return {
      'uuid': uuid,
      'major': major,
      'minor': minor,
      'rssi': rssi,
      if (txPower != null) 'txPower': txPower,
    };
  }
}

class ObservationSnapshot {
  const ObservationSnapshot({
    required this.observationId,
    required this.observedAt,
    required this.beacons,
    this.appVersion,
  });

  final String observationId;
  final String observedAt; // ISO-8601 date-time string
  final List<ObservedBeacon> beacons;
  final String? appVersion;

  Map<String, dynamic> toJson() {
    return {
      'observationId': observationId,
      'observedAt': observedAt,
      'beacons': beacons.map((b) => b.toJson()).toList(),
      if (appVersion != null) 'appVersion': appVersion,
    };
  }
}

class ObservationBatchRequest {
  const ObservationBatchRequest({
    required this.clientBatchId,
    required this.deviceId,
    required this.observations,
  });

  final String clientBatchId;
  final String deviceId;
  final List<ObservationSnapshot> observations;

  Map<String, dynamic> toJson() {
    return {
      'clientBatchId': clientBatchId,
      'deviceId': deviceId,
      'observations': observations.map((o) => o.toJson()).toList(),
    };
  }
}

class ObservationBatchResponse {
  const ObservationBatchResponse({
    required this.acceptedCount,
    required this.duplicateCount,
    required this.rejectedCount,
    this.observationIntervalSeconds,
  });

  final int acceptedCount;
  final int duplicateCount;
  final int rejectedCount;

  // Panelden ayarlanan, bir sonraki batch'lerin kac saniyede bir
  // gonderilecegini belirten deger. Backend her batch yanitinda gonderir.
  final int? observationIntervalSeconds;

  factory ObservationBatchResponse.fromJson(Map<String, dynamic> json) {
    return ObservationBatchResponse(
      acceptedCount: json['acceptedCount'] as int? ?? 0,
      duplicateCount: json['duplicateCount'] as int? ?? 0,
      rejectedCount: json['rejectedCount'] as int? ?? 0,
      observationIntervalSeconds: json['observationIntervalSeconds'] as int?,
    );
  }
}
