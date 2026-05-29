import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

interface PremiumButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function PremiumButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: PremiumButtonProps) {
  const { theme } = useTheme();

  const sizeStyles = {
    sm: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
    md: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
    lg: { paddingVertical: 18, paddingHorizontal: 32, borderRadius: 16 },
  };

  const textSizes = { sm: 13, md: 15, lg: 17 };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[fullWidth && styles.fullWidth, style]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.btn, sizeStyles[size], disabled && styles.disabled]}
        >
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={[styles.primaryText, { fontSize: textSizes[size] }]}>
            {loading ? 'Please wait...' : title}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const variantStyle = {
    secondary: {
      bg: theme.surfaceElevated,
      border: theme.primary,
      text: theme.primary,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      text: theme.textSecondary,
    },
    danger: {
      bg: 'rgba(255,71,87,0.12)',
      border: theme.error,
      text: theme.error,
    },
  }[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        sizeStyles[size],
        {
          backgroundColor: variantStyle.bg,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: variantStyle.border,
        },
        disabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { fontSize: textSizes[size], color: variantStyle.text }]}>
        {loading ? 'Please wait...' : title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { width: '100%' },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.5 },
  icon: { marginRight: 8 },
});
