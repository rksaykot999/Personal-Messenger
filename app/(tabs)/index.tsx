import ChatScreen from '@/app/chat/[id]';
import { ChatListItem } from '@/components/ui/ChatListItem';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { SearchBar } from '@/components/ui/SearchBar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { db } from '@/services/firebase';
import { dismissAllNotifications } from '@/services/notifications';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc, getDoc, getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

interface Chat {
  id: string;
  type?: 'direct' | 'group';
  groupName?: string;
  groupPhotoURL?: string | null;
  participants: string[];
  lastMessage: string;
  lastMessageTime: any;
  lastMessageSenderId: string;
  unreadCount: { [uid: string]: number };
  otherUser?: {
    uid: string;
    displayName: string;
    photoURL: string | null;
    isOnline: boolean;
    lastSeen: any;
  };
  mutedBy?: string[];
  archivedBy?: string[];
}

function formatChatTime(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function getGreeting(): string {
  const hours = new Date().getHours();
  if (hours < 12) return 'Good morning';
  if (hours < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ChatsScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [chats, setChats] = useState<Chat[]>([]);
  const [filtered, setFiltered] = useState<Chat[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Premium design states
  const [friends, setFriends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group' | 'archived'>('all');
  const [creating, setCreating] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  // Locally hidden chats — maps chatId → timestamp when it was removed
  const [removedChats, setRemovedChats] = useState<Map<string, number>>(new Map());
  const removedChatsRef = React.useRef<Map<string, number>>(new Map());

  // Clear notifications when opening the app
  useEffect(() => {
    dismissAllNotifications();
  }, []);

  // Fetch chats containing user.uid
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      try {
        let rawChats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Chat));
        rawChats = rawChats.filter(chat => !(chat as any).deletedFor?.includes(user.uid));



        // Sort in memory by lastMessageTime descending
        rawChats.sort((a, b) => {
          const t1 = a.lastMessageTime?.toDate ? a.lastMessageTime.toDate() : new Date(a.lastMessageTime || 0);
          const t2 = b.lastMessageTime?.toDate ? b.lastMessageTime.toDate() : new Date(b.lastMessageTime || 0);
          return t2.getTime() - t1.getTime();
        });

        const enriched = await Promise.all(
          rawChats.map(async (chat) => {
            if (chat.type === 'group') return chat;

            const otherUid = chat.participants.find((p) => p !== user.uid);
            if (!otherUid) return null;

            try {
              const otherUserDoc = await getDoc(doc(db, 'users', otherUid));
              if (otherUserDoc.exists()) {
                return { ...chat, otherUser: { uid: otherUid, ...otherUserDoc.data() } as any };
              }
            } catch (e) {
              console.error('Error fetching other user profile:', e);
            }
            return chat;
          })
        );

        setChats(enriched.filter((c) => c !== null) as Chat[]);
      } catch (err) {
        console.error("Error processing chats:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [user, userProfile?.friends]);

  // Listen to friends collection for "Active Now" Quick Contacts row
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snapshot) => {
      getDoc(doc(db, 'users', user.uid)).then((currentUserDoc) => {
        const friendsList = currentUserDoc.data()?.friends || [];
        if (friendsList.length === 0) {
          setFriends([]);
          return;
        }

        const list = snapshot.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u: any) => u.uid !== user.uid && friendsList.includes(u.uid));

        // Sort online first, then by name
        list.sort((a: any, b: any) => {
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          return (a.displayName || '').localeCompare(b.displayName || '');
        });

        setFriends(list);
      });
    });

    return () => unsub();
  }, [user, userProfile?.friends]);

  // Search & Tab filtering logic
  useEffect(() => {
    let result = chats;

    // Search query filtering
    if (search.trim()) {
      result = result.filter((c) =>
        (c.type === 'group' ? c.groupName : c.otherUser?.displayName)
          ?.toLowerCase()
          .includes(search.toLowerCase())
      );
    }

    // Tab filtering (incorporating Archived!)
    if (activeTab === 'archived') {
      // Show ONLY archived chats
      result = result.filter((c) => c.archivedBy?.includes(user?.uid || ''));
    } else {
      // Show chats NOT archived by this user
      result = result.filter((c) => !c.archivedBy?.includes(user?.uid || ''));

      if (activeTab === 'direct') {
        result = result.filter((c) => c.type !== 'group');
      } else if (activeTab === 'group') {
        result = result.filter((c) => c.type === 'group');
      }
    }

    setFiltered(result);
  }, [search, chats, activeTab, removedChats]);

  const handleMuteChat = useCallback(async (chatId: string) => {
    if (!user) return;
    try {
      const chatDocRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatDocRef);
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const mutedBy = data.mutedBy || [];
        const isCurrentlyMuted = mutedBy.includes(user.uid);

        await updateDoc(chatDocRef, {
          mutedBy: isCurrentlyMuted ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });
      }
    } catch (err) {
      console.error('Error toggling mute status:', err);
      Alert.alert('Error', 'Could not update mute setting.');
    }
  }, [user]);

  const handleMarkRead = useCallback(async (chatId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${user.uid}`]: 0
      });
    } catch (err) {
      console.error('Error marking chat as read:', err);
      Alert.alert('Error', 'Could not mark chat as read.');
    }
  }, [user]);

  const handleArchiveChat = useCallback(async (chatId: string) => {
    if (!user) return;
    try {
      const chatDocRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatDocRef);
      if (chatSnap.exists()) {
        const data = chatSnap.data();
        const archivedBy = data.archivedBy || [];
        const isCurrentlyArchived = archivedBy.includes(user.uid);

        await updateDoc(chatDocRef, {
          archivedBy: isCurrentlyArchived ? arrayRemove(user.uid) : arrayUnion(user.uid)
        });

        Alert.alert(
          isCurrentlyArchived ? 'Chat Unarchived' : 'Chat Archived',
          isCurrentlyArchived
            ? 'The conversation has been returned to your active chat list.'
            : 'The conversation has been moved to your Archived folder.'
        );
      }
    } catch (err) {
      console.error('Error toggling archive status:', err);
      Alert.alert('Error', 'Could not archive chat.');
    }
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleRemoveChat = useCallback((chatId: string) => {
    Alert.alert(
      'Remove Chat',
      'Are you sure you want to permanently remove this conversation from your chat list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await updateDoc(doc(db, 'chats', chatId), {
                deletedFor: arrayUnion(user.uid)
              });
            } catch (err) {
              console.error('Error removing chat:', err);
              Alert.alert('Error', 'Could not remove chat.');
            }
          },
        },
      ]
    );
  }, [user]);

  const handleQuickContactPress = async (targetUid: string, targetName: string) => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
      const snap = await getDocs(q);
      const existing = snap.docs.find((d) => {
        const data = d.data();
        return data.type !== 'group' && data.participants?.includes(targetUid);
      });

      if (existing) {
        const chatData = existing.data();
        if ((chatData as any).deletedFor?.includes(user.uid)) {
          await updateDoc(doc(db, 'chats', existing.id), {
            deletedFor: arrayRemove(user.uid)
          });
        }
        router.push(`/chat/${existing.id}` as any);
        return;
      }

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
      router.push(`/chat/${chatRef.id}` as any);
    } catch (error) {
      console.error('Error starting direct chat from quick contact:', error);
      Alert.alert('Error', 'Could not open chat.');
    } finally {
      setCreating(false);
    }
  };

  const renderQuickContacts = () => {
    if (friends.length === 0) return null;

    return (
      <View style={styles.quickContactsContainer}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Active Now</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickContactsScroll}
        >
          {friends.map((item) => (
            <TouchableOpacity
              key={item.uid}
              style={styles.quickContactItem}
              activeOpacity={0.8}
              onPress={() => handleQuickContactPress(item.uid, item.displayName)}
            >
              <View style={styles.quickAvatarWrap}>
                <GradientAvatar
                  name={item.displayName || '?'}
                  photoURL={item.photoURL}
                  size={52}
                  isOnline={item.isOnline}
                  showStatus
                />
              </View>
              <Text style={[styles.quickContactName, { color: theme.text }]} numberOfLines={1}>
                {(item.displayName || 'Friend').split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPillTabs = () => {
    const tabs = [
      { id: 'all', label: 'All', icon: 'chatbubbles-outline' },
      { id: 'direct', label: 'Direct', icon: 'person-outline' },
      { id: 'group', label: 'Groups', icon: 'people-outline' },
      { id: 'archived', label: 'Archived', icon: 'archive-outline' },
    ];

    return (
      <View style={styles.pillTabsContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              onPress={() => setActiveTab(tab.id as any)}
              style={[
                styles.pillTab,
                isActive
                  ? { backgroundColor: theme.primary }
                  : { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Ionicons
                name={tab.icon as any}
                size={13}
                color={isActive ? '#fff' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.pillTabText,
                  { color: isActive ? '#fff' : theme.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  // Sidebar/Chat List Panel (reusable across both layouts)
  const chatListPanel = (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Modern Professional Greeting Header & Search */}
      <View style={[styles.header, { paddingTop: statusBarH + 16, backgroundColor: theme.background }]}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
              <GradientAvatar
                name={userProfile?.displayName || user?.displayName || 'User'}
                photoURL={userProfile?.photoURL || user?.photoURL}
                size={44}
              />
            </TouchableOpacity>
            <View>
              <Text style={[styles.greetingText, { color: theme.textSecondary }]}>
                {getGreeting()} 👋
              </Text>
              <Text style={[styles.userNameText, { color: theme.text }]}>
                {userProfile?.displayName || user?.displayName || 'Messenger'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/new-chat' as any)} activeOpacity={0.8}>
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newChatBtn}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations..."
          style={{ marginTop: 12 }}
        />
      </View>

      {/* Dynamic Unified Chat list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {renderQuickContacts()}
            {renderPillTabs()}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: theme.textTertiary }]}>Loading chats...</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <LinearGradient
                colors={[theme.primary, theme.secondary]}
                style={styles.emptyIcon}
              >
                <Ionicons name="chatbubbles" size={36} color="#fff" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {activeTab === 'archived' ? 'No archived chats' : 'No conversations yet'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search ? 'No results found' : activeTab === 'archived' ? 'Archive a chat from the chat list by long-pressing it.' : 'Start a conversation with your contacts above!'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const otherUid = item.participants?.find((p) => p !== user?.uid);
          const isRead = !!(item.lastMessageSenderId === user?.uid && otherUid && item.unreadCount?.[otherUid] === 0);

          // Clean up Supabase raw URLs to premium image/video previews
          const displayLastMessage = item.lastMessage?.startsWith('http')
            ? (item.lastMessage.includes('.mp4') || item.lastMessage.includes('video') ? '🎥 Video' : '📷 Photo')
            : item.lastMessage || 'Start a conversation';

          const isMuted = !!(item.mutedBy?.includes(user?.uid || ''));
          const isArchived = !!(item.archivedBy?.includes(user?.uid || ''));

          const handleItemPress = () => {
            if (isWide) {
              setSelectedChatId(item.id);
            } else {
              router.push(`/chat/${item.id}` as any);
            }
          };

          return (
            <ChatListItem
              id={item.id}
              name={item.type === 'group' ? item.groupName || 'Group Chat' : item.otherUser?.displayName || 'Unknown'}
              lastMessage={displayLastMessage}
              time={formatChatTime(item.lastMessageTime)}
              unreadCount={item.unreadCount?.[user?.uid || ''] || 0}
              isOnline={item.type === 'group' ? false : item.otherUser?.isOnline || false}
              photoURL={item.type === 'group' ? item.groupPhotoURL : item.otherUser?.photoURL}
              isSent={item.lastMessageSenderId === user?.uid}
              isRead={isRead}
              isMuted={isMuted}
              isArchived={isArchived}
              onPress={handleItemPress}
              onRemove={handleRemoveChat}
              onMute={handleMuteChat}
              onMarkRead={handleMarkRead}
              onArchive={handleArchiveChat}
            />
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {isWide ? (
        /* === Wide/Desktop: Side-by-side split layout === */
        <View style={styles.splitContainer}>
          {/* Left Panel: Chat List */}
          <View style={[styles.splitLeft, { backgroundColor: theme.background, borderRightColor: theme.border }]}>
            {chatListPanel}
          </View>

          {/* Right Panel: Active Chat or Welcome Placeholder */}
          <View style={[styles.splitRight, { backgroundColor: theme.background }]}>
            {selectedChatId ? (
              <ChatScreen chatId={selectedChatId} />
            ) : (
              <View style={styles.placeholderWrap}>
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.placeholderIcon}
                >
                  <Ionicons name="chatbubble-ellipses" size={48} color="#fff" />
                </LinearGradient>
                <Text style={[styles.placeholderTitle, { color: theme.text }]}>
                  Select a conversation
                </Text>
                <Text style={[styles.placeholderSubtitle, { color: theme.textSecondary }]}>
                  Choose a chat from the left to start messaging
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* === Mobile: Single-column view === */
        chatListPanel
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  greetingText: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  userNameText: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  newChatBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickContactsContainer: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  quickContactsScroll: {
    gap: 16,
    paddingHorizontal: 20,
  },
  quickContactItem: {
    alignItems: 'center',
    width: 60,
  },
  quickAvatarWrap: {
    marginBottom: 6,
  },
  quickContactName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: 60,
  },
  pillTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  pillTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  // Responsive split layout styles
  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  splitLeft: {
    width: 380,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  splitRight: {
    flex: 1,
  },
  placeholderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 48,
  },
  placeholderIcon: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
});
