import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/shell_provider.dart';
import '../../models/auth_user.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';

/// Shown when a route has no screen for the signed-in role, or the address does not exist.
class NotAvailableScreen extends ConsumerWidget {
  const NotAvailableScreen({
    super.key,
    required this.role,
    required this.title,
    this.subtitle,
  });

  final UserRole role;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 20;
    // Only explicit messages are shown; routes without one get the generic role message.
    final message = (subtitle != null && !subtitle!.contains('prepared for'))
        ? subtitle!
        : 'This section is not part of the ${role.label} app.';

    return Scaffold(
      appBar: KSAppBar(
        title: title,
        subtitle: message,
        showBack: Navigator.of(context).canPop(),
        variant: KSAppBarVariant.hero,
      ),
      body: Padding(
        padding: EdgeInsets.only(bottom: bottomPadding),
        child: KSEmptyState(
          title: 'Nothing to show here',
          subtitle: message,
          actionLabel: 'Go back',
          onAction: () {
            if (Navigator.of(context).canPop()) Navigator.of(context).pop();
          },
        ),
      ),
    );
  }
}
