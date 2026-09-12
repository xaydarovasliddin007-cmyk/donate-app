import 'package:donate_app/core/utils/money_formatter.dart';
import 'package:donate_app/features/orders/domain/order_status.dart';
import 'package:donate_app/features/orders/domain/player_validation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('MoneyFormatter', () {
    test('formatMoney formats major units with currency name', () {
      // 1500000 minor units = 15,000 UZS
      final formatted = formatMoney(1500000, 'UZS', 'uz');
      expect(formatted.contains('15'), isTrue);
      expect(formatted.contains('000'), isTrue);
      expect(formatted.contains('UZS'), isTrue);
    });

    test('formatExactAmount preserves tiyin precision for card transfer auto-match', () {
      // 100000 minor units = 1,000 UZS (round, no decimal digits)
      final round = formatExactAmount(100000, 'UZS', 'uz');
      expect(round.contains('1'), isTrue);
      expect(round.contains('000'), isTrue);

      // 100005 minor units = 1,000.05 UZS (disambiguated reservation amount)
      final fractional = formatExactAmount(100005, 'UZS', 'uz');
      expect(fractional.contains('05'), isTrue);
      expect(fractional.contains('UZS'), isTrue);
    });

    test('exactAmountCopyValue produces plain dot-decimal string for banking apps', () {
      expect(exactAmountCopyValue(100000), '1000');
      expect(exactAmountCopyValue(100005), '1000.05');
      expect(exactAmountCopyValue(500050), '5000.50');
      expect(exactAmountCopyValue(75), '0.75');
    });
  });

  group('OrderStatus', () {
    test('orderStatusFromJson correctly parses all backend status values', () {
      expect(orderStatusFromJson('PENDING'), OrderStatus.pending);
      expect(orderStatusFromJson('PAID'), OrderStatus.paid);
      expect(orderStatusFromJson('PROCESSING'), OrderStatus.processing);
      expect(orderStatusFromJson('COMPLETED'), OrderStatus.completed);
      expect(orderStatusFromJson('FAILED'), OrderStatus.failed);
      expect(orderStatusFromJson('CANCELLED'), OrderStatus.cancelled);
      expect(orderStatusFromJson('REFUNDED'), OrderStatus.refunded);
      // Fallback for unknown
      expect(orderStatusFromJson('UNKNOWN_VALUE'), OrderStatus.pending);
    });

    test('isTerminalOrderStatus correctly separates terminal and non-terminal states', () {
      // Active states that need polling
      expect(isTerminalOrderStatus(OrderStatus.pending), isFalse);
      expect(isTerminalOrderStatus(OrderStatus.paid), isFalse);
      expect(isTerminalOrderStatus(OrderStatus.processing), isFalse);

      // Terminal states where polling stops
      expect(isTerminalOrderStatus(OrderStatus.completed), isTrue);
      expect(isTerminalOrderStatus(OrderStatus.failed), isTrue);
      expect(isTerminalOrderStatus(OrderStatus.cancelled), isTrue);
      expect(isTerminalOrderStatus(OrderStatus.refunded), isTrue);
    });
  });

  group('PlayerValidation', () {
    test('parses successful validation json', () {
      final json = {
        'valid': true,
        'playerName': 'ProGamer99',
        'reason': null,
      };
      final result = PlayerValidation.fromJson(json);
      expect(result.valid, isTrue);
      expect(result.playerName, 'ProGamer99');
      expect(result.reason, isNull);
    });

    test('parses failed validation json', () {
      final json = {
        'valid': false,
        'playerName': null,
        'reason': 'User ID not found on server',
      };
      final result = PlayerValidation.fromJson(json);
      expect(result.valid, isFalse);
      expect(result.playerName, isNull);
      expect(result.reason, 'User ID not found on server');
    });
  });
}
