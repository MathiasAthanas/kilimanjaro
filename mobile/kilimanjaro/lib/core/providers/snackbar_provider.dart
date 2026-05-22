import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

class SnackbarMessage {
  const SnackbarMessage({
    required this.id,
    required this.message,
    this.isError = false,
  });

  final String id;
  final String message;
  final bool isError;
}

class SnackbarController extends StateNotifier<SnackbarMessage?> {
  SnackbarController() : super(null);

  Timer? _dismissTimer;

  void show(String message, {bool isError = false}) {
    _dismissTimer?.cancel();
    state = SnackbarMessage(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      message: message,
      isError: isError,
    );
    _dismissTimer = Timer(const Duration(seconds: 3), clear);
  }

  void clear() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    state = null;
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }
}

final snackbarProvider =
    StateNotifierProvider<SnackbarController, SnackbarMessage?>(
      (ref) => SnackbarController(),
    );
