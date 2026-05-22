import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum ConnectivityStatus { online, offline, restored }

class ConnectivityState {
  const ConnectivityState({
    required this.status,
    this.lastUpdatedAt,
  });

  final ConnectivityStatus status;
  final DateTime? lastUpdatedAt;

  bool get isOnline => status != ConnectivityStatus.offline;
}

class ConnectivityController extends StateNotifier<ConnectivityState> {
  ConnectivityController() : super(const ConnectivityState(status: ConnectivityStatus.online)) {
    _subscription = Connectivity()
        .onConnectivityChanged
        .listen(_onConnectivityChanged);
  }

  StreamSubscription<List<ConnectivityResult>>? _subscription;
  Timer? _debounce;
  Timer? _restoredTimer;

  void _onConnectivityChanged(List<ConnectivityResult> results) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 1200), () {
      final online = results.any((item) => item != ConnectivityResult.none);
      final wasOffline = state.status == ConnectivityStatus.offline;
      if (online && wasOffline) {
        state = ConnectivityState(
          status: ConnectivityStatus.restored,
          lastUpdatedAt: DateTime.now(),
        );
        _restoredTimer?.cancel();
        _restoredTimer = Timer(const Duration(seconds: 2), () {
          state = ConnectivityState(
            status: ConnectivityStatus.online,
            lastUpdatedAt: DateTime.now(),
          );
        });
        return;
      }
      state = ConnectivityState(
        status: online ? ConnectivityStatus.online : ConnectivityStatus.offline,
        lastUpdatedAt: DateTime.now(),
      );
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _restoredTimer?.cancel();
    _subscription?.cancel();
    super.dispose();
  }
}

final connectivityProvider =
    StateNotifierProvider<ConnectivityController, ConnectivityState>(
  (ref) => ConnectivityController(),
);
