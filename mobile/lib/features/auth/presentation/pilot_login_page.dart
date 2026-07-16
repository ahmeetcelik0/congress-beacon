import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../models/auth_models.dart';
import '../../../models/device_models.dart';
import '../../home/presentation/participant_home_page.dart';
import '../../notifications/domain/push_notification_service.dart';

/// Pilot Giriş Ekranı.
/// 
/// Congress Code, Congress Access Code, First Name, Last Name ve Phone Last 4
/// alanlarını alıp doğrular.
class PilotLoginPage extends StatefulWidget {
  const PilotLoginPage({super.key});

  @override
  State<PilotLoginPage> createState() => _PilotLoginPageState();
}

class _PilotLoginPageState extends State<PilotLoginPage> {
  final _formKey = GlobalKey<FormState>();
  
  final _congressCodeController = TextEditingController();
  final _accessCodeController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneLast4Controller = TextEditingController();

  bool _isLoading = false;
  final _apiClient = ApiClient();
  final _secureStorage = SecureStorageService();

  @override
  void dispose() {
    _congressCodeController.dispose();
    _accessCodeController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneLast4Controller.dispose();
    super.dispose();
  }

  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final loginRequest = PilotLoginRequest(
        congressCode: _congressCodeController.text.trim(),
        congressAccessCode: _accessCodeController.text.trim(),
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        phoneLast4: _phoneLast4Controller.text.trim(),
      );

      final loginResponseJson = await _apiClient.post(
        ApiEndpoints.pilotLogin,
        body: loginRequest.toJson(),
        requiresAuth: false,
      );

      final loginResponse = PilotLoginResponse.fromJson(loginResponseJson as Map<String, dynamic>);

      // Save token
      await _secureStorage.saveAccessToken(loginResponse.accessToken);

      // Register device
      final registerRequest = RegisterDeviceRequest(
        platform: Platform.isAndroid ? 'ANDROID' : 'IOS',
      );

      final deviceResponseJson = await _apiClient.post(
        ApiEndpoints.deviceRegister,
        body: registerRequest.toJson(),
        requiresAuth: true,
      );

      final device = Device.fromJson(deviceResponseJson as Map<String, dynamic>);

      // Save deviceId
      await _secureStorage.saveDeviceId(device.id);

      final participantName = '${loginResponse.user.firstName} ${loginResponse.user.lastName}';
      final congressName = loginResponse.congress.name;

      await _secureStorage.saveParticipantName(participantName);
      await _secureStorage.saveCongressName(congressName);

      // Dummy test for push token infrastructure (Firebase not installed yet)
      if (kDebugMode) {
        final pushService = PushNotificationService();
        await pushService.updateTokenOnServer('dummy_token_123', device.id);
      }

      if (!mounted) return;

      // Navigate to Home Page
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ParticipantHomePage(
            participantName: participantName,
            congressName: congressName,
          ),
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: Colors.red,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Beklenmeyen bir hata oluştu.'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pilot Girişi'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Kongre Beacon Sistemi\nPilot Giriş Paneli',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 30),
                TextFormField(
                  controller: _congressCodeController,
                  decoration: const InputDecoration(
                    labelText: 'Kongre Kodu',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.code),
                  ),
                  enabled: !_isLoading,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Lütfen kongre kodunu girin.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _accessCodeController,
                  decoration: const InputDecoration(
                    labelText: 'Kongre Erişim Kodu',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  obscureText: true,
                  enabled: !_isLoading,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Lütfen kongre erişim kodunu girin.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _firstNameController,
                  decoration: const InputDecoration(
                    labelText: 'Ad',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  keyboardType: TextInputType.name,
                  enabled: !_isLoading,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Lütfen adınızı girin.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _lastNameController,
                  decoration: const InputDecoration(
                    labelText: 'Soyad',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  keyboardType: TextInputType.name,
                  enabled: !_isLoading,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Lütfen soyadınızı girin.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _phoneLast4Controller,
                  decoration: const InputDecoration(
                    labelText: 'Telefon Son 4 Hane',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.phone_iphone),
                    counterText: '',
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  enabled: !_isLoading,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Lütfen telefonunuzun son 4 hanesini girin.';
                    }
                    if (value.length != 4 || int.tryParse(value) == null) {
                      return 'Lütfen tam olarak 4 haneli bir sayı girin.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 30),
                FilledButton(
                  onPressed: _isLoading ? null : _submitForm,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12.0),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Devam Et',
                            style: TextStyle(fontSize: 16),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
