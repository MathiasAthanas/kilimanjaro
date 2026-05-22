import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_contact_tile.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_list_tile.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';

class ContactSchoolScreen extends ConsumerWidget {
  const ContactSchoolScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(activeParentChildProvider).value;
    final contactAsync = ref.watch(parentContactSchoolProvider);

    return Scaffold(
      appBar: KSAppBar(
        title: 'Contact School',
        subtitle: child != null
            ? "Teachers and offices for ${child.firstName}"
            : 'School offices and teacher directory',
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(parentContactSchoolProvider),
        child: contactAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: KSShimmerList(itemCount: 6),
          ),
          error: (error, stack) => const KSEmptyState(
            title: 'Something went wrong',
            subtitle: 'We couldn\'t load your data. Pull down to refresh.',
          ),
          data: (contact) => ParentSurface(
          children: [
            ParentCard(
              child: Row(
                children: [
                  Image.asset(
                    'assets/images/kilimanjaro_logo_icon.png',
                    width: 54,
                    height: 54,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          contact.schoolName,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(contact.address),
                        const SizedBox(height: 4),
                        Text(
                          'Open: ${contact.openHours}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const ParentSectionTitle(title: 'Get in Touch'),
            ...contact.actions.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: KSContactTile(
                  type: item.type,
                  label: item.label,
                  value: item.value,
                  subtitle: item.subtitle,
                ),
              ),
            ),
            ParentSectionTitle(
              title: "${child?.firstName ?? 'Student'}'s Teachers",
            ),
            ParentCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: contact.teachers
                    .map(
                      (teacher) => KSListTile(
                        title: teacher.name,
                        subtitle: '${teacher.role} - ${teacher.subjects}',
                        leading: KSAvatar(name: teacher.name, size: 40),
                        trailing: teacher.contactVisible
                            ? IconButton(
                                onPressed: () => launchUrl(
                                  Uri.parse('tel:${teacher.contactValue}'),
                                  mode: LaunchMode.externalApplication,
                                ),
                                icon: const Icon(
                                  Icons.phone_rounded,
                                  color: AppColors.skyBlue600,
                                ),
                              )
                            : null,
                        showDivider: teacher != contact.teachers.last,
                      ),
                    )
                    .toList(),
              ),
            ),
            const ParentSectionTitle(title: 'Common Questions'),
            ...contact.faqItems.map(
              (item) => _FaqTile(question: item.question, answer: item.answer),
            ),
            ParentCard(
              onTap: () => launchUrl(
                Uri.parse('tel:${contact.emergencyPhone}'),
                mode: LaunchMode.externalApplication,
              ),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: AppColors.accentRose.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.local_hospital_rounded,
                      color: AppColors.accentRose,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Emergency Contact',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: AppColors.accentRose,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        Text(
                          '${contact.emergencyPhone} - Available 24 hours for emergencies',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          ),
        ),
      ),
    );
  }
}

class _FaqTile extends StatefulWidget {
  const _FaqTile({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.question,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              AnimatedRotation(
                turns: _expanded ? 0.5 : 0,
                duration: const Duration(milliseconds: 200),
                child: const Icon(Icons.keyboard_arrow_down_rounded),
              ),
            ],
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                widget.answer,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(height: 1.6),
              ),
            ),
            crossFadeState: _expanded
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }
}
