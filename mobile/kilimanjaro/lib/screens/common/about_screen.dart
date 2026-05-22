import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/theme/app_colors.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_list_tile.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  String _version = '1.0.0';
  String _build = '1';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((value) {
      if (!mounted) return;
      setState(() {
        _version = value.version;
        _build = value.buildNumber;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const KSAppBar(title: 'About'),
      body: CommonScreenSurface(
        header: const CommonHeroCard(
          iconAsset: 'assets/icons/school.svg',
          title: 'Kilimanjaro Schools',
          subtitle:
              'Digital learning, administration, finance, and communication platform.',
        ),
        children: [
          CommonCard(
            child: Row(
              children: [
                Expanded(
                  child: _VersionMetric(
                    label: 'VERSION',
                    value: _version,
                    subtitle: 'build $_build',
                  ),
                ),
                Container(width: 1, height: 58, color: AppColors.border),
                Expanded(
                  child: _VersionMetric(
                    label: 'PLATFORM',
                    value: Theme.of(context).platform.name.toUpperCase(),
                    subtitle: 'Flutter mobile',
                  ),
                ),
              ],
            ),
          ),
          const CommonSectionTitle(title: 'Support & Ownership'),
          CommonCard(
            padding: EdgeInsets.zero,
            child: const Column(
              children: [
                KSListTile(
                  title: 'Developer',
                  subtitle: 'Nexor Digital Limited',
                  leading: Icon(
                    Icons.business_center_rounded,
                    color: AppColors.skyBlue600,
                  ),
                ),
                KSListTile(
                  title: 'Contact',
                  subtitle: 'support@kilimanjaro.ac.tz',
                  leading: Icon(
                    Icons.mail_rounded,
                    color: AppColors.accentTeal,
                  ),
                ),
                KSListTile(
                  title: 'Website',
                  subtitle: 'www.kilimanjaro.ac.tz',
                  leading: Icon(
                    Icons.public_rounded,
                    color: AppColors.accentIndigo,
                  ),
                ),
                KSListTile(
                  title: 'Built With',
                  subtitle:
                      'Flutter mobile app with NestJS backend architecture',
                  leading: Icon(
                    Icons.code_rounded,
                    color: AppColors.accentAmber,
                  ),
                  showDivider: false,
                ),
              ],
            ),
          ),
          const CommonSectionTitle(title: 'Readiness'),
          const CommonCard(
            child: Text(
              'Common screens are role-aware and can be reused by student, parent, teacher, finance, principal, HOD, Academic QA, and admin shells.',
            ),
          ),
        ],
      ),
    );
  }
}

class _VersionMetric extends StatelessWidget {
  const _VersionMetric({
    required this.label,
    required this.value,
    required this.subtitle,
  });

  final String label;
  final String value;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 2),
        Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
