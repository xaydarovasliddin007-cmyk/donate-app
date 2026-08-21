import '../../../core/network/api_client.dart';
import '../domain/wallet.dart';

class WalletApi {
  WalletApi(this._client);

  final ApiClient _client;

  Future<Wallet> getWallet() async {
    final json = await _client.get('/wallet');
    return Wallet.fromJson(json);
  }

  Future<List<WalletTransaction>> listTransactions({int limit = 30}) async {
    final json = await _client.get(
      '/wallet/transactions',
      query: {'limit': limit},
    );
    final transactions = json['transactions'] as List<dynamic>;
    return transactions
        .map((t) => WalletTransaction.fromJson(t as Map<String, dynamic>))
        .toList();
  }

  /// Returns the updated wallet on success. Throws [ApiException] with code
  /// `NOT_FOUND` (invalid/expired/exhausted code) or
  /// `PROMO_CODE_ALREADY_REDEEMED` (this account already used it).
  Future<Wallet> redeemPromoCode(String code) async {
    final json = await _client.post(
      '/promo-codes/redeem',
      body: {'code': code},
    );
    return Wallet.fromJson(json);
  }
}
