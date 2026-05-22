import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ErrorState {
  const ErrorState({
    this.hasError = false,
    this.errorMessage,
    this.errorDetails,
  });

  final bool hasError;
  final String? errorMessage;
  final FlutterErrorDetails? errorDetails;
}

class ErrorController extends Notifier<ErrorState> {
  @override
  ErrorState build() => const ErrorState();

  void reportError(FlutterErrorDetails details) {
    state = ErrorState(
      hasError: true,
      errorMessage: details.exceptionAsString(),
      errorDetails: details,
    );
  }

  void clear() {
    state = const ErrorState();
  }
}

final errorControllerProvider =
    NotifierProvider<ErrorController, ErrorState>(ErrorController.new);
