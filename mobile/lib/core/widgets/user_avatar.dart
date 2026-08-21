import 'package:flutter/material.dart';

/// Shows the Google account picture when available (only source of avatars
/// today — email/password accounts have none), falling back to a plain icon.
/// Network image failures (offline, revoked URL) fall back silently rather
/// than showing a broken-image glyph. Shared between the profile header and
/// the home screen's greeting so both read as "the same person's app".
class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.avatarUrl, this.radius = 24});

  final String? avatarUrl;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final url = avatarUrl;
    final theme = Theme.of(context);
    if (url == null || url.isEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: theme.colorScheme.primaryContainer,
        child: Icon(
          Icons.person_rounded,
          color: theme.colorScheme.onPrimaryContainer,
          size: radius,
        ),
      );
    }
    return CircleAvatar(
      radius: radius,
      backgroundImage: NetworkImage(url),
      onBackgroundImageError: (_, _) {},
      child: null,
    );
  }
}
