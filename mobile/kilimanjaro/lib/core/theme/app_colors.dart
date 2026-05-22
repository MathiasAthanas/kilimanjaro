import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const skyBlue50 = Color(0xFFF0F9FF);
  static const skyBlue100 = Color(0xFFE0F2FE);
  static const skyBlue200 = Color(0xFFBAE6FD);
  static const skyBlue300 = Color(0xFF7DD3FC);
  static const skyBlue400 = Color(0xFF38BDF8);
  static const skyBlue500 = Color(0xFF0EA5E9);
  static const skyBlue600 = Color(0xFF0284C7);
  static const skyBlue700 = Color(0xFF0369A1);
  static const skyBlue800 = Color(0xFF075985);
  static const skyBlue900 = Color(0xFF0C4A6E);

  static const accentTeal = Color(0xFF06B6D4);
  static const accentIndigo = Color(0xFF6366F1);
  static const accentViolet = Color(0xFF7C3AED);
  static const accentAmber = Color(0xFFF59E0B);
  static const accentRose = Color(0xFFF43F5E);
  static const accentEmerald = Color(0xFF10B981);

  static const eLearningPrimary = Color(0xFF6C63FF);
  static const eLearningLight = Color(0xFFEEEDFF);
  static const eLearningDark = Color(0xFF3D35CC);

  static const white = Color(0xFFFFFFFF);
  static const offWhite = Color(0xFFF8FAFC);
  static const surface = Color(0xFFF1F5F9);
  static const border = Color(0xFFE2E8F0);
  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF475569);
  static const textMuted = Color(0xFF94A3B8);
  static const textPlaceholder = Color(0xFFCBD5E1);

  static const darkBg = Color(0xFF0F172A);
  static const darkSurface = Color(0xFF1E293B);
  static const darkCard = Color(0xFF243044);
  static const darkBorder = Color(0xFF334155);
  static const darkText = Color(0xFFF1F5F9);
  static const darkTextSecondary = Color(0xFF94A3B8);
  static const darkMuted = Color(0xFF64748B);

  static const success = Color(0xFF10B981);
  static const warning = Color(0xFFF59E0B);
  static const error = Color(0xFFEF4444);
  static const info = Color(0xFF0EA5E9);

  static const primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [skyBlue600, skyBlue500],
  );

  static const deepGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [skyBlue800, skyBlue600],
  );

  static const heroGradient = LinearGradient(
    begin: Alignment(-0.2, -1.0),
    end: Alignment(1.0, 1.2),
    colors: [Color(0xFF0C4A6E), Color(0xFF0369A1), Color(0xFF0EA5E9)],
    stops: [0, 0.5, 1],
  );
}
