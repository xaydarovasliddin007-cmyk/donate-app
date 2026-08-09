/// Mirrors the backend's `{ error: { code, message, details } }` envelope
/// (see backend/src/app.ts error handler) so UI code can branch on [code]
/// instead of parsing message strings.
class ApiException implements Exception {
  const ApiException({required this.code, required this.message, this.statusCode, this.details});

  factory ApiException.network() =>
      const ApiException(code: 'NETWORK_ERROR', message: 'Unable to reach the server');

  factory ApiException.unknown([Object? cause]) =>
      ApiException(code: 'UNKNOWN_ERROR', message: 'Something went wrong', details: cause);

  final String code;
  final String message;
  final int? statusCode;
  final Object? details;

  @override
  String toString() => 'ApiException($code, $statusCode): $message';
}
