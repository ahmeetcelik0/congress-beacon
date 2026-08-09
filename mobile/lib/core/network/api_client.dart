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

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;

  @override
  String toString() => message;
}

/// `get()` cagrisinin sonucu - `notModified` true ise `data` null'dur
/// (304, gövde gelmez). `etag`, bir sonraki cagrida `If-None-Match` olarak
/// gonderilmek uzere saklanabilir (bkz. Faz 5 `/mobile/program` ETag
/// stratejisi - bu altyapi Faz 7'de kullanilacak, bkz. docs/decisions.md).
class ApiGetResult {
  const ApiGetResult({
    required this.data,
    required this.etag,
    required this.notModified,
  });

  final dynamic data;
  final String? etag;
  final bool notModified;
}

class ApiClient {
  ApiClient({http.Client? httpClient, SecureStorageService? storageService})
    : _client = httpClient ?? http.Client(),
      _storage = storageService ?? SecureStorageService();

  final http.Client _client;
  final SecureStorageService _storage;
  static const Duration _timeout = Duration(seconds: 15);

  /// 401 alindiginda (token suresi dolmus / tokenVersion artmis) cagrilir.
  /// Her istek yerinde ayri ayri kontrol etmek yerine TEK noktada - oturumu
  /// temizleyip giris ekranina yonlendirmek uygulama katmaninda
  /// (core/network/api_client_provider.dart) buraya baglanir (bkz. Faz 6
  /// talimati §2).
  void Function()? onUnauthorized;

  Future<Map<String, String>> _getHeaders({
    bool requiresAuth = false,
    String? etag,
  }) async {
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

    if (etag != null) {
      headers['If-None-Match'] = etag;
    }

    return headers;
  }

  Future<ApiGetResult> get(
    String endpoint, {
    Map<String, String>? queryParameters,
    bool requiresAuth = false,
    String? etag,
  }) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}$endpoint',
    ).replace(queryParameters: queryParameters);
    final headers = await _getHeaders(requiresAuth: requiresAuth, etag: etag);

    try {
      final response = await _client
          .get(uri, headers: headers)
          .timeout(_timeout);

      // 304 govdesiz doner ve bir HATA DEGILDIR - _processResponse'un
      // 200-299 disindaki her seyi hata sayan mantigina hic girmeden ayrica
      // ele alinir.
      if (response.statusCode == 304) {
        return const ApiGetResult(data: null, etag: null, notModified: true);
      }

      final data = _processResponse(response);
      return ApiGetResult(
        data: data,
        etag: response.headers['etag'],
        notModified: false,
      );
    } on SocketException {
      throw ApiException(
        'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      );
    } on http.ClientException {
      throw ApiException('Ağ isteği sırasında bir hata oluştu.');
    } catch (e) {
      if (e is ApiException) {
        rethrow;
      }
      throw ApiException('Beklenmeyen bir hata oluştu: ${e.toString()}');
    }
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
      throw ApiException(
        'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      );
    } on http.ClientException {
      throw ApiException('Ağ isteği sırasında bir hata oluştu.');
    } catch (e) {
      if (e is ApiException) {
        rethrow;
      }
      throw ApiException('Beklenmeyen bir hata oluştu: ${e.toString()}');
    }
  }

  Future<dynamic> put(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requiresAuth = false,
  }) async {
    final uri = Uri.parse('${AppConfig.apiBaseUrl}$endpoint');
    final headers = await _getHeaders(requiresAuth: requiresAuth);

    try {
      final response = await _client
          .put(
            uri,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(_timeout);

      return _processResponse(response);
    } on SocketException {
      throw ApiException(
        'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      );
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
      // 401 -> tum uygulama icin TEK noktadan oturum temizleme (bkz. yukaridaki
      // onUnauthorized yorumu). Cagiran taraf ayrica 401'e ozel bir sey
      // yapmak ZORUNDA degil - ApiException yine de firlatilir ki o an
      // bekleyen istek de basarisiz oldugunu bilsin.
      if (response.statusCode == 401) {
        onUnauthorized?.call();
      }

      String errorMessage = 'Bir hata oluştu (${response.statusCode})';
      try {
        final errorJson = jsonDecode(response.body) as Map<String, dynamic>;
        final errorResponse = ErrorResponse.fromJson(errorJson);
        // 403 govdesindeki mesaj OLDUGU GIBI tasinir - "Once bir kongre
        // secmelisiniz" ile "Once sifrenizi degistirmelisiniz" farkli
        // yonlendirmeler gerektirir (bkz. Faz 6 talimati §2), bu yuzden
        // burada genellestirilmez.
        errorMessage = errorResponse.userFriendlyMessage;
      } catch (_) {
        if (response.statusCode == 400) {
          errorMessage = 'Geçersiz istek. Lütfen bilgilerinizi kontrol edin.';
        } else if (response.statusCode == 401) {
          errorMessage =
              'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.';
        } else if (response.statusCode == 403) {
          errorMessage = 'Bu işlem için yetkiniz bulunmamaktadır.';
        } else if (response.statusCode == 404) {
          errorMessage = 'İstenen kaynak bulunamadı.';
        } else if (response.statusCode == 429) {
          errorMessage =
              'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.';
        } else if (response.statusCode >= 500) {
          errorMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        }
      }
      throw ApiException(errorMessage, response.statusCode);
    }
  }
}
