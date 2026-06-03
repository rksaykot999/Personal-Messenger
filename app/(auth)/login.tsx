import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  StatusBar, Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogleWeb, signInWithGoogleCredential } from '@/services/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { PremiumButton } from '@/components/ui/PremiumButton';

// Required for expo-auth-session to handle the redirect on native
WebBrowser.maybeCompleteAuthSession();

// ──────────────────────────────────────────────────────────────────
// IMPORTANT: Replace these with your real Google OAuth client IDs
// from https://console.cloud.google.com → APIs & Services → Credentials
// For a quick test you can leave them as empty strings — only the
// web popup (Platform.OS === 'web') will work without them.
// ──────────────────────────────────────────────────────────────────
const ANDROID_CLIENT_ID = ''; // e.g. '443606839141-xxxx.apps.googleusercontent.com'
const IOS_CLIENT_ID = '';     // e.g. '443606839141-yyyy.apps.googleusercontent.com'
const WEB_CLIENT_ID = '';     // e.g. '443606839141-zzzz.apps.googleusercontent.com'

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Google Auth Session (native only) ────────────────────────────
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID || undefined,
    iosClientId: IOS_CLIENT_ID || undefined,
    webClientId: WEB_CLIENT_ID || undefined,
    redirectUri: makeRedirectUri(),
  });

  // Handle the response from the Google auth prompt (native)
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken) {
        setGoogleLoading(true);
        signInWithGoogleCredential(authentication.idToken, authentication.accessToken ?? undefined)
          .then(() => router.replace('/(tabs)' as any))
          .catch((e: any) => Alert.alert('Google Sign-In Failed', e.message || 'Please try again'))
          .finally(() => setGoogleLoading(false));
      } else {
        Alert.alert('Google Sign-In Failed', 'No ID token received. Please try again.');
      }
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign-In Failed', response.error?.message || 'Please try again');
    }
  }, [response]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      shake();
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      shake();
      Alert.alert('Login Failed', e.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      // Web: use Firebase popup — no client IDs needed
      setGoogleLoading(true);
      try {
        await signInWithGoogleWeb();
        router.replace('/(tabs)' as any);
      } catch (e: any) {
        Alert.alert('Google Sign-In Failed', e.message || 'Please try again');
      } finally {
        setGoogleLoading(false);
      }
    } else {
      // Native: trigger the expo-auth-session prompt
      // The result is handled in the useEffect above
      await promptAsync();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background Glow */}
      <View style={[styles.glow, { backgroundColor: theme.primary }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/pm_logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
            <Text style={[styles.title, { color: theme.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Sign in to continue to Personal Messenger
            </Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Email */}
            <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Ionicons name="mail-outline" size={20} color={theme.textTertiary} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={theme.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, { color: theme.text }]}
              />
            </View>

            {/* Password */}
            <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color={theme.textTertiary} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPass}
                style={[styles.input, { color: theme.text }]}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.forgotWrap} onPress={() => router.push('/(auth)/forgot-password' as any)}>
              <Text style={[styles.forgot, { color: theme.primary }]}>Forgot password?</Text>
            </TouchableOpacity>

            <PremiumButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              size="lg"
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.divLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.divText, { color: theme.textTertiary }]}>or continue with</Text>
              <View style={[styles.divLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Social Logins */}
            <View style={styles.socialWrap}>
              <TouchableOpacity
                style={[styles.socialBtn, { borderColor: theme.border }]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading
                  ? <Ionicons name="reload-outline" size={24} color={theme.textTertiary} />
                  : <Ionicons name="logo-google" size={24} color={theme.text} />
                }
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, { borderColor: theme.border }]} onPress={() => Alert.alert('Coming soon', 'Apple Sign-In will be available soon.')}>
                <Ionicons name="logo-apple" size={24} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, { borderColor: theme.border }]} onPress={() => Alert.alert('Coming soon', 'Facebook Sign-In will be available soon.')}>
                <Ionicons name="logo-facebook" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Register link */}
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/register' as any)}
              style={[styles.registerBtn, { borderColor: theme.borderStrong }]}
            >
              <Text style={[styles.registerText, { color: theme.text }]}>
                Don't have an account?{' '}
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    top: -120,
    left: -80,
    opacity: 0.12,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, textAlign: 'center' },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4 },
  forgot: { fontSize: 13, fontWeight: '600' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: 13 },
  registerBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 10,
  },
  registerText: { fontSize: 14 },
  socialWrap: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  socialBtn: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
