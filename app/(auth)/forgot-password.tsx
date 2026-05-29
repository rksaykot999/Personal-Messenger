import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PremiumButton } from '@/components/ui/PremiumButton';

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
      Alert.alert('Email Sent', 'Check your email for instructions to reset your password.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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
        <View style={styles.content}>
          <TouchableOpacity 
            style={[styles.backBtn, { backgroundColor: theme.inputBg }]} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBox}
            >
              <Ionicons name="key-outline" size={34} color="#fff" />
            </LinearGradient>
            <Text style={[styles.title, { color: theme.text }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Enter your email address and we will send you instructions to reset your password.
            </Text>
          </View>

          {!sent ? (
            <View style={styles.form}>
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

              <PremiumButton
                title="Send Reset Link"
                onPress={handleReset}
                loading={loading}
                size="lg"
              />
            </View>
          ) : (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={60} color={theme.success} />
              <Text style={[styles.successText, { color: theme.text }]}>
                Password reset email sent! Please check your inbox.
              </Text>
              <PremiumButton
                title="Back to Login"
                onPress={() => router.back()}
                size="lg"
              />
            </View>
          )}
        </View>
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
    right: -80,
    opacity: 0.12,
  },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 60, justifyContent: 'center' },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: 28,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 40 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, textAlign: 'center', paddingHorizontal: 20 },
  form: { gap: 20 },
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
  successBox: { alignItems: 'center', gap: 20 },
  successText: { fontSize: 16, textAlign: 'center', fontWeight: '600', marginBottom: 10 },
});
