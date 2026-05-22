import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/auth/password_strength.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_text_field.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _current.addListener(_onChanged);
    _next.addListener(_onChanged);
    _confirm.addListener(_onChanged);
  }

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _current.text.isNotEmpty &&
      _next.text.length >= 8 &&
      _confirm.text.isNotEmpty &&
      _next.text == _confirm.text &&
      !_saving;

  void _onChanged() => setState(() {});

  Future<void> _submit() async {
    setState(() => _saving = true);
    await Future<void>.delayed(const Duration(milliseconds: 450));
    if (!mounted) return;
    setState(() {
      _saving = false;
      _current.clear();
      _next.clear();
      _confirm.clear();
    });
    ref
        .read(snackbarProvider.notifier)
        .show('Password update flow is ready for backend integration.');
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider).value;
    final matches = _confirm.text.isNotEmpty && _next.text == _confirm.text;

    return Scaffold(
      appBar: const KSAppBar(title: 'Change Password'),
      body: CommonScreenSurface(
        header: CommonHeroCard(
          user: user,
          iconAsset: 'assets/icons/shield-check.svg',
          title: 'Secure Your Account',
          subtitle: 'Use a strong password with at least eight characters.',
        ),
        children: [
          CommonCard(
            child: Column(
              children: [
                KSTextField(
                  controller: _current,
                  label: 'Current Password',
                  iconAsset: 'assets/icons/lock.svg',
                  obscureText: true,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                KSTextField(
                  controller: _next,
                  label: 'New Password',
                  iconAsset: 'assets/icons/shield.svg',
                  obscureText: true,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 10),
                PasswordStrength(password: _next.text),
                const SizedBox(height: 16),
                KSTextField(
                  controller: _confirm,
                  label: 'Confirm Password',
                  iconAsset: 'assets/icons/lock.svg',
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) {
                    if (_canSubmit) _submit();
                  },
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    matches ? 'Passwords match' : 'Passwords must match',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: matches
                          ? AppColors.accentEmerald
                          : AppColors.accentAmber,
                    ),
                  ),
                ),
              ],
            ),
          ),
          KSButton(
            label: 'Update Password',
            isLoading: _saving,
            onPressed: _canSubmit ? _submit : null,
          ),
        ],
      ),
    );
  }
}
