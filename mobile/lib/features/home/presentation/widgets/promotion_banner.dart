import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../domain/promotion.dart';

class PromotionBanner extends StatelessWidget {
  const PromotionBanner({super.key, required this.promotion});

  final Promotion promotion;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.brandPrimary, AppColors.brandPrimaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            promotion.title,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          if (promotion.description != null) ...[
            const SizedBox(height: 4),
            Text(
              promotion.description!,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
