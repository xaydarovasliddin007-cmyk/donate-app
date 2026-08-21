enum NotificationKind {
  orderSuccess,
  orderFailed,
  paymentSuccess,
  topupSuccess,
  refund,
  security,
  promotion,
}

NotificationKind _kindFromJson(String value) => switch (value) {
  'ORDER_SUCCESS' => NotificationKind.orderSuccess,
  'ORDER_FAILED' => NotificationKind.orderFailed,
  'PAYMENT_SUCCESS' => NotificationKind.paymentSuccess,
  'TOPUP_SUCCESS' => NotificationKind.topupSuccess,
  'REFUND' => NotificationKind.refund,
  'SECURITY' => NotificationKind.security,
  _ => NotificationKind.promotion,
};

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.deepLink,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final NotificationKind type;
  final String title;
  final String body;
  final String? deepLink;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        type: _kindFromJson(json['type'] as String),
        title: json['title'] as String,
        body: json['body'] as String,
        deepLink: json['deepLink'] as String?,
        readAt: json['readAt'] == null
            ? null
            : DateTime.parse(json['readAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
