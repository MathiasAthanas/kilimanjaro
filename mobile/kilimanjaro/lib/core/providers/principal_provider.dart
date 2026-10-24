import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/api/api_principal_service.dart';
import 'auth_provider.dart';

final principalServiceProvider = Provider<ApiPrincipalService>((ref) {
  return ApiPrincipalService(ref.watch(secureStorageProvider));
});

final principalOverviewProvider = FutureProvider<PrincipalOverview>((ref) {
  return ref.watch(principalServiceProvider).getOverview();
});

final principalApprovalsProvider = FutureProvider<List<PrincipalApproval>>((ref) {
  return ref.watch(principalServiceProvider).getApprovals();
});

final principalPaymentsProvider = FutureProvider<List<PrincipalPayment>>((ref) {
  return ref.watch(principalServiceProvider).getPendingPayments();
});

final principalAtRiskProvider = FutureProvider<List<PrincipalAlert>>((ref) {
  return ref.watch(principalServiceProvider).getAtRisk();
});

/// Refreshes everything the principal screens show after a decision is made.
void refreshPrincipalData(WidgetRef ref) {
  ref.invalidate(principalOverviewProvider);
  ref.invalidate(principalApprovalsProvider);
  ref.invalidate(principalPaymentsProvider);
  ref.invalidate(principalAtRiskProvider);
}
