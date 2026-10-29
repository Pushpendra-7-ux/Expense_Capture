import { Platform } from 'react-native';

/**
 * Dexter OPE design tokens.
 *
 * Warm paper surfaces, near-black ink, and a restrained amber accent. The
 * palette is intentionally narrow so every screen — capture, review, detail,
 * confirmation — feels like one ledger.
 */
const fontFamily = Platform.select({
  web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) as string;

export const theme = {
  colors: {
    // Core ink
    ink: '#0B1220',
    black: '#080A0F',
    navy: '#101828',
    white: '#FFFFFF',

    // Surfaces
    bgPrimary: '#F7F8FB',
    bgSecondary: '#F1F4F9',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F4F9',
    surfaceSunken: '#EAEEF5',
    overlay: 'rgba(8, 10, 15, 0.55)',

    // Text
    textPrimary: '#101828',
    textSecondary: '#667085',
    textMuted: '#98A2B3',
    textOnDark: '#FFFFFF',

    // Lines
    border: '#E8EBF0',
    borderLight: '#EFF2F6',
    borderStrong: '#D0D5DD',

    // Amber accent
    amber: '#B88338',
    amberDeep: '#8F6424',
    amberSoft: '#FBF3E3',
    amberBorder: '#F1E2C6',
    amberOnDark: '#E8C98E',

    // Status
    success: '#6F7D3C',
    successSoft: '#F1F4E6',
    successBorder: '#E3E8CF',
    warning: '#B88338',
    warningSoft: '#FBF3E3',
    error: '#B42318',
    errorSoft: '#FEF3F2',
    errorBorder: '#FECDCA',

    // Supporting tints
    iconBg: '#EFF4FA',
    iconInk: '#23324A',
    indigo: '#475467',
    indigoBg: '#EEF2F7',
    lavender: '#EEEDFC',

    // Aliases kept for shared components
    bgDark: '#0B1220',
    textAmber: '#B88338',
  },

  layout: {
    maxWidth: 440,
    desktopBreakpoint: 1024,
    contentMaxWidth: 1280,
    gutter: 20,
    safeBottom: 24,
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
  },

  radii: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 30,
    full: 9999,
  },

  typography: {
    fontFamily,

    displayLarge: {
      fontSize: 42,
      fontWeight: '800' as const,
      lineHeight: 48,
      letterSpacing: -1.4,
    },
    displayMedium: {
      fontSize: 34,
      fontWeight: '800' as const,
      lineHeight: 40,
      letterSpacing: -1,
    },
    headingLarge: {
      fontSize: 26,
      fontWeight: '800' as const,
      lineHeight: 32,
      letterSpacing: -0.6,
    },
    headingMedium: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 26,
      letterSpacing: -0.3,
    },
    headingSmall: {
      fontSize: 17,
      fontWeight: '700' as const,
      lineHeight: 23,
    },
    bodyLarge: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    bodyMedium: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 21,
    },
    bodySmall: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 19,
    },
    caption: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 17,
    },
    label: {
      fontSize: 10,
      fontWeight: '700' as const,
      lineHeight: 14,
      letterSpacing: 1.35,
      textTransform: 'uppercase' as const,
    },
    micro: {
      fontSize: 10,
      fontWeight: '600' as const,
      lineHeight: 13,
    },
  },

  shadows: {
    sm: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 2,
    },
    lg: {
      shadowColor: '#101828',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 28,
      elevation: 5,
    },
  },
};

export type Theme = typeof theme;
