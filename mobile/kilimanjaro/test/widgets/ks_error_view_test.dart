import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/core/network/api_failure.dart';
import 'package:kilimanjaro/widgets/common/ks_error_view.dart';

Widget _host(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  testWidgets('shows a retry action for a retryable failure', (tester) async {
    var retried = false;
    await tester.pumpWidget(_host(KSErrorView(
      error: const ApiFailure(
          kind: ApiFailureKind.offline, message: 'You appear to be offline.'),
      onRetry: () => retried = true,
    )));
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('You are offline'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);

    await tester.tap(find.text('Try again'));
    expect(retried, isTrue);
  });

  testWidgets('hides retry for a forbidden failure', (tester) async {
    await tester.pumpWidget(_host(KSErrorView(
      error: const ApiFailure(
          kind: ApiFailureKind.forbidden,
          message: 'You do not have permission.'),
      onRetry: () {},
    )));
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Access restricted'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });
}
