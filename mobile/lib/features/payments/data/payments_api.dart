import '../../../core/network/api_client.dart';
import '../domain/payment.dart';

class PaymentsApi {
  PaymentsApi(this._client);

  final ApiClient _client;

  Future<Payment> createPayment({
    required String orderId,
    required String idempotencyKey,
    String providerCode = 'DEV_MOCK_PAYMENT',
  }) async {
    final json = await _client.post(
      '/payments',
      body: {
        'orderId': orderId,
        'providerCode': providerCode,
        'idempotencyKey': idempotencyKey,
      },
    );
    return Payment.fromJson(json);
  }

  Future<Payment> payWithWallet({
    required String orderId,
    required String idempotencyKey,
  }) async {
    final json = await _client.post(
      '/payments/wallet',
      body: {'orderId': orderId, 'idempotencyKey': idempotencyKey},
    );
    return Payment.fromJson(json);
  }

  Future<Payment> simulateWebhook(
    String paymentId, {
    required bool succeed,
  }) async {
    final json = await _client.post(
      '/payments/$paymentId/dev-simulate',
      body: {'outcome': succeed ? 'SUCCEEDED' : 'FAILED'},
    );
    return Payment.fromJson(json);
  }
}
