import 'package:flutter/material.dart';

import 'coming_soon_view.dart';

class HomePlaceholderPage extends StatelessWidget {
  const HomePlaceholderPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ComingSoonView(
      title: 'Ana Sayfa',
      icon: Icons.home_rounded,
      description:
          'Kongre bilgileri, duyurular ve sıradaki sunumunuz yakında burada '
          'olacak.',
    );
  }
}
