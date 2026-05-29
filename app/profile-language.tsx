import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileLanguageScreen() {
  const { theme } = useTheme();
  const [language, setLanguage] = useState('English (US)');
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const languages = ['English (US)', 'Bangla', 'Hindi', 'Spanish'];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Language</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {languages.map((item, index) => {
            const selected = item === language;
            return (
              <View key={item}>
                <TouchableOpacity onPress={() => setLanguage(item)} activeOpacity={0.75} style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: selected ? `${theme.primary}20` : theme.surfaceElevated }]}>
                    <Ionicons name="language-outline" size={20} color={selected ? theme.primary : theme.textSecondary} />
                  </View>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{item}</Text>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
                </TouchableOpacity>
                {index < languages.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
              </View>
            );
          })}
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
  content: { padding: 16, paddingBottom: 40 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
});
