import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../models/contact_model.dart';

class KSContactTile extends StatefulWidget {
  const KSContactTile({
    super.key,
    required this.type,
    required this.label,
    required this.value,
    this.subtitle,
  });

  final ContactType type;
  final String label;
  final String value;
  final String? subtitle;

  @override
  State<KSContactTile> createState() => _KSContactTileState();
}

class _KSContactTileState extends State<KSContactTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: _launch,
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1,
        duration: const Duration(milliseconds: 140),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _pressed
                ? (isDark ? AppColors.darkCard : AppColors.offWhite)
                : Theme.of(context).cardColor,
            borderRadius: BorderRadius.circular(14),
            boxShadow: AppShadows.shadow1,
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _backgroundColor(widget.type),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(_icon(widget.type), color: AppColors.white),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.label,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    if (widget.subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(widget.subtitle!, style: Theme.of(context).textTheme.bodyMedium),
                    ],
                    const SizedBox(height: 2),
                    Text(widget.value, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              Icon(
                Icons.open_in_new_rounded,
                size: 16,
                color: isDark ? AppColors.darkMuted : AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _launch() async {
    final uri = switch (widget.type) {
      ContactType.phone => Uri.parse('tel:${widget.value}'),
      ContactType.whatsapp =>
        Uri.parse('https://wa.me/${widget.value.replaceAll('+', '').replaceAll(' ', '')}'),
      ContactType.email => Uri.parse('mailto:${widget.value}'),
      ContactType.maps => Uri.parse('geo:${widget.value}'),
    };
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Color _backgroundColor(ContactType type) => switch (type) {
        ContactType.phone => AppColors.accentEmerald,
        ContactType.whatsapp => const Color(0xFF25D366),
        ContactType.email => AppColors.accentIndigo,
        ContactType.maps => AppColors.accentRose,
      };

  IconData _icon(ContactType type) => switch (type) {
        ContactType.phone => Icons.phone_rounded,
        ContactType.whatsapp => Icons.chat_bubble_rounded,
        ContactType.email => Icons.mail_rounded,
        ContactType.maps => Icons.place_rounded,
      };
}
