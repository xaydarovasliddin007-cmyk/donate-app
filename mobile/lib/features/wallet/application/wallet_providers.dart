import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client_provider.dart';
import '../data/wallet_api.dart';
import '../domain/wallet.dart';

final walletApiProvider = Provider<WalletApi>((ref) => WalletApi(ref.watch(apiClientProvider)));

/// Only meaningful when authenticated — callers must gate this behind an
/// auth check (see HomeScreen/ProfileScreen), same convention as
/// `savedGamesListProvider`.
final walletProvider = FutureProvider.autoDispose<Wallet>((ref) {
  return ref.watch(walletApiProvider).getWallet();
});

final walletTransactionsProvider = FutureProvider.autoDispose<List<WalletTransaction>>((ref) {
  return ref.watch(walletApiProvider).listTransactions();
});
