import 'package:donate_app/core/utils/money_formatter.dart';
import 'package:donate_app/features/topup/domain/receiving_method.dart';
import 'package:donate_app/features/topup/domain/top_up_request.dart';
import 'package:donate_app/features/wallet/domain/wallet.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('TopUpRequest Domain Model', () {
    test('parses PENDING card transfer reservation json with receiving methods', () {
      final json = {
        'id': 'req-123',
        'amountMinor': 10000500, // 100,005 UZS (disambiguated reservation)
        'currency': 'UZS',
        'status': 'PENDING',
        'type': 'CARD_TRANSFER',
        'receivingMethods': [
          {
            'id': 'card-1',
            'type': 'CARD_TRANSFER',
            'cardNumber': '9860 1234 5678 8882',
            'cardHolderName': 'ALISHER V.',
            'bankName': 'NBU',
          },
          {
            'id': 'card-2',
            'type': 'CARD_TRANSFER',
            'cardNumber': '8600 9876 5432 1111',
            'cardHolderName': 'UZDONATE PLATFORM',
            'bankName': 'Kapitalbank',
          }
        ],
        'createdAt': '2026-09-12T10:00:00.000Z',
        'expiresAt': '2026-09-12T10:07:00.000Z', // 7-minute TTL
      };

      final request = TopUpRequest.fromJson(json);

      expect(request.id, 'req-123');
      expect(request.amountMinor, 10000500);
      expect(request.currency, 'UZS');
      expect(request.status, TopUpRequestStatus.pending);
      expect(request.type, ReceivingMethodType.cardTransfer);
      expect(request.receivingMethods?.length, 2);
      expect(request.receivingMethods?.first.cardNumber, '9860 1234 5678 8882');
      expect(request.expiresAt, isNotNull);
    });

    test('parses VERIFIED auto-matched request json with specific receiving card', () {
      final json = {
        'id': 'req-124',
        'amountMinor': 5000000,
        'currency': 'UZS',
        'status': 'VERIFIED',
        'type': 'CARD_TRANSFER',
        'receivingMethod': {
          'id': 'card-1',
          'type': 'CARD_TRANSFER',
          'cardNumber': '9860 1234 5678 8882',
          'cardHolderName': 'ALISHER V.',
          'bankName': 'NBU',
        },
        'createdAt': '2026-09-12T10:00:00.000Z',
      };

      final request = TopUpRequest.fromJson(json);

      expect(request.status, TopUpRequestStatus.verified);
      expect(request.receivingMethod?.cardNumber, '9860 1234 5678 8882');
    });

    test('parses REJECTED request with rejection reason', () {
      final json = {
        'id': 'req-125',
        'amountMinor': 5000000,
        'currency': 'UZS',
        'status': 'REJECTED',
        'createdAt': '2026-09-12T10:00:00.000Z',
        'rejectionReason': 'Transfer not found in bank statement',
      };

      final request = TopUpRequest.fromJson(json);

      expect(request.status, TopUpRequestStatus.rejected);
      expect(request.rejectionReason, 'Transfer not found in bank statement');
    });
  });

  group('ReceivingMethod Domain Model', () {
    test('parses QR_CODE receiving method with payload', () {
      final json = {
        'id': 'qr-1',
        'type': 'QR_CODE',
        'cardHolderName': 'Paynet QR',
        'qrPayload': '00020101021132540012uz.paynet.app0112123456789012',
      };

      final method = ReceivingMethod.fromJson(json);

      expect(method.type, ReceivingMethodType.qrCode);
      expect(method.cardHolderName, 'Paynet QR');
      expect(method.qrPayload, startsWith('000201'));
    });

    test('parses PAYNET_TERMINAL type enum and serialization', () {
      expect(receivingMethodTypeFromJson('PAYNET_TERMINAL'), ReceivingMethodType.paynetTerminal);
      expect(receivingMethodTypeToJson(ReceivingMethodType.paynetTerminal), 'PAYNET_TERMINAL');
      expect(receivingMethodTypeToJson(ReceivingMethodType.cardTransfer), 'CARD_TRANSFER');
      expect(receivingMethodTypeToJson(ReceivingMethodType.qrCode), 'QR_CODE');
    });
  });

  group('Wallet & Transaction Domain Model', () {
    test('parses Wallet balance correctly', () {
      final json = {
        'balanceMinor': 25000000, // 250,000 UZS
        'currency': 'UZS',
      };

      final wallet = Wallet.fromJson(json);

      expect(wallet.balanceMinor, 25000000);
      expect(wallet.currency, 'UZS');
    });

    test('parses CREDIT top-up transaction', () {
      final json = {
        'id': 'tx-1',
        'type': 'TOPUP',
        'direction': 'CREDIT',
        'amountMinor': 10000000,
        'currency': 'UZS',
        'reference': 'Humo Transfer auto-credit',
        'reason': 'Wallet top-up',
        'createdAt': '2026-09-12T10:05:00.000Z',
      };

      final tx = WalletTransaction.fromJson(json);

      expect(tx.type, WalletTransactionType.topup);
      expect(tx.direction, WalletTransactionDirection.credit);
      expect(tx.amountMinor, 10000000);
    });

    test('parses DEBIT purchase transaction', () {
      final json = {
        'id': 'tx-2',
        'type': 'PURCHASE',
        'direction': 'DEBIT',
        'amountMinor': 4500000,
        'currency': 'UZS',
        'reference': 'ORD-987654',
        'reason': 'Mobile Legends 250 Diamonds',
        'createdAt': '2026-09-12T10:10:00.000Z',
      };

      final tx = WalletTransaction.fromJson(json);

      expect(tx.type, WalletTransactionType.purchase);
      expect(tx.direction, WalletTransactionDirection.debit);
      expect(tx.amountMinor, 4500000);
    });
  });

  group('Top-Up Amount Formatting & Auto-Match Precision', () {
    test('exact amount displays and copies with absolute precision', () {
      const disambiguated = 10000100; // 100,001.00 UZS (1 so'm bump)

      final displayFormatted = formatExactAmount(disambiguated, 'UZS', 'uz');
      final copyString = exactAmountCopyValue(disambiguated);

      // Must be exact figure "100001" with no decimal rounding error
      expect(copyString, '100001');
      expect(displayFormatted.contains('100'), isTrue);
      expect(displayFormatted.contains('001'), isTrue);
    });
  });
}
