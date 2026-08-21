import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/notifications_api.dart';

final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApi(ref.watch(apiClientProvider)),
);

final notificationsProvider = FutureProvider.autoDispose<NotificationsResult>((
  ref,
) {
  return ref.watch(notificationsApiProvider).list();
});
