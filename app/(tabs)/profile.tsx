import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { uploadToSupabaseRest } from '@/services/supabase';

type IconName = keyof typeof Ionicons.glyphMap;

interface ActionItem {
  icon: IconName;
  title: string;
  subtitle: string;
  route?: string;
  onPress?: () => void;
  tone?: 'default' | 'danger';
}

const getItemColor = (title: string, theme: any) => {
  switch (title.toLowerCase()) {
    case 'profile details':
      return '#5856D6'; // Indigo
    case 'notifications':
      return '#FF3B30'; // Red
    case 'privacy & security':
      return '#34C759'; // Green
    case 'appearance':
      return '#AF52DE'; // Purple
    case 'language':
      return '#32ADE6'; // Cyan
    case 'data & storage':
      return '#FF9500'; // Orange
    case 'help center':
      return '#00C7BE'; // Teal
    case 'about personal messenger':
      return '#8E8E93'; // Gray
    case 'sign out':
      return '#FF3B30'; // Red
    default:
      return theme.primary;
  }
};

export default function ProfileScreen() {
  const { theme, mode } = useTheme();
  const { user, userProfile, logout, updateUserProfile } = useAuth();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);
  
  // Real-time conversations count
  const [chatsCount, setChatsCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setChatsCount(snap.size);
    }, (err) => {
      console.error("Error fetching chats count for profile:", err);
    });
    return () => unsub();
  }, [user]);

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const profilePhotoURL = localPhotoPreview || userProfile?.photoURL;
  const gender = String((userProfile as any)?.gender || '').toLowerCase();
  const genderIcon: IconName = gender === 'female' || gender === 'woman' ? 'female-outline' : 'male-outline';

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  };

  const getImageExtension = (mimeType?: string | null) => {
    if (mimeType?.includes('png')) return 'png';
    if (mimeType?.includes('webp')) return 'webp';
    if (mimeType?.includes('heic')) return 'heic';
    return 'jpg';
  };

  const handleUploadProfilePhoto = async () => {
    if (uploadingPhoto) return;

    const uid = user?.uid || userProfile?.uid;
    if (!uid) {
      showMessage('Not signed in', 'Please sign in again before changing your profile photo.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showMessage('Permission needed', 'Please allow photo library access to upload a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      setLocalPhotoPreview(asset.uri);

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const mimeType = asset.mimeType || blob.type || 'image/jpeg';
      const extension = getImageExtension(mimeType);
      const filePath = `profiles/${uid}/profile-photo-${Date.now()}.${extension}`;
      const photoURL = await uploadToSupabaseRest(filePath, blob, mimeType);

      await updateUserProfile({ photoURL });
      setLocalPhotoPreview(null);
      showMessage('Photo updated', 'Your profile photo has been uploaded successfully.');
    } catch (error: any) {
      setLocalPhotoPreview(null);
      showMessage('Upload failed', error?.message || 'Could not upload your profile photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/splash' as any);
        },
      },
    ]);
  };

  const navigate = (route: string) => router.push(route as any);

  const quickActions: ActionItem[] = [
    {
      icon: 'create-outline',
      title: 'Edit',
      subtitle: 'Profile',
      route: '/edit-profile',
    },
    {
      icon: 'camera-outline',
      title: 'Photo',
      subtitle: uploadingPhoto ? 'Uploading' : 'Change',
      onPress: handleUploadProfilePhoto,
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Security',
      subtitle: 'Account',
      route: '/profile-account',
    },
  ];

  const sections: { title: string; items: ActionItem[] }[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'person-circle-outline',
          title: 'Profile details',
          subtitle: 'Name, bio, status and personal information',
          route: '/edit-profile',
        },
        {
          icon: 'notifications-outline',
          title: 'Notifications',
          subtitle: 'Push alerts, message sounds and call alerts',
          route: '/profile-notifications',
        },
        {
          icon: 'lock-closed-outline',
          title: 'Privacy & security',
          subtitle: 'Last seen, read receipts and account protection',
          route: '/profile-privacy',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: mode === 'dark' ? 'moon-outline' : 'sunny-outline',
          title: 'Appearance',
          subtitle: `${mode === 'dark' ? 'Dark' : 'Light'} mode and display preferences`,
          route: '/profile-appearance',
        },
        {
          icon: 'language-outline',
          title: 'Language',
          subtitle: 'Choose app language and regional format',
          route: '/profile-language',
        },
        {
          icon: 'folder-open-outline',
          title: 'Data & storage',
          subtitle: 'Media quality, cache and storage usage',
          route: '/profile-data-storage',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          title: 'Help center',
          subtitle: 'Common questions and support guidance',
          route: '/profile-help',
        },
        {
          icon: 'information-circle-outline',
          title: 'About Personal Messenger',
          subtitle: 'Version, cloud services and product information',
          route: '/profile-about',
        },
        {
          icon: 'log-out-outline',
          title: 'Sign out',
          subtitle: 'Leave this device safely',
          onPress: handleLogout,
          tone: 'danger',
        },
      ],
    },
  ];

  const renderAction = (item: ActionItem, compact = false) => {
    const color = compact 
      ? (item.tone === 'danger' ? theme.error : theme.primary)
      : getItemColor(item.title, theme);
    const onPress = item.onPress || (item.route ? () => navigate(item.route!) : undefined);

    return (
      <TouchableOpacity
        key={item.title}
        onPress={onPress}
        activeOpacity={0.78}
        disabled={!onPress}
        style={[
          compact ? styles.quickAction : styles.menuItem,
          compact && { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={[compact ? styles.quickIcon : styles.menuIcon, { backgroundColor: `${color}18` }]}>
          {uploadingPhoto && item.title === 'Photo' ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Ionicons name={item.icon} size={compact ? 20 : 19} color={color} />
          )}
        </View>
        <View style={compact ? styles.quickTextWrap : styles.menuTextWrap}>
          <Text style={[compact ? styles.quickTitle : styles.menuTitle, { color: item.tone === 'danger' ? theme.error : theme.text }]}>
            {item.title}
          </Text>
          <Text style={[compact ? styles.quickSubtitle : styles.menuSubtitle, { color: theme.textSecondary }]} numberOfLines={compact ? 1 : 2}>
            {item.subtitle}
          </Text>
        </View>
        {!compact && item.tone !== 'danger' && (
          <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: statusBarH + 18 }]}
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.kicker}>Account</Text>
              <Text style={styles.heroTitle}>Profile</Text>
            </View>
            <View style={styles.genderBadge}>
              <Ionicons name={genderIcon} size={21} color="#fff" />
            </View>
          </View>

          <View style={styles.identityRow}>
            <TouchableOpacity onPress={handleUploadProfilePhoto} activeOpacity={0.86} style={styles.avatarWrap}>
              <GradientAvatar
                name={userProfile?.displayName || 'User'}
                photoURL={profilePhotoURL}
                size={84}
                isOnline
                showStatus
              />
            </TouchableOpacity>

            <View style={styles.identityText}>
              <Text style={styles.profileName} numberOfLines={1}>{userProfile?.displayName || 'Your Name'}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{userProfile?.email || 'No email'}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusEmoji}>{userProfile?.statusEmoji || '👋'}</Text>
                <Text style={styles.statusText} numberOfLines={1}>{userProfile?.status || 'Hey there!'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.quickGrid}>
          {quickActions.map((item) => renderAction(item, true))}
        </View>

        {/* Dynamic Professional Stats Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{chatsCount}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Conversations</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{userProfile?.friends?.length || 0}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Friends</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.text }]}>Secure</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Cloud Sync</Text>
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
            <View style={[styles.menuCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {section.items.map((item, index) => (
                <View key={item.title}>
                  {renderAction(item)}
                  {index < section.items.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.version, { color: theme.textTertiary }]}>Personal Messenger v2.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: 34 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  kicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 2 },
  genderBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1 },
  profileName: { color: '#fff', fontSize: 23, fontWeight: '900' },
  profileEmail: { color: 'rgba(255,255,255,0.76)', fontSize: 13, marginTop: 3 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 10,
  },
  statusEmoji: { fontSize: 14 },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -18,
  },
  quickAction: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTextWrap: { gap: 1 },
  quickTitle: { fontSize: 14, fontWeight: '800' },
  quickSubtitle: { fontSize: 11, fontWeight: '600' },
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 15, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '600' },
  summaryDivider: { width: StyleSheet.hairlineWidth },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8 },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 15, fontWeight: '800' },
  menuSubtitle: { fontSize: 12, lineHeight: 17 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 22 },
});
