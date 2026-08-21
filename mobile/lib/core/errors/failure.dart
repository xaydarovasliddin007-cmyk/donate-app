import '../network/api_exception.dart';

/// Presentation-facing error shape. Screens branch on [code]/[isNetworkError]
/// to pick the right localized title+message instead of showing raw
/// exception text.
class Failure {
  const Failure({required this.code, required this.message});

  final String code;
  final String message;

  factory Failure.from(Object error) {
    if (error is ApiException) {
      return Failure(code: error.code, message: error.message);
    }
    return const Failure(
      code: 'UNKNOWN_ERROR',
      message: 'Something went wrong',
    );
  }

  bool get isNetworkError => code == 'NETWORK_ERROR';
  bool get isUnauthorized => code == 'UNAUTHORIZED';
}
