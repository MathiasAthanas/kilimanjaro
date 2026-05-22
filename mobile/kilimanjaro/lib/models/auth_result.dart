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
}
