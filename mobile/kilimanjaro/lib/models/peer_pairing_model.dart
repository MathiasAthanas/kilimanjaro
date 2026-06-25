class PeerPairingModel {
  const PeerPairingModel({
    required this.subjectId,
    required this.subjectName,
    required this.peerName,
    required this.peerRank,
    required this.peerScore,
    required this.status,
    required this.startedAt,
  });

  final String subjectId;
  final String subjectName;
  final String peerName;
  final int peerRank;
  final double peerScore;
  final String status;
  final DateTime startedAt;

  factory PeerPairingModel.fromJson(Map<String, dynamic> json) {
    final activatedAt = json['activatedAt'] as String? ?? json['startedAt'] as String? ?? json['createdAt'] as String?;
    return PeerPairingModel(
      subjectId: json['subjectId'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      peerName: (json['peer'] as Map<String, dynamic>?)?['name'] as String? ?? json['peerName'] as String? ?? 'Peer',
      peerRank: json['peerRank'] as int? ?? 0,
      peerScore: (json['peerScoreAtPairing'] as num?)?.toDouble() ?? (json['peerScore'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'SUGGESTED',
      startedAt: activatedAt != null ? DateTime.parse(activatedAt) : DateTime.now(),
    );
  }
}
