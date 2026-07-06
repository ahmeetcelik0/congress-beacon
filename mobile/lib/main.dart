import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';
import 'package:flutter_beacon/flutter_beacon.dart';

void main() {
  runApp(const BeaconTestApp());
}

class BeaconTestApp extends StatelessWidget {
  const BeaconTestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Kongre Beacon Testi',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const BeaconTestPage(),
    );
  }
}

class BeaconTestPage extends StatefulWidget {
  const BeaconTestPage({super.key});

  @override
  State<BeaconTestPage> createState() => _BeaconTestPageState();
}

class _BeaconTestPageState extends State<BeaconTestPage> {
  static const String beaconUuid = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

  // Teknik olarak gerçek kabul edilen RSSI aralığı.
  static const int minimumValidRssi = -85;
  static const int maximumValidRssi = -20;

  // Ortalama RSSI bu değere eşit veya daha güçlüyse salon içi sayılır.
  static const int salonInsideRssiThreshold = -70;

  // Ortalama için tutulacak son RSSI ölçümü sayısı.
  static const int rssiWindowSize = 8;

  // İki beacon da salon içi eşiğindeyse, karar için gereken minimum fark.
  static const int salonChangeDifference = 8;

  // Yeni salon adayının güçlü kalması gereken süre.
  static const int salonChangeSeconds = 8;

  // İki beacon da salon içi eşiğinin dışındaysa çıkış için beklenecek süre.
  static const int outsideSeconds = 20;

  StreamSubscription<RangingResult>? _rangingSubscription;

  Beacon? _salon1Beacon;
  Beacon? _salon2Beacon;

  final Queue<int> _salon1RssiHistory = Queue<int>();
  final Queue<int> _salon2RssiHistory = Queue<int>();

  int? _salon1AverageRssi;
  int? _salon2AverageRssi;

  String _currentSalon = 'Salon dışı';
  String _decisionMessage = 'Beacon sinyalleri bekleniyor.';

  String? _candidateSalon;
  DateTime? _candidateSalonStartedAt;

  DateTime? _outsideCandidateStartedAt;

  bool _isScanning = false;
  String _statusMessage = 'Tarama başlatılmadı.';

  // Test aşamasında mobilde gösterilen olay listesi.
  final List<SalonEvent> _events = [];

  @override
  void initState() {
    super.initState();
    _startScan();
  }

