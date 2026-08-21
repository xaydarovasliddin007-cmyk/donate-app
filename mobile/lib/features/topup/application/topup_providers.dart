import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/topup_api.dart';
import '../domain/receiving_method.dart';

final topupApiProvider = Provider<TopupApi>(
  (ref) => TopupApi(ref.watch(apiClientProvider)),
);

final receivingMethodsProvider =
    FutureProvider.autoDispose<List<ReceivingMethod>>((ref) {
      return ref.watch(topupApiProvider).listReceivingMethods();
    });
