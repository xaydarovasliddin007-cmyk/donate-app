import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/session.dart';
import 'auth_controller.dart';

final sessionsProvider = FutureProvider.autoDispose<List<Session>>((ref) {
  return ref.watch(authApiProvider).listSessions();
});
