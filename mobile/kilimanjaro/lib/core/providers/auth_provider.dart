import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../models/auth_result.dart';
import '../../models/auth_user.dart';
import '../services/api/api_auth_service.dart';
import '../services/interfaces/auth_service_interface.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  // Every API service and cached read is built on top of this provider, so
  // tying it to the signed-in user discards all per-user state (and the
  // per-service caches) on login, logout and account switches.
  ref.watch(sessionEpochProvider);
  // A fresh instance each time so dependents are notified (a const value would
  // compare equal and silently skip the rebuild).
  // ignore: prefer_const_constructors
  return FlutterSecureStorage();
});

/// Bumped whenever the signed-in user changes (login, logout, session expiry).
final sessionEpochProvider = StateProvider<int>((ref) => 0);

final authServiceProvider = Provider<IAuthService>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiAuthService(storage);
});

sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final AuthUser user;
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthError extends AuthState {
  const AuthError(this.message);
  final String message;
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    return const AuthUnauthenticated();
  }

  Future<void> checkAuthState() async {
    final user = await ref.read(authServiceProvider).getCurrentUser();
    state = user == null ? const AuthUnauthenticated() : AuthAuthenticated(user);
  }

  Future<AuthResult?> login(String identifier, String password) async {
    state = const AuthLoading();
    try {
      await ref.read(secureStorageProvider).delete(key: 'active_school_id');
      await ref.read(secureStorageProvider).delete(key: 'user_schools_json');
      final result = await ref
          .read(authServiceProvider)
          .login(identifier: identifier, password: password);
      ref.read(sessionEpochProvider.notifier).state++;
      state = AuthAuthenticated(result.user);
      return result;
    } catch (error) {
      state = AuthError(error.toString().replaceFirst('Exception: ', ''));
      return null;
    }
  }

  Future<void> logout() async {
    await ref.read(authServiceProvider).logout();
    await ref.read(secureStorageProvider).delete(key: 'active_school_id');
      await ref.read(secureStorageProvider).delete(key: 'user_schools_json');
    ref.read(sessionEpochProvider.notifier).state++;
    state = const AuthUnauthenticated();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class ForgotPasswordState {
  const ForgotPasswordState({
    this.loading = false,
    this.sent = false,
    this.error,
  });

  final bool loading;
  final bool sent;
  final String? error;

  ForgotPasswordState copyWith({
    bool? loading,
    bool? sent,
    String? error,
  }) {
    return ForgotPasswordState(
      loading: loading ?? this.loading,
      sent: sent ?? this.sent,
      error: error,
    );
  }
}

class ForgotPasswordController extends StateNotifier<ForgotPasswordState> {
  ForgotPasswordController(this._service) : super(const ForgotPasswordState());

  final IAuthService _service;

  Future<void> requestReset(String email) async {
    state = const ForgotPasswordState(loading: true);
    try {
      await _service.requestPasswordReset(email);
      state = const ForgotPasswordState(sent: true);
    } catch (error) {
      state = ForgotPasswordState(error: error.toString());
    }
  }
}

final forgotPasswordProvider =
    StateNotifierProvider<ForgotPasswordController, ForgotPasswordState>((ref) {
  return ForgotPasswordController(ref.watch(authServiceProvider));
});

class OtpState {
  const OtpState({
    this.otpValue = '',
    this.isVerifying = false,
    this.isVerified = false,
    this.error,
    this.resendCountdown = 60,
    this.expiryCountdown = 600,
  });

  final String otpValue;
  final bool isVerifying;
  final bool isVerified;
  final String? error;
  final int resendCountdown;
  final int expiryCountdown;

  OtpState copyWith({
    String? otpValue,
    bool? isVerifying,
    bool? isVerified,
    String? error,
    int? resendCountdown,
    int? expiryCountdown,
  }) {
    return OtpState(
      otpValue: otpValue ?? this.otpValue,
      isVerifying: isVerifying ?? this.isVerifying,
      isVerified: isVerified ?? this.isVerified,
      error: error,
      resendCountdown: resendCountdown ?? this.resendCountdown,
      expiryCountdown: expiryCountdown ?? this.expiryCountdown,
    );
  }
}

class OtpController extends StateNotifier<OtpState> {
  OtpController(this._service) : super(const OtpState());

  final IAuthService _service;

  void setOtp(String value) {
    state = state.copyWith(otpValue: value, error: null);
  }

  Future<void> verify(String email, String otp) async {
    state = state.copyWith(isVerifying: true, error: null);
    try {
      await _service.verifyOtp(email: email, otp: otp);
      state = state.copyWith(isVerifying: false, isVerified: true);
    } catch (error) {
      state = state.copyWith(
        isVerifying: false,
        isVerified: false,
        error: error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  void decrementExpiry() {
    if (state.expiryCountdown <= 0) return;
    state = state.copyWith(expiryCountdown: state.expiryCountdown - 1);
  }

  void decrementResend() {
    if (state.resendCountdown <= 0) return;
    state = state.copyWith(resendCountdown: state.resendCountdown - 1);
  }

  void resetResend() {
    state = state.copyWith(resendCountdown: 60);
  }
}

final otpProvider = StateNotifierProvider<OtpController, OtpState>((ref) {
  return OtpController(ref.watch(authServiceProvider));
});

class ResetPasswordState {
  const ResetPasswordState({
    this.isResetting = false,
    this.isReset = false,
    this.error,
  });

  final bool isResetting;
  final bool isReset;
  final String? error;

  ResetPasswordState copyWith({
    bool? isResetting,
    bool? isReset,
    String? error,
  }) {
    return ResetPasswordState(
      isResetting: isResetting ?? this.isResetting,
      isReset: isReset ?? this.isReset,
      error: error,
    );
  }
}

class ResetPasswordController extends StateNotifier<ResetPasswordState> {
  ResetPasswordController(this._service)
      : super(const ResetPasswordState());

  final IAuthService _service;

  Future<void> reset(
    String email,
    String otp,
    String newPassword,
  ) async {
    state = state.copyWith(isResetting: true, error: null);
    try {
      await _service.resetPassword(
        email: email,
        otp: otp,
        newPassword: newPassword,
      );
      state = state.copyWith(isResetting: false, isReset: true);
    } catch (error) {
      state = state.copyWith(
        isResetting: false,
        isReset: false,
        error: error.toString().replaceFirst('Exception: ', ''),
      );
    }
  }
}

final resetPasswordProvider =
    StateNotifierProvider<ResetPasswordController, ResetPasswordState>((ref) {
  return ResetPasswordController(ref.watch(authServiceProvider));
});
