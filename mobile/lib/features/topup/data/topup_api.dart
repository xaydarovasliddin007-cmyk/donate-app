import '../../../core/network/api_client.dart';
import '../domain/receiving_method.dart';
import '../domain/top_up_request.dart';

class TopupApi {
  TopupApi(this._client);

  final ApiClient _client;

  Future<List<ReceivingMethod>> listReceivingMethods() async {
    final json = await _client.get('/topups/receiving-methods');
    final methods = json['receivingMethods'] as List<dynamic>;
    return methods
        .map((m) => ReceivingMethod.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  Future<TopUpRequest> createTopUpRequest({
    required String receivingMethodId,
    required int amountMinor,
    String? userReference,
  }) async {
    final json = await _client.post(
      '/topups',
      body: {
        'receivingMethodId': receivingMethodId,
        'amountMinor': amountMinor,
        'userReference': ?userReference,
      },
    );
    return TopUpRequest.fromJson(json);
  }

  Future<List<TopUpRequest>> listMyTopUps({int limit = 30}) async {
    final json = await _client.get('/topups', query: {'limit': limit});
    final topUps = json['topUps'] as List<dynamic>;
    return topUps
        .map((t) => TopUpRequest.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  /// The automatic card-transfer flow: reserves this exact amount (bumped
  /// by a few tiyin server-side if another pending request already claimed
  /// it) and returns every active receiving method of [type] the user can
  /// pay to. Omitting [type] reserves against any active method.
  Future<TopUpRequest> reserveTopUp({
    required int amountMinor,
    ReceivingMethodType? type,
  }) async {
    final json = await _client.post(
      '/topups/reserve',
      body: {
        'amountMinor': amountMinor,
        if (type != null) 'type': receivingMethodTypeToJson(type),
      },
    );
    return TopUpRequest.fromJson(json);
  }

  Future<TopUpRequest> getTopUp(String id) async {
    final json = await _client.get('/topups/$id');
    return TopUpRequest.fromJson(json);
  }

  /// Attaches a hint (e.g. a Paynet terminal receipt/check number) to an
  /// already-reserved, still-pending request — used by the terminal flow
  /// since there's no automated transaction feed to match against.
  Future<TopUpRequest> submitReference(String id, String userReference) async {
    final json = await _client.post(
      '/topups/$id/reference',
      body: {'userReference': userReference},
    );
    return TopUpRequest.fromJson(json);
  }

  /// Pings the admin queue that the user tapped "I've paid" — a courtesy
  /// signal only (nothing is credited by it), so callers should treat
  /// failures here as non-fatal to the top-up flow.
  Future<void> confirmPaid(String id) async {
    await _client.post('/topups/$id/confirm-paid');
  }
}
