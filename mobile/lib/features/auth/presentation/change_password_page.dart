import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../application/auth_session_provider.dart';

/// Aynı ekran İKİ bağlamda kullanılır (bkz. Faz 6 talimatı §6):
/// (a) `mustChangePassword=true` iken ZORUNLU (geri çıkışı yok - redirect
///     zinciri buraya kilitler, `PopScope` ile geri tuşu da engellenir),
/// (b) Profilim'den İSTEĞE BAĞLI (normal geri tuşu çalışır). Hangi
/// bağlamda olduğumuz ayrı bir route parametresiyle DEĞİL, o an güncel
/// oturum durumundan (`mustChangePassword`) okunur - tutarlılığı
/// redirect mantığıyla aynı kaynaktan garanti eder.
class ChangePasswordPage extends ConsumerStatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  ConsumerState<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends ConsumerState<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _newPasswordAgainController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _newPasswordAgainController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await ref
          .read(authRepositoryProvider)
          .changePassword(
            currentPassword: _currentPasswordController.text,
            newPassword: _newPasswordController.text,
          );
      await ref
          .read(authSessionProvider.notifier)
          .applyNewToken(response.accessToken);
      if (!mounted) return;
      // Zorunlu baglamda bir sonraki adima (kongre secimi/kabuk), istege
      // bagli baglamda kabuga geri - ikisi de ayni sekilde redirect
      // zincirine devrediliyor.
      context.go('/splash');
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
    final mustChangePassword =
        ref.watch(authSessionProvider).value?.mustChangePassword ?? false;

    return PopScope(
      canPop: !mustChangePassword,
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: const Text('Şifre Değiştir'),
          automaticallyImplyLeading: !mustChangePassword,
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (mustChangePassword) ...[
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(AppSpacing.sm),
                      ),
                      child: const Text(
                        'Devam edebilmek için önce yeni bir şifre belirlemeniz '
                        'gerekiyor.',
                        style: TextStyle(
                          color: AppColors.primaryDark,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  TextFormField(
                    controller: _currentPasswordController,
                    decoration: InputDecoration(
                      // Zorunlu baglamda kullanici bir "sifre" degil,
                      // e-postasina gelen 6 haneli KODU giriyor - etiket
                      // buna gore degisir (gercek anlami yansitir).
                      labelText: mustChangePassword
                          ? 'GİRİŞ KODU'
                          : 'MEVCUT ŞİFRE',
                      prefixIcon: const Icon(Icons.lock_outline),
                    ),
                    obscureText: true,
                    enabled: !_isLoading,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Bu alan zorunludur.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _newPasswordController,
                    decoration: const InputDecoration(
                      labelText: 'YENİ ŞİFRE',
                      prefixIcon: Icon(Icons.lock_reset_outlined),
                    ),
                    obscureText: true,
                    enabled: !_isLoading,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Bu alan zorunludur.';
                      }
                      if (value.length < 8) {
                        return 'Şifre en az 8 karakter olmalıdır.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextFormField(
                    controller: _newPasswordAgainController,
                    decoration: const InputDecoration(
                      labelText: 'YENİ ŞİFRE (TEKRAR)',
                      prefixIcon: Icon(Icons.lock_reset_outlined),
                    ),
                    obscureText: true,
                    enabled: !_isLoading,
                    onFieldSubmitted: (_) => _submit(),
                    validator: (value) {
                      if (value != _newPasswordController.text) {
                        return 'Şifreler eşleşmiyor.';
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
                        : const Text('Şifreyi Değiştir'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
