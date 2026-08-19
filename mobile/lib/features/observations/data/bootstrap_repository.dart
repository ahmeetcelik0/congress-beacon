import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/bootstrap_models.dart';

/// `GET /mobile/bootstrap` guard'siz (bkz. backend `mobile.controller.ts`
/// yorumu: "TestFlight'taki mevcut surum bunu kullaniyor") - congressId
/// istemciden sorgu parametresi olarak gecilir, JWT gerekmez.
class BootstrapRepository {
  BootstrapRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<BootstrapResponse> fetch(String congressId) async {
    final result = await _apiClient.get(
      ApiEndpoints.mobileBootstrap,
      queryParameters: {'congressId': congressId},
    );
    return BootstrapResponse.fromJson(result.data as Map<String, dynamic>);
  }
}
