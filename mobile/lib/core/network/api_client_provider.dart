import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage_provider.dart';
import 'api_client.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokenStorage: ref.watch(secureStorageServiceProvider));
});
