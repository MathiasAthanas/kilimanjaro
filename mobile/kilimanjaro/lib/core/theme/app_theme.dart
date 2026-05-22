import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final bodyColor = isDark ? AppColors.darkText : AppColors.textPrimary;
    final mutedColor =
        isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.border;
    final fillColor = isDark ? AppColors.darkCard : AppColors.white;

    final base = ThemeData(
      brightness: brightness,
      useMaterial3: true,
      scaffoldBackgroundColor: isDark ? AppColors.darkBg : AppColors.offWhite,
      cardColor: isDark ? AppColors.darkSurface : AppColors.white,
      primaryColor: AppColors.skyBlue500,
      colorScheme: isDark
          ? const ColorScheme.dark(
              primary: AppColors.skyBlue500,
              onPrimary: AppColors.white,
              secondary: AppColors.accentTeal,
              surface: AppColors.darkSurface,
              onSurface: AppColors.darkText,
              error: AppColors.error,
              outline: AppColors.darkBorder,
            )
          : const ColorScheme.light(
              primary: AppColors.skyBlue500,
              onPrimary: AppColors.white,
              secondary: AppColors.accentTeal,
              surface: AppColors.white,
              onSurface: AppColors.textPrimary,
              error: AppColors.error,
              outline: AppColors.border,
            ),
    );

    return base.copyWith(
      textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme).copyWith(
        displayLarge: GoogleFonts.spaceGrotesk(
          fontSize: 42,
          fontWeight: FontWeight.w700,
          color: bodyColor,
        ),
        displayMedium: GoogleFonts.spaceGrotesk(
          fontSize: 34,
          fontWeight: FontWeight.w700,
          color: bodyColor,
        ),
        headlineLarge: GoogleFonts.spaceGrotesk(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          color: bodyColor,
        ),
        headlineMedium: GoogleFonts.spaceGrotesk(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: bodyColor,
        ),
        titleLarge: GoogleFonts.plusJakartaSans(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: bodyColor,
        ),
        titleMedium: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: bodyColor,
        ),
        titleSmall: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: bodyColor,
        ),
        bodyLarge: GoogleFonts.plusJakartaSans(fontSize: 16, color: bodyColor),
        bodyMedium:
            GoogleFonts.plusJakartaSans(fontSize: 14, color: mutedColor),
        bodySmall:
            GoogleFonts.plusJakartaSans(fontSize: 12, color: mutedColor),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.skyBlue600,
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: fillColor,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        labelStyle: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          color: isDark ? AppColors.darkMuted : AppColors.textMuted,
        ),
        hintStyle: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          color:
              isDark ? AppColors.darkTextSecondary : AppColors.textPlaceholder,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor, width: 1.5),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide:
              const BorderSide(color: AppColors.skyBlue500, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.error, width: 1.8),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
      ),
    );
  }
}
