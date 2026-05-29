import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, RefreshControl, Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatListItem } from '@/components/ui/ChatListItem';
import { SearchBar } from '@/components/ui/SearchBar';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { dismissAllNotifications } from '@/services/notifications';

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
  const [chats, setChats] = useState<Chat[]>([]);
  const [filtered, setFiltered] = useState<Chat[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Premium design states
  const [friends, setFriends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'group'>('all');
  const [creating, setCreating] = useState(false);
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

    // Tab filtering
    if (activeTab === 'direct') {
      result = result.filter((c) => c.type !== 'group');
    } else if (activeTab === 'group') {
      result = result.filter((c) => c.type === 'group');
    }

    setFiltered(result);
  }, [search, chats, activeTab, removedChats]);

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
      { id: 'all', label: 'All Chats', icon: 'chatbubbles-outline' },
      { id: 'direct', label: 'Direct', icon: 'person-outline' },
      { id: 'group', label: 'Groups', icon: 'people-outline' },
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

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

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
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No conversations yet</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search ? 'No results found' : 'Start a conversation with your contacts above!'}
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
              onPress={() => router.push(`/chat/${item.id}` as any)}
              onRemove={handleRemoveChat}
            />
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
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
});
