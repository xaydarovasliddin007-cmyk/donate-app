import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/promotions_api.dart';
import '../domain/promotion.dart';

final promotionsApiProvider = Provider<PromotionsApi>((ref) => PromotionsApi(ref.watch(apiClientProvider)));

final promotionsListProvider = FutureProvider<List<Promotion>>((ref) {
  return ref.watch(promotionsApiProvider).listPromotions();
});