  Future<void> _startScan() async {
    await _rangingSubscription?.cancel();

    setState(() {
      _isScanning = true;
      _statusMessage = 'Bluetooth ve izinler kontrol ediliyor...';
    });

    try {
      final isReady = await flutterBeacon.initializeScanning;

      if (!isReady) {
        if (!mounted) return;

        setState(() {
          _isScanning = false;
          _statusMessage =
              'Tarama hazır değil. Bluetooth ve konum izinlerini kontrol et.';
        });
        return;
      }

      final regions = <Region>[
        Region(
          identifier: 'kongre-salon-beaconlari',
          proximityUUID: beaconUuid,
        ),
      ];

      setState(() {
        _statusMessage = 'Salon beacon sinyalleri taranıyor...';
      });

      _rangingSubscription = flutterBeacon.ranging(regions).listen(
        (result) {
          if (!mounted) return;

          final now = DateTime.now();

          Beacon? salon1;
          Beacon? salon2;

          for (final beacon in result.beacons) {
            if (beacon.major == 0 && beacon.minor == 1) {
              salon1 = beacon;
            }

            if (beacon.major == 0 && beacon.minor == 2) {
              salon2 = beacon;
            }
          }

          // Yalnızca gerçek RSSI değerleri ortalama hesabına eklenir.
          if (salon1 != null && _isValidRssi(salon1.rssi)) {
            _addRssiValue(_salon1RssiHistory, salon1.rssi);
          }

          if (salon2 != null && _isValidRssi(salon2.rssi)) {
            _addRssiValue(_salon2RssiHistory, salon2.rssi);
          }

          _salon1AverageRssi = _calculateAverage(_salon1RssiHistory);
          _salon2AverageRssi = _calculateAverage(_salon2RssiHistory);

          _updateSalonDecision(now);

          setState(() {
            _salon1Beacon = salon1;
            _salon2Beacon = salon2;

            if (result.beacons.isEmpty) {
              _statusMessage = 'Bu UUID ile beacon algılanmadı.';
            } else {
              _statusMessage = '${result.beacons.length} beacon algılandı.';
            }
          });
        },
        onError: (error) {
          if (!mounted) return;

          setState(() {
            _isScanning = false;
            _statusMessage = 'Tarama hatası: $error';
          });
        },
      );
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _isScanning = false;
        _statusMessage = 'Tarama başlatılamadı: $error';
      });
    }
  }

  bool _isValidRssi(int rssi) {
    return rssi >= minimumValidRssi && rssi <= maximumValidRssi;
  }

  bool _isInsideSalonThreshold(int? averageRssi) {
    if (averageRssi == null) return false;

    return averageRssi >= salonInsideRssiThreshold;
  }

  void _addRssiValue(Queue<int> history, int rssi) {
    history.addLast(rssi);

    if (history.length > rssiWindowSize) {
      history.removeFirst();
    }
  }

  int? _calculateAverage(Queue<int> history) {
    if (history.isEmpty) return null;

    final total = history.reduce((sum, value) => sum + value);
    return (total / history.length).round();
  }

  void _updateSalonDecision(DateTime now) {
    final salon1Inside = _isInsideSalonThreshold(_salon1AverageRssi);
    final salon2Inside = _isInsideSalonThreshold(_salon2AverageRssi);

    // İki salon da -70 dBm eşiğinin altında: salon dışı ihtimali.
    if (!salon1Inside && !salon2Inside) {
      _candidateSalon = null;
      _candidateSalonStartedAt = null;

      _outsideCandidateStartedAt ??= now;

      final outsideElapsed =
          now.difference(_outsideCandidateStartedAt!).inSeconds;

      if (_currentSalon != 'Salon dışı' && outsideElapsed >= outsideSeconds) {
        _addEvent(
          salon: _currentSalon,
          type: SalonEventType.exit,
          time: now,
        );

        _currentSalon = 'Salon dışı';
        _outsideCandidateStartedAt = null;
        _decisionMessage =
            'İki beacon da -70 dBm eşiğinin altında kaldı. Salon dışı olayı oluşturuldu.';
      } else if (_currentSalon == 'Salon dışı') {
        _decisionMessage =
            'Hiçbir beacon salon içi eşiğinde değil. Salon dışı bekleniyor.';
      } else {
        final remaining = outsideSeconds - outsideElapsed;
        _decisionMessage =
            'Salon dışı doğrulanıyor. $remaining saniye sonra çıkış kaydı oluşur.';
      }

      return;
    }

    // En az bir beacon salon içi eşiğine ulaştı; çıkış sayacı sıfırlanır.
    _outsideCandidateStartedAt = null;

    final strongestSalon = _findStrongestSalon(
      salon1Inside: salon1Inside,
      salon2Inside: salon2Inside,
    );

    // İki beacon da kapsamada fakat fark yeterli değilse mevcut salon korunur.
    if (strongestSalon == null) {
      _candidateSalon = null;
      _candidateSalonStartedAt = null;
      _decisionMessage =
          'İki salon da kapsamada ancak RSSI farkı karar için yeterli değil. Mevcut salon korunuyor.';
      return;
    }

    if (_currentSalon == strongestSalon) {
      _candidateSalon = null;
      _candidateSalonStartedAt = null;
      _decisionMessage = '$strongestSalon içinde görünüyorsun.';
      return;
    }

    // Yeni aday salon ilk kez oluştuysa süre sayacı başlar.
    if (_candidateSalon != strongestSalon) {
      _candidateSalon = strongestSalon;
      _candidateSalonStartedAt = now;
      _decisionMessage =
          '$strongestSalon için geçiş doğrulanıyor. $salonChangeSeconds saniye bekleniyor.';
      return;
    }

    final elapsedSeconds =
        now.difference(_candidateSalonStartedAt!).inSeconds;

    // Aday salon yeterli süre güçlü kaldıysa giriş/geçiş onaylanır.
    if (elapsedSeconds >= salonChangeSeconds) {
      if (_currentSalon != 'Salon dışı') {
        _addEvent(
          salon: _currentSalon,
          type: SalonEventType.exit,
          time: now,
        );
      }

      _currentSalon = strongestSalon;

      _addEvent(
        salon: _currentSalon,
        type: SalonEventType.entry,
        time: now,
      );

      _candidateSalon = null;
      _candidateSalonStartedAt = null;
      _decisionMessage =
          '$_currentSalon giriş onaylandı. Olay kaydı oluşturuldu.';
    } else {
      final remaining = salonChangeSeconds - elapsedSeconds;
      _decisionMessage =
          '$strongestSalon için geçiş doğrulanıyor. $remaining saniye kaldı.';
    }
  }

  String? _findStrongestSalon({
    required bool salon1Inside,
    required bool salon2Inside,
  }) {
    // Sadece Salon 1 eşik içindeyse doğrudan adaydır.
    if (salon1Inside && !salon2Inside) {
      return 'Salon 1';
    }

    // Sadece Salon 2 eşik içindeyse doğrudan adaydır.
    if (!salon1Inside && salon2Inside) {
      return 'Salon 2';
    }

    // İkisi de eşik içindeyse aralarındaki fark karşılaştırılır.
    final difference = _salon1AverageRssi! - _salon2AverageRssi!;

    if (difference >= salonChangeDifference) {
      return 'Salon 1';
    }

    if (difference <= -salonChangeDifference) {
      return 'Salon 2';
    }

    return null;
  }

  void _addEvent({
    required String salon,
    required SalonEventType type,
    required DateTime time,
  }) {
    _events.insert(
      0,
      SalonEvent(
        salon: salon,
        type: type,
        time: time,
      ),
    );
  }

  void _clearEvents() {
    setState(() {
      _events.clear();
    });
  }

  String _proximityText(Proximity proximity) {
    switch (proximity) {
      case Proximity.immediate:
        return 'Çok yakın';
      case Proximity.near:
        return 'Yakın';
      case Proximity.far:
        return 'Uzak';
      case Proximity.unknown:
        return 'Bilinmiyor';
    }
  }

  String _rssiText(Beacon? beacon) {
    if (beacon == null) return '-';

    if (!_isValidRssi(beacon.rssi)) {
      return '${beacon.rssi} dBm (Geçersiz ölçüm)';
    }

    return '${beacon.rssi} dBm';
  }

  String _averageRssiText(int? averageRssi) {
    if (averageRssi == null) return '-';

    final thresholdText = _isInsideSalonThreshold(averageRssi)
        ? 'Salon içi eşiğinde'
        : 'Salon dışı eşiğinde';

    return '$averageRssi dBm ($thresholdText)';
  }

  String _formatTime(DateTime time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    final second = time.second.toString().padLeft(2, '0');

    return '$hour:$minute:$second';
  }

  @override
  void dispose() {
    _rangingSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kongre Beacon Testi'),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    _isScanning
                        ? Icons.bluetooth_searching
                        : Icons.bluetooth_disabled,
                    size: 32,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _statusMessage,
                      style: const TextStyle(fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _startScan,
            icon: const Icon(Icons.refresh),
            label: const Text('Taramayı Yeniden Başlat'),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Sistem Kararı: $_currentSalon',
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(_decisionMessage),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _BeaconCard(
            title: 'Salon 1 — Major 0 / Minor 1',
            beacon: _salon1Beacon,
            averageRssi: _salon1AverageRssi,
            averageRssiText: _averageRssiText,
            proximityText: _proximityText,
            rssiText: _rssiText,
          ),
          const SizedBox(height: 12),
          _BeaconCard(
            title: 'Salon 2 — Major 0 / Minor 2',
            beacon: _salon2Beacon,
            averageRssi: _salon2AverageRssi,
            averageRssiText: _averageRssiText,
            proximityText: _proximityText,
            rssiText: _rssiText,
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Test Olay Geçmişi',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton.icon(
                onPressed: _events.isEmpty ? null : _clearEvents,
                icon: const Icon(Icons.delete_outline),
                label: const Text('Temizle'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_events.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Henüz giriş veya çıkış olayı oluşmadı.'),
              ),
            )
          else
            ..._events.map(
              (event) => Card(
                child: ListTile(
                  leading: Icon(
                    event.type == SalonEventType.entry
                        ? Icons.login
                        : Icons.logout,
                  ),
                  title: Text(
                    '${event.salon} ${event.type == SalonEventType.entry ? 'giriş' : 'çıkış'}',
                  ),
                  subtitle: Text(_formatTime(event.time)),
                ),
              ),
            ),
          const SizedBox(height: 24),
          const Text(
            'Test Ayarları',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text('RSSI ortalama penceresi: son 8 ölçüm'),
          const Text('Teknik geçerli RSSI aralığı: -85 dBm ile -20 dBm'),
          const Text('Salon içi RSSI eşiği: -70 dBm ve daha güçlü'),
          const Text('İki salon karşılaştırma farkı: 8 dBm'),
          const Text('Salon geçiş doğrulama süresi: 8 saniye'),
          const Text('Salon dışı doğrulama süresi: 20 saniye'),
        ],
      ),
    );
  }
}

