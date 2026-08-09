import '../../../core/network/api_client.dart';
import '../domain/promotion.dart';

class PromotionsApi {
  PromotionsApi(this._client);

  final ApiClient _client;

  Future<List<Promotion>> listPromotions() async {
    final json = await _client.get('/promotions');
    final promotions = json['promotions'] as List<dynamic>;
    return promotions.map((p) => Promotion.fromJson(p as Map<String, dynamic>)).toList();
  }
}
