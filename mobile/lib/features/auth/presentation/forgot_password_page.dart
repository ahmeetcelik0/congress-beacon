import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/auth_session_provider.dart';
import 'email_or_phone_request_view.dart';

class ForgotPasswordPage extends StatelessWidget {
  const ForgotPasswordPage({super.key});

  @override
  Widget build(BuildContext context) {
    return EmailOrPhoneRequestView(
      title: 'Şifremi Unuttum',
      description:
          'Kongre kaydınızda kullandığınız e-posta veya telefon numaranızı '
          'girin; 6 haneli yeni bir giriş kodu e-posta adresinize '
          'gönderilecek.',
      submitLabel: 'Kod Gönder',
      onSubmit: (WidgetRef ref, String emailOrPhone) async {
        final response = await ref
            .read(authRepositoryProvider)
            .forgotPassword(emailOrPhone);
        return response.message;
      },
    );
  }
}
