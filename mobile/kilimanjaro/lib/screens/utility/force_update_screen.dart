import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../widgets/common/ks_button.dart';

class ForceUpdateScreen extends StatelessWidget {
  const ForceUpdateScreen({
    super.key,
    required this.currentVersion,
    required this.requiredVersion,
  });

  final String currentVersion;
  final String requiredVersion;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF0C4A6E), Color(0xFF0EA5E9)],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset('assets/images/kilimanjaro_logo.png', width: 72),
                    const SizedBox(height: 32),
                    const Icon(Icons.system_update_alt_rounded,
                        color: Colors.white, size: 80),
                    const SizedBox(height: 24),
                    const Text(
                      'Update Required',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'A new version of Kilimanjaro Schools is available. Please update to continue.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 16),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Current: v$currentVersion  →  Required: v$requiredVersion',
                      style: const TextStyle(color: Colors.white54),
                    ),
                    const SizedBox(height: 40),
                    KSButton(
                      label: 'Update Now',
                      secondary: true,
                      onPressed: () => launchUrl(
                        Uri.parse('https://play.google.com/store'),
                        mode: LaunchMode.externalApplication,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
