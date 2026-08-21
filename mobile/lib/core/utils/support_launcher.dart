import 'package:url_launcher/url_launcher.dart';
import '../config/app_config.dart';

/// Opens the user's support channel with context pre-filled — the user
/// should never have to manually type their UZDONATE ID or order number.
/// Prefers Telegram (if configured); falls back to email otherwise.
Future<bool> launchSupportContact({
  required String subject,
  required String body,
}) async {
  final uri = AppConfig.isSupportTelegramConfigured
      ? Uri.parse(
          'https://t.me/${AppConfig.supportTelegramUsername}?text=${Uri.encodeComponent('$subject\n\n$body')}',
        )
      : Uri(
          scheme: 'mailto',
          path: AppConfig.supportEmail,
          query:
              'subject=${Uri.encodeComponent(subject)}&body=${Uri.encodeComponent(body)}',
        );

  return launchUrl(uri, mode: LaunchMode.externalApplication);
}
