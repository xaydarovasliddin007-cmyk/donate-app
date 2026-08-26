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

/// Like [formatMoney], but never rounds away a nonzero minor-unit remainder.
/// Card-transfer top-up reservations disambiguate two people requesting the
/// same round amount at once by bumping one of them by 1-99 tiyin (see
/// backend pickUniqueAmount) — showing "1 000 UZS" for what's actually
/// "1 000,01 UZS" would make that reservation impossible to auto-match,
/// since the transfer the user is told to make would never be exact.
String formatExactAmount(int amountMinor, String currency, String localeName) {
  if (amountMinor % 100 == 0) {
    return formatMoney(amountMinor, currency, localeName);
  }
  final majorUnits = amountMinor / 100;
  final formatter = NumberFormat.currency(
    locale: localeName,
    name: currency,
    customPattern: '#,##0.00 ¤',
    decimalDigits: 2,
  );
  return formatter.format(majorUnits).trim();
}

/// The exact numeric string to copy into a banking app's transfer-amount
/// field — same precision rule as [formatExactAmount]. Always a plain dot
/// decimal separator, unambiguous for a numeric field regardless of the
/// device's locale (unlike the display string, which follows [localeName]).
String exactAmountCopyValue(int amountMinor) {
  if (amountMinor % 100 == 0) {
    return (amountMinor ~/ 100).toString();
  }
  return (amountMinor / 100).toStringAsFixed(2);
}
