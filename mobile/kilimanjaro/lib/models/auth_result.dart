import 'auth_user.dart';

class AuthResult {
  const AuthResult({
    required this.token,
    required this.refreshToken,
    required this.user,
  });

  final String token;
  final String refreshToken;
  final AuthUser user;

  factory AuthResult.fromJson(Map<String, dynamic> json) {
    // The backend wraps responses as { success, data: {...} } — unwrap first.
    final payload = json['data'] is Map<String, dynamic>
        ? json['data'] as Map<String, dynamic>
        : json;
    return AuthResult(
      token: payload['access_token'] as String? ?? payload['accessToken'] as String? ?? '',
      refreshToken: payload['refresh_token'] as String? ?? payload['refreshToken'] as String? ?? '',
      user: AuthUser.fromJson(payload['user'] as Map<String, dynamic>? ?? {}),
    );
  }
}
