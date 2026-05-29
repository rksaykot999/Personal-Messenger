import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

type IconName = keyof typeof Ionicons.glyphMap;

const getSettingColor = (label: string, theme: any) => {
  switch (label.toLowerCase()) {
    case 'dark mode':
      return '#AF52DE'; // Purple
    case 'font size':
      return '#32ADE6'; // Cyan
    case 'push notifications':
      return '#FF3B30'; // Red
    case 'message sounds':
      return '#FF2D55'; // Pink
    case 'edit profile':
      return '#5856D6'; // Indigo
    case 'logout':
      return '#FF3B30'; // Red
    case 'last seen':
      return '#34C759'; // Green
    case 'read receipts':
      return '#00C7BE'; // Teal
    case 'blocked users':
      return '#555555'; // Dark Gray
    case 'version 4.0.0':
    case 'privacy policy':
      return '#8E8E93'; // Gray
    default:
      return theme.primary;
  }
};

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { logout, user, userProfile, updateUserProfile } = useAuth();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const handleToggleSetting = async (field: string, currentValue: boolean) => {
    try {
      await updateUserProfile({ [field]: !currentValue });
    } catch (err) {
      console.error(`Error toggling settings field ${field}:`, err);
      Alert.alert('Error', 'Could not update setting.');
    }
  };

  const handleItemPress = (item: any) => {
    if (item.type === 'toggle' && item.onToggle) {
      item.onToggle();
    } else if (item.type === 'nav') {
      if (item.onPress) {
        item.onPress();
      } else if (item.route) {
        router.push(item.route as any);
      }
    }
  };

  const pushNotifications = userProfile?.pushNotificationsEnabled ?? true;
  const messageSounds = userProfile?.messageSoundsEnabled ?? true;
  const readReceipts = userProfile?.readReceiptsEnabled ?? true;

  const sections = [
    {
      title: 'Appearance',
      items: [
        { icon: 'moon-outline' as const, label: 'Dark Mode', type: 'toggle', value: isDark, onToggle: toggleTheme, route: '/profile-appearance' },
        { icon: 'text-outline' as const, label: 'Font Size', type: 'nav', route: '/profile-appearance' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { 
          icon: 'notifications-outline' as const, 
          label: 'Push Notifications', 
          type: 'toggle', 
          value: pushNotifications, 
          onToggle: () => handleToggleSetting('pushNotificationsEnabled', pushNotifications),
          route: '/profile-notifications'
        },
        { 
          icon: 'volume-medium-outline' as const, 
          label: 'Message Sounds', 
          type: 'toggle', 
          value: messageSounds, 
          onToggle: () => handleToggleSetting('messageSoundsEnabled', messageSounds),
          route: '/profile-notifications'
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { icon: 'eye-outline' as const, label: 'Last Seen', type: 'nav', route: '/profile-privacy' },
        { 
          icon: 'checkmark-done-outline' as const, 
          label: 'Read Receipts', 
          type: 'toggle', 
          value: readReceipts, 
          onToggle: () => handleToggleSetting('readReceiptsEnabled', readReceipts),
          route: '/profile-privacy'
        },
        { icon: 'person-remove-outline' as const, label: 'Blocked Users', type: 'nav', route: '/profile-blocked-users' },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: 'information-circle-outline' as const, label: 'Version 4.0.0', type: 'info', route: '/profile-about' },
        { icon: 'shield-outline' as const, label: 'Privacy Policy', type: 'nav', route: '/profile-privacy' },
      ],
    },
    {
      title: 'Session',
      items: [
        { icon: 'log-out-outline' as const, label: 'Logout', type: 'nav', onPress: () => {
          if (Platform.OS === 'web') {
            if (window.confirm('Are you sure you want to logout?')) {
              logout();
              router.replace('/(auth)/splash' as any);
            }
          } else {
            Alert.alert('Logout', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: async () => {
                await logout();
                router.replace('/(auth)/splash' as any);
              }}
            ]);
          }
        }},
      ],
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Modern Professional Header */}
      <View style={[styles.header, { paddingTop: statusBarH + 16, backgroundColor: theme.background }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* New Style User Profile Header Component */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.8}
          style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <GradientAvatar
            name={userProfile?.displayName || user?.displayName || 'User'}
            photoURL={userProfile?.photoURL || user?.photoURL}
            size={56}
          />
          <View style={styles.profileTextWrap}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {userProfile?.displayName || user?.displayName || 'Your Name'}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textSecondary }]} numberOfLines={1}>
              {userProfile?.email || user?.email || 'No email linked'}
            </Text>
            {userProfile?.status && (
              <View style={[styles.statusBadge, { backgroundColor: `${theme.primary}12` }]}>
                <Text style={[styles.statusText, { color: theme.primary }]} numberOfLines={1}>
                  {userProfile.statusEmoji || '👋'} {userProfile.status}
                </Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </TouchableOpacity>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{section.title}</Text>
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {section.items.map((item: any, i) => (
                <View key={item.label}>
                  <TouchableOpacity
                    onPress={() => handleItemPress(item)}
                    activeOpacity={item.type === 'info' ? 1 : 0.75}
                    disabled={item.type === 'info'}
                    style={styles.menuItem}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${getSettingColor(item.label, theme)}18` }]}>
                      <Ionicons name={item.icon} size={18} color={getSettingColor(item.label, theme)} />
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  profileTextWrap: { flex: 1, gap: 3 },
  profileName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  profileEmail: { fontSize: 12, opacity: 0.8 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
    maxWidth: '100%',
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  section: { marginTop: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
});
