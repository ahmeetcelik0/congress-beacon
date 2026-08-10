import 'package:flutter/material.dart';

import '../../models/mobile_content_models.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';

/// Rol etiketi (Moderatör/Konuşmacı/Tartışmacı) - Ana Sayfa'daki "Sıradaki
/// Sunumum" kartı, Profilim'deki "Benim Programım" bölümü ve Oturum Detayı
/// arasında paylaşılır (bkz. Faz 7 talimati §2, §5).
class RoleTypeChip extends StatelessWidget {
  const RoleTypeChip({super.key, required this.roleType});

  final ProgramRoleType roleType;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        roleType.label,
        style: const TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}
