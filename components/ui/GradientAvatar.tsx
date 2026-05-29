import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';

interface GradientAvatarProps {
  name: string;
  size?: number;
  photoURL?: string | null;
  isOnline?: boolean;
  showStatus?: boolean;
}

const GRADIENT_SETS = [
  ['#6C63FF', '#FF6B9D'],
  ['#FF6B9D', '#FFB347'],
  ['#00D4AA', '#6C63FF'],
  ['#5DADE2', '#00D4AA'],
  ['#FFB347', '#FF6B9D'],
  ['#8B84FF', '#00D4AA'],
  ['#FF6B9D', '#5DADE2'],
  ['#00D4AA', '#FFB347'],
];

function getGradient(name: string) {
  const index = name.charCodeAt(0) % GRADIENT_SETS.length;
  return GRADIENT_SETS[index] as [string, string];
}

export function GradientAvatar({ name, size = 48, photoURL, isOnline = false, showStatus = false }: GradientAvatarProps) {
  const { theme } = useTheme();
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const fontSize = size * 0.38;
  const statusSize = size * 0.28;
  const gradients = getGradient(name);

  return (
    <View style={{ width: size, height: size }}>
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <LinearGradient
          colors={gradients}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
        </LinearGradient>
      )}
      {showStatus && (
        <View
          style={[
            styles.statusBadge,
            {
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              backgroundColor: isOnline ? theme.online : theme.offline,
              borderColor: theme.background,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    position: 'absolute',
    borderWidth: 2,
  },
});
