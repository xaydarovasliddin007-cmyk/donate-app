import 'package:intl/intl.dart';

/// Formats integer minor units (e.g. amountMinor=1500000, currency="UZS")
/// into a display string. Never do this math inline in a widget — the minor
/// unit factor is a backend contract, not a UI concern.
String formatMoney(int amountMinor, String currency, String localeName) {
  final majorUnits = amountMinor / 100;
  final formatter = NumberFormat.currency(
    locale: localeName,
    name: currency,
    customPattern: '#,##0 ¤',
    decimalDigits: 0,
  );
  return formatter.format(majorUnits).trim();
}
