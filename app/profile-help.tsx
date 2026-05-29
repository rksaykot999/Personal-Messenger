import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileHelpScreen() {
  const { theme } = useTheme();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const faqs = [
    ['How do I add a friend?', 'Open Discover, search for a person, then send a friend request.'],
    ['How do I create a group?', 'Open New Chat, switch to Group, select friends, add a name, and create it.'],
    ['Why are media uploads failing?', 'Check that the Supabase media bucket is configured and accessible.'],
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Help Center</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {faqs.map(([question, answer]) => (
          <View key={question} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.question, { color: theme.text }]}>{question}</Text>
            <Text style={[styles.answer, { color: theme.textSecondary }]}>{answer}</Text>
          </View>
        ))}
        <View style={[styles.supportCard, { backgroundColor: `${theme.primary}14`, borderColor: `${theme.primary}35` }]}>
          <Ionicons name="mail-outline" size={22} color={theme.primary} />
          <Text style={[styles.supportText, { color: theme.text }]}>support@personalmessenger.com</Text>
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
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 7 },
  question: { fontSize: 15, fontWeight: '900' },
  answer: { fontSize: 14, lineHeight: 21 },
  supportCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 16 },
  supportText: { fontSize: 14, fontWeight: '800' },
});
