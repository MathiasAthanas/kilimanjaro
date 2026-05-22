import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shimmer/shimmer.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../widgets/common/ks_app_bar.dart';

class ShellDemoScreen extends ConsumerStatefulWidget {
  const ShellDemoScreen({
    super.key,
    required this.role,
    required this.title,
    this.subtitle,
  });

  final UserRole role;
  final String title;
  final String? subtitle;

  @override
  ConsumerState<ShellDemoScreen> createState() => _ShellDemoScreenState();
}

class _ShellDemoScreenState extends ConsumerState<ShellDemoScreen> {
  final ValueNotifier<double> _scrollOffset = ValueNotifier<double>(0);
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController()..addListener(_handleScroll);
  }

  void _handleScroll() {
    final double nextOffset = _scrollController.hasClients
        ? _scrollController.offset.clamp(0, 120).toDouble()
        : 0;
    if (_scrollOffset.value == nextOffset) return;
    _scrollOffset.value = nextOffset;
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_handleScroll)
      ..dispose();
    _scrollOffset.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 20;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(132),
        child: ValueListenableBuilder<double>(
          valueListenable: _scrollOffset,
          builder: (context, offset, child) {
            return KSAppBar(
              title: widget.title,
              subtitle:
                  widget.subtitle ?? 'Role: ${widget.role.label} - all systems operational',
              showBack: false,
              variant: KSAppBarVariant.hero,
              scrollOffset: offset,
            );
          },
        ),
      ),
      body: ListView(
        controller: _scrollController,
        padding: EdgeInsets.fromLTRB(20, 148, 20, bottomPadding),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              color: isDark ? AppColors.darkSurface : AppColors.white,
              boxShadow: [
                BoxShadow(
                  color: AppColors.skyBlue500.withValues(alpha: isDark ? 0.08 : 0.12),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Navigation Shell Active',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  widget.subtitle ??
                      'Role: ${widget.role.label} - ${widget.title.toLowerCase()} surface is staged and ready for real content.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(3, (index) {
              return Expanded(
                child: Container(
                  margin: EdgeInsets.only(right: index == 2 ? 0 : 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '-',
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 6),
                      Text('Screen ${String.fromCharCode(65 + index)}'),
                    ],
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 16),
          ...List.generate(5, (index) {
            final base = isDark ? AppColors.darkCard : Colors.grey.shade300;
            final highlight = isDark ? AppColors.darkSurface : Colors.grey.shade100;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Shimmer.fromColors(
                baseColor: base,
                highlightColor: highlight,
                child: Container(
                  height: 72,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkSurface : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