enum SalonEventType {
  entry,
  exit,
}

class SalonEvent {
  const SalonEvent({
    required this.salon,
    required this.type,
    required this.time,
  });

  final String salon;
  final SalonEventType type;
  final DateTime time;
}

class _BeaconCard extends StatelessWidget {
  const _BeaconCard({
    required this.title,
    required this.beacon,
    required this.averageRssi,
    required this.averageRssiText,
    required this.proximityText,
    required this.rssiText,
  });

  final String title;
  final Beacon? beacon;
  final int? averageRssi;
  final String Function(int?) averageRssiText;
  final String Function(Proximity) proximityText;
  final String Function(Beacon?) rssiText;

  @override
  Widget build(BuildContext context) {
    final isDetected = beacon != null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 10),
            Text(
              isDetected ? 'Durum: Algılandı' : 'Durum: Algılanmadı',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isDetected ? Colors.green : Colors.grey,
              ),
            ),
            const SizedBox(height: 8),
            Text('Major: ${beacon?.major ?? '-'}'),
            Text('Minor: ${beacon?.minor ?? '-'}'),
            Text('Anlık RSSI: ${rssiText(beacon)}'),
            Text('Ortalama RSSI: ${averageRssiText(averageRssi)}'),
            Text(
              'Proximity: ${beacon != null ? proximityText(beacon!.proximity) : '-'}',
            ),
          ],
        ),
      ),
    );
  }
}