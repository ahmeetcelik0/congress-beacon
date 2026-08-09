import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/auth_session_provider.dart';
import 'email_or_phone_request_view.dart';

class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return EmailOrPhoneRequestView(
      title: 'Kayıt Ol',
      description:
          'Kongre kaydınızda kullandığınız e-posta veya telefon numaranızı '
          'girin; 6 haneli bir giriş kodu e-posta adresinize gönderilecek. '
          'Bu kod ile giriş yapabilirsiniz.',
      submitLabel: 'Kod Gönder',
      onSubmit: (WidgetRef ref, String emailOrPhone) async {
        final response = await ref
            .read(authRepositoryProvider)
            .registerRequest(emailOrPhone);
        return '${response.message}\n\nKodu aldıktan sonra giriş ekranından '
            'e-posta/telefon ve kod ile giriş yapabilirsiniz.';
      },
    );
  }
}
