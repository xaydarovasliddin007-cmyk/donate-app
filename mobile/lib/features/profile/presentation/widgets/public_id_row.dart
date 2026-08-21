import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../l10n/generated/app_localizations.dart';

/// A compact, premium "UZDONATE ID" row with copy-to-clipboard feedback —
/// deliberately placed near Settings, not at the top of the profile, per
/// the product's "elegant, not prominent" placement guidance.
class PublicIdRow extends StatefulWidget {
  const PublicIdRow({super.key, required this.publicId});

  final String publicId;

  @override
  State<PublicIdRow> createState() => _PublicIdRowState();
}

class _PublicIdRowState extends State<PublicIdRow> {
  bool _copied = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.publicId));
    if (!mounted) return;
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.profileUzdonateIdLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  widget.publicId,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          AnimatedSwitcher(
            duration: AppMotion.fast,
            child: _copied
                ? Row(
                    key: const ValueKey('copied'),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        l10n.profileCopiedMessage,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  )
                : TextButton.icon(
                    key: const ValueKey('copy'),
                    onPressed: _copy,
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: Text(l10n.profileCopyButton),
                  ),
          ),
        ],
      ),
    );
  }
}
