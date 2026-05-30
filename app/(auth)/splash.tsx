import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Animated, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';




const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { theme } = useTheme();
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background glow */}
      <View style={styles.glowContainer}>
        <View style={[styles.glow1, { backgroundColor: theme.primary }]} />
        <View style={[styles.glow2, { backgroundColor: theme.secondary }]} />
      </View>

      {/* Logo */}
      <Animated.View style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image
          source={require('../../assets/pm_logo.png')}
          style={styles.logoImage}
          contentFit="contain"
        />
      </Animated.View>

      {/* App Name */}
      <Animated.Text style={[styles.appName, { color: theme.text, opacity: textOpacity }]}>
        Personal Messenger
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { color: theme.textSecondary, opacity: taglineOpacity }]}>
        Stay close, no matter the distance
      </Animated.Text>

      {/* Buttons */}
      <Animated.View style={[styles.buttons, { opacity: btnOpacity }]}>
        <TouchableOpacity
          onPress={() => router.replace('/(auth)/register' as any)}
          activeOpacity={0.85}
          style={styles.btnWrap}
        >
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnPrimary}
          >
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login' as any)}
          activeOpacity={0.85}
          style={[styles.btnSecondary, { borderColor: theme.borderStrong }]}
        >
          <Text style={[styles.btnSecondaryText, { color: theme.text }]}>I already have an account</Text>
        </TouchableOpacity>
      </Animated.View>

      <Text style={[styles.footer, { color: theme.textTertiary }]}>
        Personal Messenger v6.0.0 · Secure · Private
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  glowContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  glow1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -60,
    left: -80,
    opacity: 0.15,
  },
  glow2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    bottom: 80,
    right: -60,
    opacity: 0.12,
  },
  logoWrap: { marginBottom: 24 },
  logoImage: { width: 200, height: 150 },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 56,
    paddingHorizontal: 16,
  },
  buttons: { width: '100%', gap: 14 },
  btnWrap: { width: '100%' },
  btnPrimary: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  btnSecondary: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  btnSecondaryText: { fontWeight: '600', fontSize: 15 },
  footer: { position: 'absolute', bottom: 32, fontSize: 12 },
});