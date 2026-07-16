import 'package:flutter/material.dart';

class SessionDetailPage extends StatelessWidget {
  const SessionDetailPage({
    super.key,
    required this.sessionId,
  });

  final String sessionId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Oturum Detayı'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.event_seat, size: 64, color: Colors.blue),
            const SizedBox(height: 24),
            const Text(
              'Oturum Başlıyor!',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Text(
              'Oturum ID:\n$sessionId',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16),
            ),
          ],
        ),
      ),
    );
  }
}
