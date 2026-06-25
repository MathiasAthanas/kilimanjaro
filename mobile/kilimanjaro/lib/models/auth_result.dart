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
    return AuthResult(
      token: json['access_token'] as String? ?? json['accessToken'] as String? ?? '',
      refreshToken: json['refresh_token'] as String? ?? json['refreshToken'] as String? ?? '',
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>? ?? {}),
    );
  }
}
