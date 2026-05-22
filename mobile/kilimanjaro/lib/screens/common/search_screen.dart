import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/search_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../models/search_result_model.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_list_tile.dart';
import '../../widgets/common/ks_search_bar.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_svg_icon.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final search = ref.watch(searchControllerProvider);
    final userAsync = ref.watch(currentUserProvider);

    return Scaffold(
      body: SafeArea(
        child: userAsync.when(
          data: (user) {
            if (user == null) return const SizedBox.shrink();
            final quickAccess = ref
                .read(notificationServiceProvider)
                .quickAccess(user);

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 12, 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: KSSearchBar(
                          controller: _controller,
                          hintText: _hintFor(user.role),
                          autofocus: true,
                          onChanged: (value) {
                            ref
                                .read(searchControllerProvider.notifier)
                                .setQuery(value);
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        child: const Text('Cancel'),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: CommonScreenSurface(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                    children: [
                      CommonHeroCard(
                        user: user,
                        title: 'Smart Search',
                        subtitle:
                            'Find role-specific pages, announcements, students, finance records, and shortcuts.',
                      ),
                      const SizedBox(height: 18),
                      _SearchBody(
                        query: search.query,
                        isLoading: search.isLoading,
                        recent: search.recent,
                        results: search.results,
                        quickAccess: quickAccess,
                        onUseRecent: (value) {
                          _controller.text = value;
                          ref
                              .read(searchControllerProvider.notifier)
                              .setQuery(value);
                        },
                        onRemoveRecent: (value) {
                          ref
                              .read(searchControllerProvider.notifier)
                              .removeRecent(value);
                        },
                      ),
                    ],
                  ),
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

  String _hintFor(UserRole role) => switch (role) {
    UserRole.student => 'Search subjects, results, announcements...',
    UserRole.parent => 'Search children, fees, announcements...',
    UserRole.teacher => 'Search classes, students, marks...',
    UserRole.finance => 'Search invoices, receipts, balances...',
    UserRole.admin => 'Search users, roles, logs...',
    _ => 'Search school records and shortcuts...',
  };
}

class _SearchBody extends StatelessWidget {
  const _SearchBody({
    required this.query,
    required this.isLoading,
    required this.recent,
    required this.results,
    required this.quickAccess,
    required this.onUseRecent,
    required this.onRemoveRecent,
  });

  final String query;
  final bool isLoading;
  final List<String> recent;
  final List<SearchResultModel> results;
  final List<SearchResultModel> quickAccess;
  final ValueChanged<String> onUseRecent;
  final ValueChanged<String> onRemoveRecent;

  @override
  Widget build(BuildContext context) {
    if (query.trim().isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CommonSectionTitle(
            title: 'Recent Searches',
            subtitle: 'Fast access to what you looked up before.',
          ),
          CommonCard(
            child: recent.isEmpty
                ? const Text('Your recent searches will appear here.')
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: recent.map((item) {
                      return InputChip(
                        label: Text(item),
                        avatar: const Icon(Icons.history_rounded, size: 16),
                        onPressed: () => onUseRecent(item),
                        onDeleted: () => onRemoveRecent(item),
                      );
                    }).toList(),
                  ),
          ),
          const CommonSectionTitle(title: 'Quick Access'),
          CommonCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < quickAccess.length; i++)
                  KSListTile(
                    title: quickAccess[i].title,
                    subtitle: quickAccess[i].subtitle,
                    leading: _ResultIcon(type: quickAccess[i].type),
                    showDivider: i != quickAccess.length - 1,
                    onTap: () => context.go(quickAccess[i].route),
                  ),
              ],
            ),
          ),
        ],
      );
    }

    if (isLoading) {
      return const CommonCard(child: KSShimmerList(itemCount: 6));
    }

    if (results.isEmpty) {
      return CommonCard(
        child: KSEmptyState(
          title: 'No results for "$query"',
          subtitle:
              'Try a student name, subject, finance keyword, or page title.',
        ),
      );
    }

    final grouped = <SearchResultType, List<SearchResultModel>>{};
    for (final item in results) {
      grouped.putIfAbsent(item.type, () => []).add(item);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in grouped.entries) ...[
          CommonSectionTitle(title: _labelFor(entry.key)),
          CommonCard(
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (var i = 0; i < entry.value.length; i++)
                  KSListTile(
                    title: entry.value[i].title,
                    subtitle: _subtitleFor(entry.value[i]),
                    leading: entry.value[i].type == SearchResultType.student
                        ? KSAvatar(
                            name:
                                entry.value[i].avatarName ??
                                entry.value[i].title,
                            size: 38,
                          )
                        : _ResultIcon(type: entry.value[i].type),
                    showDivider: i != entry.value.length - 1,
                    onTap: () => context.go(entry.value[i].route),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  String _labelFor(SearchResultType type) => switch (type) {
    SearchResultType.student => 'Students',
    SearchResultType.announcement => 'Announcements',
    SearchResultType.shortcut => 'Shortcuts',
    SearchResultType.recent => 'Recent',
  };

  String _subtitleFor(SearchResultModel item) {
    final meta = item.metaLabel;
    return meta == null || meta.isEmpty
        ? item.subtitle
        : '${item.subtitle} - $meta';
  }
}

class _ResultIcon extends StatelessWidget {
  const _ResultIcon({required this.type});

  final SearchResultType type;

  @override
  Widget build(BuildContext context) {
    final color = switch (type) {
      SearchResultType.student => AppColors.accentIndigo,
      SearchResultType.announcement => AppColors.accentAmber,
      SearchResultType.shortcut => AppColors.skyBlue600,
      SearchResultType.recent => AppColors.accentTeal,
    };
    final icon = switch (type) {
      SearchResultType.student => 'assets/icons/students.svg',
      SearchResultType.announcement => 'assets/icons/megaphone.svg',
      SearchResultType.shortcut => 'assets/icons/grid-dots.svg',
      SearchResultType.recent => 'assets/icons/search.svg',
    };

    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(13),
      ),
      child: Center(child: KSSvgIcon(icon, size: 18, color: color)),
    );
  }
}
