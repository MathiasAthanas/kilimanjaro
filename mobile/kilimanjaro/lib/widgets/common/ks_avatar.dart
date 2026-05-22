import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';

class KSAvatar extends StatefulWidget {
  const KSAvatar({
    super.key,
    required this.name,
    required this.size,
    this.imageUrl,
    this.showOnlineDot = false,
    this.onTap,
    this.heroTag,
  });

  final String name;
  final double size;
  final String? imageUrl;
  final bool showOnlineDot;
  final VoidCallback? onTap;
  final String? heroTag;

  @override
  State<KSAvatar> createState() => _KSAvatarState();
}

class _KSAvatarState extends State<KSAvatar> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor = isDark ? AppColors.darkBg : AppColors.white;
    final initials = widget.name
        .trim()
        .split(RegExp(r'\s+'))
        .where((item) => item.isNotEmpty)
        .take(2)
        .map((item) => item.characters.first.toUpperCase())
        .join();
    final gradient = _gradientForName(widget.name);

    Widget content = AnimatedScale(
      duration: const Duration(milliseconds: 150),
      scale: _pressed ? 0.93 : 1,
      child: Container(
        width: widget.size,
        height: widget.size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: gradient,
          border: Border.all(
            color: borderColor,
            width: widget.size >= 96 ? 3 : 2,
          ),
          boxShadow: widget.size >= 96
              ? AppShadows.shadow2
              : widget.size >= 64
                  ? AppShadows.shadow1
                  : null,
        ),
        clipBehavior: Clip.antiAlias,
        child: widget.imageUrl != null
            ? Image.network(widget.imageUrl!, fit: BoxFit.cover)
            : Center(
                child: Text(
                  initials,
                  style: GoogleFonts.spaceGrotesk(
                    color: AppColors.white,
                    fontSize: widget.size * 0.38,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
      ),
    );

    if (widget.heroTag != null) {
      content = Hero(tag: widget.heroTag!, child: content);
    }

    content = Stack(
      clipBehavior: Clip.none,
      children: [
        content,
        if (widget.showOnlineDot)
          Positioned(
            right: widget.size * 0.02,
            bottom: widget.size * 0.02,
            child: Container(
              width: widget.size * 0.22,
              height: widget.size * 0.22,
              decoration: BoxDecoration(
                color: AppColors.accentTeal,
                shape: BoxShape.circle,
                border: Border.all(color: borderColor, width: 2),
              ),
            ),
          ),
      ],
    );

    if (widget.onTap == null) return content;

    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      child: content,
    );
  }

  LinearGradient _gradientForName(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((item) => item.isNotEmpty).toList();
    final first = parts.isNotEmpty ? parts.first.characters.first : 'A';
    final last = parts.length > 1 ? parts.last.characters.first : first;
    final hue = ((first.codeUnitAt(0) % 360) + (last.codeUnitAt(0) % 360)) / 2;
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        HSLColor.fromAHSL(1, hue, 0.65, 0.52).toColor(),
        HSLColor.fromAHSL(1, (hue + 30) % 360, 0.65, 0.40).toColor(),
      ],
    );
  }
}
