import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileAboutScreen() {
  const { theme } = useTheme();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>About</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[theme.primary, theme.secondary]} style={styles.brandCard}>
          <Ionicons name="chatbubbles" size={42} color="#fff" />
          <Text style={styles.brandTitle}>Personal Messenger</Text>
          <Text style={styles.brandSub}>Version 4.0.0</Text>
        </LinearGradient>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Built for private conversations</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            A real-time chat experience built with React Native, Expo, Firebase, and Supabase media storage.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Cloud services</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>Firebase handles identity, presence and messages. Supabase stores uploaded media and profile photos.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  brandCard: { alignItems: 'center', gap: 8, borderRadius: 20, padding: 26 },
  brandTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 2 },
  brandSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  body: { fontSize: 14, lineHeight: 21 },
});
