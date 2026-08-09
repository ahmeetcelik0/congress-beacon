import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';

/// `/auth/register-request` ve `/auth/forgot-password` AYNI akışı paylaşır
/// (bkz. shared/openapi.yaml açıklaması) - bu yüzden ekranları da aynı
/// gövdeyi paylaşır, yalnızca metin ve çağrılan fonksiyon farklıdır.
class EmailOrPhoneRequestView extends ConsumerStatefulWidget {
  const EmailOrPhoneRequestView({
    super.key,
    required this.title,
    required this.description,
    required this.submitLabel,
    required this.onSubmit,
  });

  final String title;
  final String description;
  final String submitLabel;
  final Future<String> Function(WidgetRef ref, String emailOrPhone) onSubmit;

  @override
  ConsumerState<EmailOrPhoneRequestView> createState() =>
      _EmailOrPhoneRequestViewState();
}

class _EmailOrPhoneRequestViewState
    extends ConsumerState<EmailOrPhoneRequestView> {
  final _formKey = GlobalKey<FormState>();
  final _controller = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final message = await widget.onSubmit(ref, _controller.text.trim());
      if (!mounted) return;
      setState(() => _successMessage = message);
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (_) {
      setState(() => _errorMessage = 'Beklenmeyen bir hata oluştu.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text(widget.title)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppSpacing.md),
                Text(
                  widget.description,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (_successMessage != null)
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.accentSoft,
                      borderRadius: BorderRadius.circular(AppSpacing.sm),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.mark_email_read_outlined,
                          color: AppColors.accent,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text(
                            _successMessage!,
                            style: const TextStyle(
                              color: AppColors.accent,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else ...[
                  TextFormField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      labelText: 'E-POSTA VEYA TELEFON',
                      hintText: 'ornek@hastane.org',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                    keyboardType: TextInputType.emailAddress,
                    enabled: !_isLoading,
                    onFieldSubmitted: (_) => _submit(),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Lütfen e-posta veya telefon girin.';
                      }
                      return null;
                    },
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 13,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  FilledButton(
                    onPressed: _isLoading ? null : _submit,
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(widget.submitLabel),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
