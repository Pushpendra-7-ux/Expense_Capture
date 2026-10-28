export const theme = {
  colors: {
    // Core
    navy: '#1A1B2F',
    indigo: '#5B52E0',
    amber: '#C4841D',
    white: '#FFFFFF',

    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F5F5F7',
    bgDark: '#1A1B2F',

    // Text
    textPrimary: '#1A1B2F',
    textSecondary: '#6B7280',
    textOnDark: '#FFFFFF',
    textAmber: '#C4841D',

    // Borders
    border: '#E8E8EC',
    borderLight: '#F0F0F4',

    // Status
    success: '#22C55E',
    successBg: '#ECFDF5',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    warning: '#F59E0B',

    // Accent
    indigoBg: '#EEEDFC',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  typography: {
    // Font family - Inter
    fontFamily: 'Inter',

    // Sizes
    displayLarge: { fontSize: 36, fontWeight: '800' as const, lineHeight: 42 },
    displayMedium: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
    headingLarge: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
    headingMedium: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
    headingSmall: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
    bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    label: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    },
    caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    },
  },
};

export type Theme = typeof theme;
