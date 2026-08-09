import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../models/auth_models.dart';

/// `/auth/*` uçlarının ince bir sarmalayıcısı - HTTP/JSON detayını
/// ekranlardan gizler, tip güvenli modeller döner.
class AuthRepository {
  AuthRepository(this._apiClient);

  final ApiClient _apiClient;

  Future<MessageResponse> registerRequest(String emailOrPhone) async {
    final json = await _apiClient.post(
      ApiEndpoints.registerRequest,
      body: EmailOrPhoneRequest(emailOrPhone: emailOrPhone).toJson(),
    );
    return MessageResponse.fromJson(json as Map<String, dynamic>);
  }

  Future<MessageResponse> forgotPassword(String emailOrPhone) async {
    final json = await _apiClient.post(
      ApiEndpoints.forgotPassword,
      body: EmailOrPhoneRequest(emailOrPhone: emailOrPhone).toJson(),
    );
    return MessageResponse.fromJson(json as Map<String, dynamic>);
  }

  Future<LoginResponse> login(String emailOrPhone, String password) async {
    final json = await _apiClient.post(
      ApiEndpoints.login,
      body: LoginRequest(
        emailOrPhone: emailOrPhone,
        password: password,
      ).toJson(),
    );
    return LoginResponse.fromJson(json as Map<String, dynamic>);
  }

  Future<MeResponse> me() async {
    final result = await _apiClient.get(ApiEndpoints.me, requiresAuth: true);
    return MeResponse.fromJson(result.data as Map<String, dynamic>);
  }

  Future<TokenResponse> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final json = await _apiClient.post(
      ApiEndpoints.changePassword,
      body: ChangePasswordRequest(
        currentPassword: currentPassword,
        newPassword: newPassword,
      ).toJson(),
      requiresAuth: true,
    );
    return TokenResponse.fromJson(json as Map<String, dynamic>);
  }

  Future<MyCongressesResponse> myCongresses() async {
    final result = await _apiClient.get(
      ApiEndpoints.myCongresses,
      requiresAuth: true,
    );
    return MyCongressesResponse.fromJson(result.data as Map<String, dynamic>);
  }

  Future<TokenResponse> selectCongress(String congressId) async {
    final json = await _apiClient.post(
      ApiEndpoints.selectCongress,
      body: SelectCongressRequest(congressId: congressId).toJson(),
      requiresAuth: true,
    );
    return TokenResponse.fromJson(json as Map<String, dynamic>);
  }
}
