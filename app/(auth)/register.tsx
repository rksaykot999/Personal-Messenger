import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

import { signInWithGoogleCredential, signInWithGoogleWeb, signInWithFacebookWeb } from '@/services/firebase';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
// (keep imports minimal) removed makeRedirectUri

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = '980124602830-fuinut6s1ark4mu4g8a2bmbhfsm0o206.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = WEB_CLIENT_ID;
const IOS_CLIENT_ID = WEB_CLIENT_ID;

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


  React.useEffect(() => {
    if (promptRef && promptAsync) {
      promptRef.current = () => promptAsync();
    }
  }, [promptAsync]);

  React.useEffect(() => {
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

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const promptRef = useRef<() => Promise<any>>(async () => ({ type: 'error' }));

  const showAlert = (title: string, message: string) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`${title}\n\n${message}`);
      } else {
        Alert.alert(title, message);
      }
    } catch (err) {
      console.error('showAlert failed:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      setGoogleLoading(true);
      try {
        await signInWithGoogleWeb();
      } catch (e: any) {
        showAlert('Google Sign-In Failed', e.message || 'Please try again');
      } finally {
        setGoogleLoading(false);
      }
    } else {
      try {
        await promptRef.current();
      } catch (err) {
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

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      shake();
      Alert.alert('Missing info', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      shake();
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      shake();
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      shake();
      Alert.alert('Registration Failed', e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {Platform.OS !== 'web' && (
        <NativeGoogleAuth promptRef={promptRef} setGoogleLoading={setGoogleLoading} showAlert={showAlert} />
      )}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.glow, { backgroundColor: theme.secondary }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {name.trim() ? (
              <View style={{ marginBottom: 16 }}>
                <GradientAvatar name={name.trim() || 'U'} size={72} />
              </View>
            ) : (
              <Image
                source={require('../../assets/pm_logo.png')}
                style={styles.logoImage}
                contentFit="contain"
              />
            )}
            <Text style={[styles.title, { color: theme.text }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Join Personal Messenger and stay connected
            </Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            {/* Name */}
            <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={20} color={theme.textTertiary} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Display name"
                placeholderTextColor={theme.textTertiary}
                style={[styles.input, { color: theme.text }]}
              />
            </View>

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
                placeholder="Password (min 6 chars)"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPass}
                style={[styles.input, { color: theme.text }]}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <View style={[styles.inputWrap, {
              backgroundColor: theme.inputBg,
              borderColor: confirm && confirm !== password ? theme.error : theme.border,
            }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={theme.textTertiary} />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPass}
                style={[styles.input, { color: theme.text }]}
              />
              {confirm.length > 0 && (
                <Ionicons
                  name={confirm === password ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={confirm === password ? theme.success : theme.error}
                />
              )}
            </View>

            <PremiumButton title="Create Account" onPress={handleRegister} loading={loading} size="lg" />

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

            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login' as any)}
              style={[styles.loginBtn, { borderColor: theme.borderStrong }]}
            >
              <Text style={[styles.loginText, { color: theme.text }]}>
                Already have an account?{' '}
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Sign In</Text>
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
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: -80,
    right: -60,
    opacity: 0.1,
  },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 60 },
  header: { alignItems: 'center', marginBottom: 36 },
  logoImage: {
    width: 90,
    height: 90,
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  divLine: { flex: 1, height: 1 },
  divText: { fontSize: 13 },
  loginBtn: { paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', marginTop: 10 },
  loginText: { fontSize: 14 },
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
