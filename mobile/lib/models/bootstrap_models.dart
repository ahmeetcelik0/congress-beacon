/// `GET /mobile/bootstrap` yanitindan yalniz beacon takibi icin gereken
/// alan (`beaconUuid`) modellenir - `halls`/`rssiThreshold` bilerek
/// alinmiyor, salon karari backend'de veriliyor (bkz. Faz 6.1 talimati).
class BootstrapCongress {
  const BootstrapCongress({required this.id, required this.beaconUuid});

  final String id;
  final String beaconUuid;

  factory BootstrapCongress.fromJson(Map<String, dynamic> json) {
    return BootstrapCongress(
      id: json['id'] as String,
      beaconUuid: json['beaconUuid'] as String,
    );
  }
}

class BootstrapResponse {
  const BootstrapResponse({required this.congress});

  final BootstrapCongress congress;

  factory BootstrapResponse.fromJson(Map<String, dynamic> json) {
    return BootstrapResponse(
      congress: BootstrapCongress.fromJson(
        json['congress'] as Map<String, dynamic>,
      ),
    );
  }
}
