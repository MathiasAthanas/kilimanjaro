import '../../../models/auth_result.dart';
import '../../../models/auth_user.dart';

abstract interface class IAuthService {
  Future<AuthResult> login({
    required String identifier,
    required String password,
  });

  Future<void> logout();

  Future<void> requestPasswordReset(String email);

  Future<void> verifyOtp({
    required String email,
    required String otp,
  });

  Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  });

  Future<AuthUser?> getCurrentUser();
}
