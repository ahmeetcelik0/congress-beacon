class NotificationOpenedRequest {
  const NotificationOpenedRequest({required this.notificationLogId});

  final String notificationLogId;

  Map<String, dynamic> toJson() {
    return {'notificationLogId': notificationLogId};
  }
}
