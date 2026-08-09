import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/device_models.dart';

class DeviceRepository {
  DeviceRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<Device> register({
    required String platform,
    String? deviceModel,
    String? osVersion,
    String? appVersion,
  }) async {
    final json = await _apiClient.post(
      ApiEndpoints.deviceRegister,
      body: RegisterDeviceRequest(
        platform: platform,
        deviceModel: deviceModel,
        osVersion: osVersion,
        appVersion: appVersion,
      ).toJson(),
      requiresAuth: true,
    );
    return Device.fromJson(json as Map<String, dynamic>);
  }
}
