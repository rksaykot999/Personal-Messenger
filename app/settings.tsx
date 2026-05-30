import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const sections = [
    {
      title: 'Appearance',
      items: [
        { icon: 'moon-outline', label: 'Dark Mode', type: 'toggle', value: isDark, onToggle: toggleTheme },
        { icon: 'text-outline', label: 'Font Size', type: 'nav', onPress: () => {} },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { icon: 'notifications-outline', label: 'Push Notifications', type: 'toggle', value: true, onToggle: () => {} },
        { icon: 'volume-medium-outline', label: 'Message Sounds', type: 'toggle', value: true, onToggle: () => {} },
        { icon: 'phone-portrait-outline', label: 'In-App Alerts', type: 'toggle', value: false, onToggle: () => {} },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { icon: 'eye-outline', label: 'Last Seen', type: 'nav', onPress: () => {} },
        { icon: 'checkmark-done-outline', label: 'Read Receipts', type: 'toggle', value: true, onToggle: () => {} },
        { icon: 'person-remove-outline', label: 'Blocked Users', type: 'nav', onPress: () => {} },
      ],
    },
    {
      title: 'Storage',
      items: [
        { icon: 'cloud-download-outline', label: 'Auto-Download Media', type: 'toggle', value: false, onToggle: () => {} },
        { icon: 'trash-outline', label: 'Clear Cache', type: 'nav', onPress: () => Alert.alert('Cache Cleared', 'App cache has been cleared.') },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: 'information-circle-outline', label: 'Version 6.0.0', type: 'info' },
        { icon: 'shield-outline', label: 'Privacy Policy', type: 'nav', onPress: () => {} },
        { icon: 'document-text-outline', label: 'Terms of Service', type: 'nav', onPress: () => {} },
      ],
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{section.title}</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {section.items.map((item: any, i) => (
                <View key={item.label}>
                  <TouchableOpacity
                    onPress={item.type === 'nav' ? item.onPress : undefined}
                    activeOpacity={item.type === 'nav' ? 0.7 : 1}
                    style={styles.menuItem}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}15` }]}>
                      <Ionicons name={item.icon} size={17} color={theme.primary} />
                    </View>
                    <Text style={[styles.menuLabel, { color: item.type === 'info' ? theme.textSecondary : theme.text }]}>
                      {item.label}
                    </Text>
                    {item.type === 'toggle' && (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: theme.border, true: `${theme.primary}60` }}
                        thumbColor={item.value ? theme.primary : theme.textTertiary}
                      />
                    )}
                    {item.type === 'nav' && (
                      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                    )}
                  </TouchableOpacity>
                  {i < section.items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16, gap: 0, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  iconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
});
