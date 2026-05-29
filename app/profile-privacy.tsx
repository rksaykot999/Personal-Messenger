import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export default function ProfilePrivacyScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const lastSeen = userProfile?.lastSeenEnabled ?? true;
  const readReceipts = userProfile?.readReceiptsEnabled ?? true;
  const profileVisible = userProfile?.profileVisibilityEnabled ?? true;

  const handleToggleSetting = async (field: string, currentVal: boolean) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        [field]: !currentVal,
      });
    } catch (err) {
      console.error(`Error toggling setting ${field}:`, err);
    }
  };

  const rows = [
    { 
      icon: 'eye-outline' as const, 
      title: 'Show last seen', 
      sub: 'Let friends know when you were last active.', 
      value: lastSeen, 
      onChange: () => handleToggleSetting('lastSeenEnabled', lastSeen) 
    },
    { 
      icon: 'checkmark-done-outline' as const, 
      title: 'Read receipts', 
      sub: 'Show when you have read messages.', 
      value: readReceipts, 
      onChange: () => handleToggleSetting('readReceiptsEnabled', readReceipts) 
    },
    { 
      icon: 'person-circle-outline' as const, 
      title: 'Profile visibility', 
      sub: 'Allow friends to view photo, bio and status.', 
      value: profileVisible, 
      onChange: () => handleToggleSetting('profileVisibilityEnabled', profileVisible) 
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Privacy & Security</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.notice, { backgroundColor: `${theme.success}14`, borderColor: `${theme.success}40` }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={theme.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: theme.text }]}>Protected account</Text>
            <Text style={[styles.noticeText, { color: theme.textSecondary }]}>Your profile is synced through Firebase and media is stored in Supabase Storage.</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {rows.map((row, index) => (
            <View key={row.title}>
              <View style={styles.row}>
                <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
                  <Ionicons name={row.icon} size={20} color={theme.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme.text }]}>{row.title}</Text>
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{row.sub}</Text>
                </View>
                <Switch value={row.value} onValueChange={row.onChange} trackColor={{ false: theme.border, true: `${theme.primary}70` }} thumbColor={row.value ? theme.primary : theme.textTertiary} />
              </View>
              {index < rows.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            </View>
          ))}
        </View>

        {/* Blocked Users Navigation Link */}
        <TouchableOpacity
          onPress={() => router.push('/profile-blocked-users')}
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 4 }]}
        >
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,23,73,0.1)' }]}>
              <Ionicons name="ban-outline" size={20} color="#FF1744" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Blocked Users</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {userProfile?.blockedUsers?.length || 0} contacts blocked
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </View>
        </TouchableOpacity>
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
  notice: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  noticeTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  noticeText: { fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
});
