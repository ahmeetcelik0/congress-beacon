import 'package:flutter/material.dart';

import 'coming_soon_view.dart';

class ProgramPlaceholderPage extends StatelessWidget {
  const ProgramPlaceholderPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ComingSoonView(
      title: 'Bilimsel Program',
      icon: Icons.calendar_month_rounded,
      description:
          'Oturumları, konuşmacıları ve salonları gösteren bilimsel program '
          'yakında burada olacak.',
    );
  }
}
