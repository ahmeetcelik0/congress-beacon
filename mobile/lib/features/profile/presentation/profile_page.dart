import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../core/config/package_info_provider.dart';
import '../../../core/testing/widget_keys.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/turkish_date_format.dart';
import '../../../core/widgets/role_type_chip.dart';
import '../../../models/mobile_content_models.dart';
import '../../auth/application/auth_session_provider.dart';
import '../../program/application/program_provider.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Çıkış Yap'),
        content: const Text('Oturumunuzu kapatmak istediğinize emin misiniz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Çıkış Yap'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(authSessionProvider.notifier).logout();
      if (context.mounted) context.go('/splash');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(authSessionProvider).value;
    // Faz 7.1: Kongre Degistir/Sifre Degistir ikisi de sunucu gerektirir -
    // cevrimdisiyken SESSIZCE basarisiz olmak yerine (bkz. talimat §4)
    // dokununca anlasilir bir mesaj gosterip devre disi GORUNURLER.
    final isOffline = ref.watch(isOfflineSessionProvider);

    if (me == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final activeCongress = me.activeCongress;
    // Bos/yuklenmemis/hatali TUMU "gosterme" olarak ele alinir - bu bolum
    // Profilim sayfasinin asli isi degil, destekleyici bir ozet (bkz. Faz
    // 7 talimati §5 "Hic yoksa bu bolumu gosterme").
    final myProgramItems = ref.watch(myProgramProvider).value?.items;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Profilim')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.lg),
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.md),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.primarySoft,
                  child: Text(
                    _initials(me.user.fullName),
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  me.user.fullName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                if (me.user.email != null)
                  _InfoRow(icon: Icons.email_outlined, text: me.user.email!),
                if (me.user.phone != null) ...[
                  const SizedBox(height: 4),
                  _InfoRow(icon: Icons.phone_outlined, text: me.user.phone!),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _SectionCard(
            children: [
              _ActionTile(
                key: WidgetKeys.profileChangeCongress,
                icon: Icons.event_available_outlined,
                title: 'Aktif Kongre',
                subtitle: activeCongress?.name ?? 'Seçilmedi',
                trailingLabel: 'Kongre Değiştir',
                enabled: !isOffline,
                onTap: () => context.push('/select-congress'),
              ),
              const Divider(height: 1),
              _ActionTile(
                key: WidgetKeys.profileChangePassword,
                icon: Icons.lock_outline,
                title: 'Şifre',
                subtitle: '••••••••',
                trailingLabel: 'Şifre Değiştir',
                enabled: !isOffline,
                onTap: () => context.push('/change-password'),
              ),
            ],
          ),
          if (myProgramItems != null && myProgramItems.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            _MyProgramSection(items: myProgramItems),
          ],
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              key: WidgetKeys.profileLogout,
              onPressed: () => _confirmLogout(context, ref),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger),
              ),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Çıkış Yap'),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const Center(child: _AppVersionLabel()),
        ],
      ),
    );
  }

  String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: AppColors.textSecondary),
        const SizedBox(width: 6),
        Text(
          text,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.md),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      // ListTile arka planini/ink splash'ini en yakin Material'a cizer -
      // disaridaki Container'in kendi arka plan rengi (DecoratedBox) araya
      // girdiginde bu efektler GORUNMEZ oluyordu (gercek cihazda yakalanan
      // bir Flutter framework uyarisi). Seffaf bir Material araya eklenerek
      // dokunma geri bildirimi (ink splash) tekrar gorunur kilinir.
      child: Material(
        color: Colors.transparent,
        child: Column(children: children),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailingLabel,
    required this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String trailingLabel;
  final VoidCallback onTap;
  // Faz 7.1: cevrimdisiyken bu eylem SUNUCU gerektiriyorsa false verilir -
  // SESSIZCE basarisiz olmak yerine dokununca anlasilir bir mesaj gosterir.
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: ListTile(
        onTap: enabled ? onTap : () => _showOfflineMessage(context),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xs,
        ),
        leading: Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: AppColors.accentSoft,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: AppColors.accent, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          subtitle,
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        trailing: Text(
          trailingLabel,
          style: const TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
            fontSize: 12.5,
          ),
        ),
      ),
    );
  }

  void _showOfflineMessage(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Bu işlem için internet bağlantısı gerekir - çevrimiçi olunca tekrar deneyin.',
        ),
      ),
    );
  }
}

/// Katilimcinin kendi konusmaci/moderator/tartismaci oldugu program (bkz.
/// Faz 7 talimati §5, `GET /mobile/my-program`) - kronolojik sirada,
/// sunucudan geldigi gibi (tekrar SIRALANMAZ).
class _MyProgramSection extends StatelessWidget {
  const _MyProgramSection({required this.items});

  final List<MobileMyProgramItem> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: AppSpacing.sm, left: 2),
          child: Text(
            'Benim Programım',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          ),
        ),
        _SectionCard(
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const Divider(height: 1),
              _MyProgramTile(item: items[i]),
            ],
          ],
        ),
      ],
    );
  }
}

class _MyProgramTile extends StatelessWidget {
  const _MyProgramTile({required this.item});

  final MobileMyProgramItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${formatTurkishDate(item.startTime)} · '
                  '${formatTimeRange(item.startTime, item.endTime)} · '
                  '${item.hallName}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          RoleTypeChip(roleType: item.roleType),
        ],
      ),
    );
  }
}

class _AppVersionLabel extends ConsumerWidget {
  const _AppVersionLabel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final packageInfo = ref.watch(packageInfoProvider);
    return Text(
      packageInfo.when(
        data: (PackageInfo info) =>
            'Sürüm ${info.version} (${info.buildNumber})',
        loading: () => '',
        error: (_, _) => '',
      ),
      style: const TextStyle(color: AppColors.textFaint, fontSize: 12),
    );
  }
}
