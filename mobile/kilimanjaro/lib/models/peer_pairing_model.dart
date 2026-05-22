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
}
