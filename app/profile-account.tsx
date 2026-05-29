import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

export default function ProfileAccountScreen() {
  const { theme } = useTheme();
  const { userProfile, logout, deleteAccount } = useAuth();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

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

  const handleDeleteAccount = () => {
    const deleteNow = async () => {
      try {
        await deleteAccount();
        router.replace('/(auth)/splash' as any);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Could not delete account.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to permanently delete your account?')) deleteNow();
      return;
    }

    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: deleteNow },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <GradientAvatar name={userProfile?.displayName || 'User'} photoURL={userProfile?.photoURL} size={66} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{userProfile?.displayName || 'Your Name'}</Text>
            <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>{userProfile?.email || 'No email'}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} activeOpacity={0.75} style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
              <Ionicons name="create-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Edit profile</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Update name, bio, status and photo.</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.75} style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${theme.warning}18` }]}>
              <Ionicons name="log-out-outline" size={20} color={theme.warning} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Sign out</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>End this session on the device.</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.75} style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${theme.error}18` }]}>
              <Ionicons name="trash-outline" size={20} color={theme.error} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.error }]}>Delete account</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Permanently remove your account.</Text>
            </View>
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
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, padding: 16 },
  name: { fontSize: 18, fontWeight: '900' },
  email: { fontSize: 13, marginTop: 3 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 70 },
});
