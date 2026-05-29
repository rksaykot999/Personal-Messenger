import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileNotificationsScreen() {
  const { theme } = useTheme();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [callAlerts, setCallAlerts] = useState(true);
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const rows = [
    { icon: 'notifications-outline' as const, title: 'Push notifications', sub: 'Messages, requests and profile alerts.', value: pushEnabled, onChange: setPushEnabled },
    { icon: 'volume-medium-outline' as const, title: 'Message sounds', sub: 'Play a short tone for incoming messages.', value: soundEnabled, onChange: setSoundEnabled },
    { icon: 'call-outline' as const, title: 'Call alerts', sub: 'Show incoming voice and video call prompts.', value: callAlerts, onChange: setCallAlerts },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
});
