import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileDataStorageScreen() {
  const { theme } = useTheme();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const clearCache = () => Alert.alert('Cache cleared', 'Local image and call caches have been cleared.');

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Data & Storage</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.storageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.storageHeader}>
            <Ionicons name="cloud-done-outline" size={28} color={theme.primary} />
            <View>
              <Text style={[styles.storageTitle, { color: theme.text }]}>Media storage</Text>
              <Text style={[styles.storageText, { color: theme.textSecondary }]}>Supabase public media bucket</Text>
            </View>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceElevated }]}>
            <View style={[styles.progressFill, { backgroundColor: theme.primary }]} />
          </View>
          <Text style={[styles.storageMeta, { color: theme.textSecondary }]}>High quality upload mode, 0.82 compression</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity onPress={clearCache} activeOpacity={0.75} style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${theme.error}16` }]}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Clear local cache</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Remove temporary image and call data.</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
          </TouchableOpacity>
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
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  storageCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 14 },
  storageHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storageTitle: { fontSize: 17, fontWeight: '900' },
  storageText: { fontSize: 13, marginTop: 2 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { width: '34%', height: '100%', borderRadius: 4 },
  storageMeta: { fontSize: 12, fontWeight: '600' },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 13, lineHeight: 18 },
});
