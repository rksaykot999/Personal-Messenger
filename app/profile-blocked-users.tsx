import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

interface BlockedUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

export default function ProfileBlockedUsersScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const fetchBlockedUsers = async () => {
    if (!user) return;
    const blockedUids = userProfile?.blockedUsers || [];
    if (blockedUids.length === 0) {
      setBlockedList([]);
      setLoading(false);
      return;
    }

    try {
      const usersData: BlockedUser[] = [];
      for (const uid of blockedUids) {
        const uDoc = await getDoc(doc(db, 'users', uid));
        if (uDoc.exists()) {
          const data = uDoc.data();
          usersData.push({
            uid,
            displayName: data.displayName || 'User',
            email: data.email || 'No email',
            photoURL: data.photoURL || null,
          });
        }
      }
      setBlockedList(usersData);
    } catch (err) {
      console.error('Error fetching blocked users details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [userProfile?.blockedUsers]);

  const handleUnblock = async (targetUser: BlockedUser) => {
    if (!user) return;

    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${targetUser.displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                blockedUsers: arrayRemove(targetUser.uid),
              });
              Alert.alert('Success', `${targetUser.displayName} has been unblocked.`);
            } catch (err) {
              console.error('Error unblocking user:', err);
              Alert.alert('Error', 'Could not unblock user.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Blocked Users</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading blocked list...</Text>
        </View>
      ) : blockedList.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIconWrap, { backgroundColor: `${theme.primary}12` }]}>
            <Ionicons name="ban-outline" size={48} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Blocked Users</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Anyone you block will show up here. You can unblock them at any time.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedList}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <GradientAvatar
                name={item.displayName}
                photoURL={item.photoURL}
                size={42}
              />
              <View style={styles.infoWrap}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={[styles.email, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleUnblock(item)}
                style={[styles.unblockBtn, { backgroundColor: `${theme.primary}14` }]}
              >
                <Text style={[styles.unblockText, { color: theme.primary }]}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  infoWrap: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '800' },
  email: { fontSize: 12, opacity: 0.8 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  unblockText: { fontSize: 12, fontWeight: '800' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, textAlign: 'center' },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
