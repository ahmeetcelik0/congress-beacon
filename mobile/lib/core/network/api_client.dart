import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../models/auth_models.dart';
import '../config/app_config.dart';
import '../storage/secure_storage_service.dart';

class ApiException implements Exception {
  ApiException(this.message, [this.statusCode]);

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({
    http.Client? httpClient,
    SecureStorageService? storageService,
  })  : _client = httpClient ?? http.Client(),
        _storage = storageService ?? SecureStorageService();

  final http.Client _client;
  final SecureStorageService _storage;
  static const Duration _timeout = Duration(seconds: 15);

  Future<Map<String, String>> _getHeaders({bool requiresAuth = false}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (requiresAuth) {
      final token = await _storage.getAccessToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    return headers;
  }

  Future<dynamic> post(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = false,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$endpoint');
    final headers = await _getHeaders(requiresAuth: requiresAuth);

    try {
      final response = await _client
          .post(
            uri,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(_timeout);

      return _processResponse(response);
    } on SocketException {
      throw ApiException('Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    } on http.ClientException {
      throw ApiException('Ağ isteği sırasında bir hata oluştu.');
    } catch (e) {
      if (e is ApiException) {
        rethrow;
      }
      throw ApiException('Beklenmeyen bir hata oluştu: ${e.toString()}');
    }
  }

  dynamic _processResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return null;
      }
      return jsonDecode(response.body);
    } else {
      String errorMessage = 'Bir hata oluştu (${response.statusCode})';
      try {
        final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
        final errorResponse = ErrorResponse.fromJson(errorJson);
        errorMessage = errorResponse.userFriendlyMessage;
      } catch (_) {
        // Fallback messages based on status codes if body is not JSON or not matching ErrorResponse
        if (response.statusCode == 400) {
          errorMessage = 'Geçersiz istek. Lütfen bilgilerinizi kontrol edin.';
        } else if (response.statusCode == 401) {
          errorMessage = 'Yetkisiz erişim. Lütfen giriş bilgilerinizi kontrol edin.';
        } else if (response.statusCode == 403) {
          errorMessage = 'Bu işlem için yetkiniz bulunmamaktadır.';
        } else if (response.statusCode == 404) {
          errorMessage = 'İstenen kaynak bulunamadı.';
        } else if (response.statusCode >= 500) {
          errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        }
      }
      throw ApiException(errorMessage, response.statusCode);
    }
  }
}
