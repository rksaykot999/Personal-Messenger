// SnapTalk Design System — Premium Theme
export const Colors = {
  dark: {
    // Backgrounds
    background: '#0A0A0F',
    surface: '#12121A',
    surfaceElevated: '#1A1A26',
    card: '#16161F',
    cardHighlight: '#1E1E2D',

    // Brand
    primary: '#6C63FF',
    primaryLight: '#8B84FF',
    primaryDark: '#4D45CC',
    secondary: '#FF6B9D',
    secondaryLight: '#FF8FB8',
    accent: '#00D4AA',

    // Text
    text: '#FFFFFF',
    textSecondary: '#8B8B9E',
    textTertiary: '#4A4A5A',
    textInverse: '#0A0A0F',

    // Status
    success: '#00D4AA',
    warning: '#FFB347',
    error: '#FF4757',
    info: '#5DADE2',

    // Chat
    myBubble: '#6C63FF',
    theirBubble: '#1E1E2D',
    myBubbleText: '#FFFFFF',
    theirBubbleText: '#FFFFFF',

    // Online indicator
    online: '#00D4AA',
    offline: '#4A4A5A',
    away: '#FFB347',

    // UI elements
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',
    glass: 'rgba(255,255,255,0.05)',
    glassBorder: 'rgba(255,255,255,0.1)',
    overlay: 'rgba(0,0,0,0.7)',
    inputBg: '#1E1E2D',

    // Tab bar
    tabBar: '#0E0E16',
    tabBarActive: '#6C63FF',
    tabBarInactive: '#4A4A5A',

    // Shadows
    shadow: 'rgba(108,99,255,0.3)',

    // Gradients (used as arrays)
    gradientPrimary: ['#6C63FF', '#FF6B9D'],
    gradientBg: ['#0A0A0F', '#12121A'],
    gradientCard: ['#1A1A26', '#12121A'],

    // tint for expo-router compat
    tint: '#6C63FF',
    icon: '#8B8B9E',
    tabIconDefault: '#4A4A5A',
    tabIconSelected: '#6C63FF',
  },
  light: {
    background: '#F5F5FF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',
    cardHighlight: '#F0EFFF',
    primary: '#6C63FF',
    primaryLight: '#8B84FF',
    primaryDark: '#4D45CC',
    secondary: '#FF6B9D',
    secondaryLight: '#FF8FB8',
    accent: '#00D4AA',
    text: '#0A0A0F',
    textSecondary: '#5A5A6E',
    textTertiary: '#9A9AAE',
    textInverse: '#FFFFFF',
    success: '#00D4AA',
    warning: '#FFB347',
    error: '#FF4757',
    info: '#5DADE2',
    myBubble: '#6C63FF',
    theirBubble: '#EFEFFF',
    myBubbleText: '#FFFFFF',
    theirBubbleText: '#0A0A0F',
    online: '#00D4AA',
    offline: '#CCCCDD',
    away: '#FFB347',
    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.15)',
    glass: 'rgba(255,255,255,0.7)',
    glassBorder: 'rgba(108,99,255,0.2)',
    overlay: 'rgba(0,0,0,0.5)',
    inputBg: '#F0EFFF',
    tabBar: '#FFFFFF',
    tabBarActive: '#6C63FF',
    tabBarInactive: '#AAAABC',
    shadow: 'rgba(108,99,255,0.15)',
    gradientPrimary: ['#6C63FF', '#FF6B9D'],
    gradientBg: ['#F5F5FF', '#EFEFFF'],
    gradientCard: ['#FFFFFF', '#F8F8FF'],
    tint: '#6C63FF',
    icon: '#5A5A6E',
    tabIconDefault: '#AAAABC',
    tabIconSelected: '#6C63FF',
  },
};

export const Typography = {
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    poppinsBold: 'Poppins_700Bold',
    poppinsSemiBold: 'Poppins_600SemiBold',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
};
