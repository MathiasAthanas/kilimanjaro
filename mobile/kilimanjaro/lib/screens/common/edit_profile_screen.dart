import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../models/auth_user.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_text_field.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _bio = TextEditingController();
  String _originalName = '';
  String _originalPhone = '';
  String _originalBio = '';
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    _name.addListener(_onChanged);
    _phone.addListener(_onChanged);
    _bio.addListener(_onChanged);
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _bio.dispose();
    super.dispose();
  }

  bool get _hasChanges =>
      _name.text != _originalName ||
      _phone.text != _originalPhone ||
      _bio.text != _originalBio;

  void _onChanged() => setState(() {});

  void _seed(AuthUser user) {
    if (_seeded) return;
    _seeded = true;
    _originalName = user.name;
    _originalPhone = user.phone ?? '';
    _originalBio = user.bio ?? '';
    _name.text = _originalName;
    _phone.text = _originalPhone;
    _bio.text = _originalBio;
  }

  Future<bool> _confirmDiscard() async {
    if (!_hasChanges) return true;
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Discard changes?'),
          content: const Text(
            'You have unsaved profile edits. Leave this screen and lose them?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Stay'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Discard'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final userAsync = ref.watch(currentUserProvider);

    return PopScope(
      canPop: !_hasChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final canLeave = await _confirmDiscard();
        if (canLeave && context.mounted) context.pop();
      },
      child: Scaffold(
        appBar: KSAppBar(
          title: 'Edit Profile',
          actions: [
            TextButton(
              onPressed: () async {
                final canLeave = await _confirmDiscard();
                if (canLeave && context.mounted) context.pop();
              },
              child: const Text('Cancel'),
            ),
          ],
        ),
        body: userAsync.when(
          data: (user) {
            if (user == null) return const SizedBox.shrink();
            _seed(user);
            return CommonScreenSurface(
              header: CommonHeroCard(
                user: user,
                title: 'Profile Details',
                subtitle:
                    'Keep your visible name, contact number, and short bio accurate.',
              ),
              children: [
                CommonCard(
                  child: Column(
                    children: [
                      KSAvatar(
                        name: user.name,
                        imageUrl: user.profilePhotoUrl,
                        size: 92,
                        heroTag: 'avatar_${user.id}',
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Photo upload will connect to backend storage in the integration phase.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                CommonCard(
                  child: Column(
                    children: [
                      KSTextField(
                        controller: _name,
                        label: 'Full Name',
                        iconAsset: 'assets/icons/user-circle.svg',
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 16),
                      KSTextField(
                        controller: _phone,
                        label: 'Phone Number',
                        iconAsset: 'assets/icons/phone.svg',
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 16),
                      KSTextField(
                        controller: _bio,
                        label: 'Bio',
                        hint: 'Short profile note',
                        iconAsset: 'assets/icons/info-circle.svg',
                      ),
                    ],
                  ),
                ),
                KSButton(
                  label: 'Save Changes',
                  onPressed: _hasChanges
                      ? () {
                          setState(() {
                            _originalName = _name.text.trim();
                            _originalPhone = _phone.text.trim();
                            _originalBio = _bio.text.trim();
                          });
                          ref
                              .read(snackbarProvider.notifier)
                              .show(
                                'Profile changes saved locally and ready for backend sync.',
                              );
                        }
                      : null,
                ),
              ],
            );
          },
          loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
          error: (error, stack) => const KSEmptyState(
            title: 'Something went wrong',
            subtitle: 'We couldn\'t load your data. Pull down to refresh.',
          ),
        ),
      ),
    );
  }
}
