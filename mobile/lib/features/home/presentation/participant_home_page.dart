import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

// Since the previous agent might have used an absolute import, let's stick to relative imports to avoid package name mismatch
import '../../../../main.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../auth/presentation/pilot_login_page.dart';
import '../../notifications/domain/push_notification_service.dart';
import '../../observations/domain/beacon_observation_service.dart';
import 'session_detail_page.dart';

/// Katılımcı Girişi Sonrası Ana Sayfa.
class ParticipantHomePage extends StatefulWidget {
  const ParticipantHomePage({
    super.key,
    required this.participantName,
    required this.congressName,
  });

  final String participantName;
  final String congressName;

  @override
  State<ParticipantHomePage> createState() => _ParticipantHomePageState();
}

class _ParticipantHomePageState extends State<ParticipantHomePage> {
  final _secureStorage = SecureStorageService();
  BeaconObservationService? _observationService;
  StreamSubscription<ObservationServiceState>? _stateSubscription;
  
  ObservationServiceState _serviceState = const ObservationServiceState(
    status: ObservationServiceStatus.initializing,
    pendingSnapshotCount: 0,
  );

  bool _isServiceInitializing = true;
  bool _needsAlwaysPermission = false;

  @override
  void initState() {
    super.initState();
    _initService();
  }

  Future<void> _initService() async {
    final accessToken = await _secureStorage.getAccessToken();
    final deviceId = await _secureStorage.getDeviceId();

    if (accessToken != null && deviceId != null) {
      _observationService = BeaconObservationService(deviceId: deviceId);
      
      _stateSubscription = _observationService!.stateStream.listen((state) async {
        if (state.status == ObservationServiceStatus.unauthorized) {
          await _secureStorage.deleteAll();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.')),
            );
            // Replace all routes with PilotLoginPage
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(builder: (_) => const PilotLoginPage()),
              (route) => false,
            );
          }
          return;
        }

        if (mounted) {
          setState(() {
            _serviceState = state;
            _needsAlwaysPermission =
                _observationService?.needsAlwaysLocationPermission ?? false;
          });
        }
      });

      await _observationService!.start();
    } else {
      if (mounted) {
        setState(() {
          _serviceState = const ObservationServiceState(
            status: ObservationServiceStatus.error,
            pendingSnapshotCount: 0,
            errorMessage: 'Token veya Device ID bulunamadı. Lütfen tekrar giriş yapın.',
          );
        });
      }
    }

    if (mounted) {
      setState(() {
        _isServiceInitializing = false;
      });
    }
  }

  @override
  void dispose() {
    _stateSubscription?.cancel();
    _observationService?.stop();
    super.dispose();
  }

  Future<void> _logout() async {
    await _observationService?.stop();
    await _secureStorage.deleteAll();

    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const PilotLoginPage()),
      (route) => false,
    );
  }

  String _getStatusText() {
    switch (_serviceState.status) {
      case ObservationServiceStatus.initializing:
        return 'Başlatılıyor...';
      case ObservationServiceStatus.active:
        return 'Aktif';
      case ObservationServiceStatus.error:
        return 'Hata: ${_serviceState.errorMessage ?? 'Bilinmeyen hata'}';
      case ObservationServiceStatus.unauthorized:
        return 'Yetkisiz erişim';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Katılımcı Paneli'),
        centerTitle: true,
        actions: [
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            tooltip: 'Çıkış Yap',
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hoş geldiniz, ${widget.participantName}',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        widget.congressName,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Colors.blue,
                              fontWeight: FontWeight.w500,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
              if (_needsAlwaysPermission) ...[
                const SizedBox(height: 16),
                Card(
                  color: Colors.amber.shade100,
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.warning_amber_rounded, color: Colors.amber.shade900),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Arka planda takip için konum izni gerekiyor',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.amber.shade900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Uygulama arka plandayken veya kilit ekranındayken salon takibinin '
                          'çalışması için konum izninin "Her Zaman" olarak ayarlanması gerekir. '
                          'Şu an yalnızca uygulama açıkken izin verilmiş görünüyor.',
                          style: TextStyle(color: Colors.amber.shade900),
                        ),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: () => launchUrl(Uri.parse('app-settings:')),
                          icon: const Icon(Icons.settings),
                          label: const Text('Ayarları Aç'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (kDebugMode) ...[
                const SizedBox(height: 20),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Sistem Durumu (Debug)',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (_isServiceInitializing)
                          const Center(child: CircularProgressIndicator())
                        else ...[
                          Text('Tarama durumu: ${_getStatusText()}'),
                          const Divider(height: 24),
                          Text('Bekleyen snapshot: ${_serviceState.pendingSnapshotCount}'),
                          const Divider(height: 24),
                          Text('Son batch sonucu: ${_serviceState.lastBatchResult ?? 'Henüz gönderilmedi'}'),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
              const Spacer(),
              if (kDebugMode) ...[
                const SizedBox(height: 32),
                const Divider(),
                const Text(
                  'Geliştirici Araçları',
                  style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const BeaconTestPage(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.bluetooth_searching),
                  label: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12.0),
                    child: Text(
                      'Beacon Test Ekranını Aç',
                      style: TextStyle(fontSize: 16),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () async {
                    // Simulate notification tap
                    final pushService = PushNotificationService();
                    await pushService.markNotificationAsOpened('test-log-123');
                    
                    if (!context.mounted) return;
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const SessionDetailPage(sessionId: 'test-session-456'),
                      ),
                    );
                  },
                  icon: const Icon(Icons.notifications_active),
                  label: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12.0),
                    child: Text('Test: Bildirime Dokun (Simüle Et)'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

