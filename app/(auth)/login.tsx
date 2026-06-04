import { PremiumButton } from '@/components/ui/PremiumButton';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { signInWithGoogleCredential, signInWithGoogleWeb, signInWithFacebookWeb } from '@/services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView, Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View,
} from 'react-native';

// Required for expo-auth-session to handle the redirect on native
WebBrowser.maybeCompleteAuthSession();

// ──────────────────────────────────────────────────────────────────
// IMPORTANT: Replace these with your real Google OAuth client IDs
// from https://console.cloud.google.com → APIs & Services → Credentials
// For a quick test you can leave them as empty strings — only the
// web popup (Platform.OS === 'web') will work without them.
// ──────────────────────────────────────────────────────────────────
const WEB_CLIENT_ID = '980124602830-fuinut6s1ark4mu4g8a2bmbhfsm0o206.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = WEB_CLIENT_ID;
const IOS_CLIENT_ID = WEB_CLIENT_ID;

// Native-only helper component: keeps the expo-auth-session hook
// inside a component that is only mounted on native platforms so
// we don't call hooks conditionally in the main LoginScreen.
function NativeGoogleAuth({
  promptRef,
  setGoogleLoading,
  showAlert,
}: {
  promptRef: React.RefObject<() => Promise<any>>;
  setGoogleLoading: (v: boolean) => void;
  showAlert: (t: string, m: string) => void;
}) {
  // Expo Auth Proxy redirect URI - must match exactly what's in Google Cloud Console
  const redirectUri = 'https://auth.expo.io/@rksaykot999/personal-messenger';

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID || undefined,
    iosClientId: IOS_CLIENT_ID || undefined,
    webClientId: WEB_CLIENT_ID || undefined,
    redirectUri,
  });


  useEffect(() => {
    // expose promptAsync to parent via ref
    if (promptRef && promptAsync) {
      promptRef.current = () => promptAsync();
    }
  }, [promptAsync]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken) {
        setGoogleLoading(true);
        signInWithGoogleCredential(authentication.idToken, authentication.accessToken ?? undefined)
          .catch((e: any) => showAlert('Google Sign-In Failed', e.message || 'Please try again'))
          .finally(() => setGoogleLoading(false));
      } else {
        showAlert('Google Sign-In Failed', 'No ID token received. Please try again.');
      }
    } else if (response?.type === 'error') {
      showAlert('Google Sign-In Failed', response.error?.message || 'Please try again');
    }
  }, [response]);

  return null;
}

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const promptRef = useRef<() => Promise<any>>(async () => ({ type: 'error' }));

  const showAlert = (title: string, message: string) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // window.alert is a safe fallback on web where Alert.alert may be inconsistent
        window.alert(`${title}\n\n${message}`);
      } else {
        Alert.alert(title, message);
      }
    } catch (err) {
      // Ensure we never crash due to alert invocation
      // eslint-disable-next-line no-console
      console.error('showAlert failed:', err);
    }
  };

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
      showAlert('Missing info', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    // Diagnostic log
    // eslint-disable-next-line no-console
    console.log('Login attempt for', email);
    try {
      await login(email.trim().toLowerCase(), password);
      // Navigation is handled automatically by RootContent in _layout.tsx
      // when the user state changes via onAuthStateChanged
    } catch (e: any) {
      shake();
      // eslint-disable-next-line no-console
      console.error('Login failed', e);
      showAlert('Login Failed', e.message || 'Invalid credentials. Please try again.');
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
        // Navigation handled automatically by RootContent in _layout.tsx
      } catch (e: any) {
        showAlert('Google Sign-In Failed', e.message || 'Please try again');
      } finally {
        setGoogleLoading(false);
      }
    } else {
      // Native: trigger the expo-auth-session prompt
      // The native hook is implemented in NativeGoogleAuth and exposes
      // the `promptAsync` via `promptRef`.
      try {
        await promptRef.current();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('promptAsync failed', err);
      }
    }
  };

  const handleFacebookSignIn = async () => {
    if (Platform.OS === 'web') {
      setGoogleLoading(true);
      try {
        await signInWithFacebookWeb();
      } catch (e: any) {
        showAlert('Facebook Sign-In Failed', e.message || 'Please try again');
      } finally {
        setGoogleLoading(false);
      }
    } else {
      showAlert('Coming Soon', 'Facebook Sign-In on mobile requires a full app build.');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {Platform.OS !== 'web' && (
        <NativeGoogleAuth promptRef={promptRef} setGoogleLoading={setGoogleLoading} showAlert={showAlert} />
      )}
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
              <TouchableOpacity
                style={[styles.socialBtn, { borderColor: theme.border }]}
                onPress={handleFacebookSignIn}
                disabled={googleLoading}
              >
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
