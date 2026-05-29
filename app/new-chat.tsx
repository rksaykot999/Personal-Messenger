import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Platform, Alert, TextInput,
} from 'react-native';
import {
  collection, query, where, getDocs, doc, setDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SearchBar } from '@/components/ui/SearchBar';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

interface SearchUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isOnline: boolean;
  statusEmoji: string;
  status: string;
}

type ChatMode = 'direct' | 'group';

export default function NewChatScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; userName?: string }>();
  const [mode, setMode] = useState<ChatMode>('direct');
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [filtered, setFiltered] = useState<SearchUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [creating, setCreating] = useState(false);
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDocs(collection(db, 'users')),
      getDoc(doc(db, 'users', user.uid))
    ]).then(([usersSnap, currentUserDoc]) => {
      const friendsList = currentUserDoc.data()?.friends || [];
      const list = usersSnap.docs
        .map((d) => d.data() as SearchUser)
        .filter((u) => u.uid !== user.uid && friendsList.includes(u.uid));
      setUsers(list);
      setFiltered(list);
    });
  }, [user]);

  useEffect(() => {
    if (params.userId && user && !creating) {
      startOrOpenChat(params.userId, params.userName || '');
    }
  }, [params.userId, user]);

  useEffect(() => {
    if (!search.trim()) setFiltered(users);
    else setFiltered(users.filter((u) =>
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    ));
  }, [search, users]);

  const startOrOpenChat = async (targetUid: string, targetName: string) => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const snap = await getDocs(q);
      const existing = snap.docs.find((d) => {
        const data = d.data();
        return data.type !== 'group' && data.participants?.includes(targetUid);
      });
      if (existing) { router.replace(`/chat/${existing.id}` as any); return; }

      const chatRef = doc(collection(db, 'chats'));
      const participants = [user.uid, targetUid].sort();
      await setDoc(chatRef, {
        type: 'direct',
        participants,
        participantNames: {
          [user.uid]: userProfile?.displayName || user.displayName || 'You',
          [targetUid]: targetName || 'Friend',
        },
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: '',
        unreadCount: { [user.uid]: 0, [targetUid]: 0 },
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      router.replace(`/chat/${chatRef.id}` as any);
    } catch { Alert.alert('Error', 'Could not start chat.'); }
    finally { setCreating(false); }
  };

  const toggleSelectedUser = (target: SearchUser) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.uid === target.uid)
        ? prev.filter((u) => u.uid !== target.uid)
        : [...prev, target]
    );
  };

  const createGroupChat = async () => {
    if (!user || creating) return;
    if (selectedUsers.length < 2) {
      Alert.alert('Select people', 'Choose at least two friends to create a group.');
      return;
    }

    const cleanGroupName = groupName.trim() || selectedUsers.map((u) => u.displayName).join(', ');
    setCreating(true);
    try {
      const chatRef = doc(collection(db, 'chats'));
      const participants = [user.uid, ...selectedUsers.map((u) => u.uid)].sort();
      const unreadCount = participants.reduce((acc, uid) => ({ ...acc, [uid]: 0 }), {});
      const participantNames = {
        [user.uid]: userProfile?.displayName || user.displayName || 'You',
        ...selectedUsers.reduce((acc, item) => ({ ...acc, [item.uid]: item.displayName }), {}),
      };

      await setDoc(chatRef, {
        type: 'group',
        groupName: cleanGroupName,
        groupPhotoURL: null,
        participants,
        participantNames,
        admins: [user.uid],
        createdBy: user.uid,
        lastMessage: 'Group created',
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        unreadCount,
        createdAt: serverTimestamp(),
      });

      router.replace(`/chat/${chatRef.id}` as any);
    } catch (error) {
      console.error('Create group error:', error);
      Alert.alert('Error', 'Could not create group chat.');
    } finally {
      setCreating(false);
    }
  };

  const switchMode = (nextMode: ChatMode) => {
    setMode(nextMode);
    setSelectedUsers([]);
    setSearch('');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>{mode === 'group' ? 'New Group' : 'New Chat'}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.contentTop}>
        <View style={[styles.modeSwitch, { backgroundColor: theme.surfaceElevated }]}>
          {(['direct', 'group'] as ChatMode[]).map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => switchMode(item)}
              style={[styles.modeOption, mode === item && { backgroundColor: theme.primary }]}
            >
              <Ionicons
                name={item === 'direct' ? 'person-outline' : 'people-outline'}
                size={16}
                color={mode === item ? '#fff' : theme.textSecondary}
              />
              <Text style={[styles.modeText, { color: mode === item ? '#fff' : theme.textSecondary }]}>
                {item === 'direct' ? '1:1 Chat' : 'Group'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'group' && (
          <View style={[styles.groupNameWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={18} color={theme.textTertiary} />
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name"
              placeholderTextColor={theme.textTertiary}
              style={[styles.groupNameInput, { color: theme.text }]}
            />
          </View>
        )}

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search people..." />

        {mode === 'group' && selectedUsers.length > 0 && (
          <View style={styles.selectedRow}>
            <Text style={[styles.selectedText, { color: theme.textSecondary }]}>
              {selectedUsers.length} selected
            </Text>
            <TouchableOpacity
              onPress={createGroupChat}
              disabled={creating}
              style={[styles.createBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create Group'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const selected = selectedUsers.some((u) => u.uid === item.uid);
          return (
            <TouchableOpacity
              onPress={() => mode === 'group' ? toggleSelectedUser(item) : startOrOpenChat(item.uid, item.displayName)}
              activeOpacity={0.8}
              style={[styles.userCard, { borderBottomColor: theme.border }]}
            >
              <GradientAvatar name={item.displayName} photoURL={item.photoURL} size={50} isOnline={item.isOnline} showStatus />
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.text }]}>{item.displayName}</Text>
                <Text style={[styles.userSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.statusEmoji} {item.status || item.email}
                </Text>
              </View>
              {mode === 'group' ? (
                <View style={[styles.selectCircle, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : 'transparent' }]}>
                  {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
              ) : (
                <Ionicons name="chatbubble-outline" size={18} color={theme.primary} />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {creating ? 'Opening chat...' : 'No users found'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  contentTop: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  modeSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeText: { fontSize: 13, fontWeight: '700' },
  groupNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupNameInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedText: { fontSize: 13, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  userCard: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
  userSub: { fontSize: 13 },
  selectCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 14 },
});
