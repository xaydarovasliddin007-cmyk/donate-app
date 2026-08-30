abstract final class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

/// A real progression, not four names for the same number — every screen in
/// this app nests a smaller-radius element (an image, an icon tile) inside a
/// larger-radius container (a card) padded around it, and that only reads as
/// "one shape rounding into another" when the inner radius is visibly
/// smaller than the outer one. Bug found during the design-system audit:
/// this used to be sm=md=lg=xl=8, which made every nested card/image pair
/// (GameCard's cover art, WalletBalanceCard, ProductCard) render with
/// mismatched, non-concentric corners.
abstract final class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double pill = 999;
}
