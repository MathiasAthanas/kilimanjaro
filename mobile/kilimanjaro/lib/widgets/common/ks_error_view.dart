import 'package:flutter/material.dart';

import '../../core/network/api_failure.dart';
import 'ks_empty_state.dart';

/// A distinct, kind-aware error state for any data screen.
///
/// Pass the raw error caught by an `AsyncValue.when(error: ...)` branch (or a
/// `catch`); it is normalized with [ApiFailure.from] so a 403 shows a
/// permission message, an offline/timeout shows a retry affordance, and so on —
/// instead of every failure collapsing into the same "no data" screen.
class KSErrorView extends StatelessWidget {
  const KSErrorView({
    super.key,
    required this.error,
    this.onRetry,
  });

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final failure = ApiFailure.from(error);
    final showRetry = onRetry != null && failure.kind != ApiFailureKind.forbidden;
    return KSEmptyState(
      title: _titleFor(failure.kind),
      subtitle: failure.message,
      svgAsset: _iconFor(failure.kind),
      actionLabel: showRetry ? 'Try again' : null,
      onAction: showRetry ? onRetry : null,
    );
  }

  String _titleFor(ApiFailureKind kind) {
    switch (kind) {
      case ApiFailureKind.forbidden:
        return 'Access restricted';
      case ApiFailureKind.offline:
        return 'You are offline';
      case ApiFailureKind.timeout:
        return 'This is taking too long';
      case ApiFailureKind.notFound:
        return 'Nothing here';
      case ApiFailureKind.validation:
        return 'Check your details';
      case ApiFailureKind.unauthenticated:
        return 'Please sign in again';
      case ApiFailureKind.server:
      case ApiFailureKind.unknown:
        return 'Something went wrong';
    }
  }

  String _iconFor(ApiFailureKind kind) {
    switch (kind) {
      case ApiFailureKind.offline:
      case ApiFailureKind.timeout:
        return 'assets/icons/wifi-off.svg';
      case ApiFailureKind.forbidden:
      case ApiFailureKind.unauthenticated:
        return 'assets/icons/lock.svg';
      case ApiFailureKind.notFound:
        return 'assets/icons/info-circle.svg';
      default:
        return 'assets/icons/alert-circle.svg';
    }
  }
}
