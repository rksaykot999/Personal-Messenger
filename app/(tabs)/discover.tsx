import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Platform, SectionList, Alert, Modal, Pressable
} from 'react-native';
import {
  collection, query, where, getDocs, onSnapshot, doc, setDoc,
  updateDoc, arrayUnion, deleteDoc, addDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { db } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SearchBar } from '@/components/ui/SearchBar';
import { GradientAvatar } from '@/components/ui/GradientAvatar';

interface DiscoverUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isOnline: boolean;
  bio: string;
  statusEmoji: string;
  status: string;
}

interface FriendRequest {
  id: string;
  from: string;
  fromName: string;
  fromPhotoURL?: string | null;
  to: string;
  status: 'pending' | 'accepted' | 'declined';
}

// Helper: Ensure a direct chat exists between two users, create one if not
async function ensureDirectChat(
  myUid: string,
  myName: string,
  otherUid: string,
  otherName: string,
  welcomeMsg: string = 'You are now friends! Say hi 👋'
) {
  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('participants', 'array-contains', myUid));
  const existingChats = await getDocs(q);
  const hasChat = existingChats.docs.some(
    (d) => d.data().type !== 'group' && d.data().participants?.includes(otherUid)
  );

  if (!hasChat) {
    const participants = [myUid, otherUid].sort();
    await addDoc(chatsRef, {
      type: 'direct',
      participants,
      participantNames: {
        [myUid]: myName || 'User',
        [otherUid]: otherName || 'Friend',
      },
      lastMessage: welcomeMsg,
      lastMessageTime: serverTimestamp(),
      lastMessageSenderId: 'system',
      unreadCount: {
        [myUid]: 0,
        [otherUid]: 1,
      },
      createdAt: serverTimestamp(),
    });
  }
}

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<DiscoverUser | null>(null);

  useEffect(() => {
    if (!user) return;

    // 1. Listen for all users (excluding self)
    const usersUnsub = onSnapshot(
      query(collection(db, 'users'), where('uid', '!=', user.uid)),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as DiscoverUser));
        setLoading(false);
      },
      (err) => {
        console.error('Discover users error:', err);
        setLoading(false);
      }
    );

    // 2. Incoming pending requests
    const incomingUnsub = onSnapshot(
      query(
        collection(db, 'friend_requests'),
        where('to', '==', user.uid),
        where('status', '==', 'pending')
      ),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)));
      },
      (err) => console.error('Incoming requests error:', err)
    );

    // 3. Sent pending requests
    const sentUnsub = onSnapshot(
      query(
        collection(db, 'friend_requests'),
        where('from', '==', user.uid),
        where('status', '==', 'pending')
      ),
      (snap) => {
        setSentRequests(snap.docs.map((d) => d.data().to));
      },
      (err) => console.error('Sent requests error:', err)
    );

    // 4. Friends (accepted requests — two queries to bypass OR limitation)
    let friendsSent: string[] = [];
    let friendsRecv: string[] = [];

    const updateFriendsState = () => {
      setFriends(Array.from(new Set([...friendsSent, ...friendsRecv])));
    };

    const friendsSentUnsub = onSnapshot(
      query(collection(db, 'friend_requests'), where('status', '==', 'accepted'), where('from', '==', user.uid)),
      (snap) => { friendsSent = snap.docs.map((d) => d.data().to); updateFriendsState(); },
      (err) => console.error('Friends sent list error:', err)
    );

    const friendsRecvUnsub = onSnapshot(
      query(collection(db, 'friend_requests'), where('status', '==', 'accepted'), where('to', '==', user.uid)),
      (snap) => { friendsRecv = snap.docs.map((d) => d.data().from); updateFriendsState(); },
      (err) => console.error('Friends received list error:', err)
    );

    return () => {
      usersUnsub();
      incomingUnsub();
      sentUnsub();
      friendsSentUnsub();
      friendsRecvUnsub();
    };
  }, [user]);

  const setProcessing = (id: string, value: boolean) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      value ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const sendRequest = async (targetUser: DiscoverUser) => {
    if (!user) return;
    setProcessing(targetUser.uid, true);
    try {
      await addDoc(collection(db, 'friend_requests'), {
        from: user.uid,
        fromName: userProfile?.displayName || user.displayName || 'Someone',
        fromPhotoURL: userProfile?.photoURL || user.photoURL || null,
        to: targetUser.uid,
        toName: targetUser.displayName || 'Friend',
        status: 'pending',
        participants: [user.uid, targetUser.uid],
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending request:', error);
      Alert.alert('Error', 'Could not send friend request.');
    } finally {
      setProcessing(targetUser.uid, false);
    }
  };

  const acceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    setProcessing(request.id, true);
    try {
      // 1. Mark request as accepted
      await updateDoc(doc(db, 'friend_requests', request.id), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      // 2. Add to both users' friends arrays
      await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(request.from) });
      await updateDoc(doc(db, 'users', request.from), { friends: arrayUnion(user.uid) });

      // 3. Auto-create chat → appears immediately in chat list ✅
      const myName = userProfile?.displayName || user.displayName || 'User';
      await ensureDirectChat(user.uid, myName, request.from, request.fromName, 'Friend request accepted! Say hi 👋');

    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Could not accept friend request.');
    } finally {
      setProcessing(request.id, false);
    }
  };

  const declineRequest = async (request: FriendRequest) => {
    setProcessing(request.id, true);
    try {
      await deleteDoc(doc(db, 'friend_requests', request.id));
    } catch (error) {
      console.error('Error declining request:', error);
    } finally {
      setProcessing(request.id, false);
    }
  };

  // For "Suggested" users: directly add as friend (skip request, create chat immediately) ✅
  const addFriendDirectly = async (targetUser: DiscoverUser) => {
    if (!user) return;
    setProcessing(targetUser.uid, true);
    try {
      // Create accepted friend_request doc immediately
      await addDoc(collection(db, 'friend_requests'), {
        from: user.uid,
        fromName: userProfile?.displayName || user.displayName || 'Someone',
        fromPhotoURL: userProfile?.photoURL || user.photoURL || null,
        to: targetUser.uid,
        toName: targetUser.displayName || 'Friend',
        status: 'accepted',
        participants: [user.uid, targetUser.uid],
        createdAt: serverTimestamp(),
        acceptedAt: serverTimestamp(),
      });

      // Mutual friends update
      await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(targetUser.uid) });
      await updateDoc(doc(db, 'users', targetUser.uid), { friends: arrayUnion(user.uid) });

      // Auto-create chat → appears immediately in chat list ✅
      const myName = userProfile?.displayName || user.displayName || 'User';
      await ensureDirectChat(
        user.uid,
        myName,
        targetUser.uid,
        targetUser.displayName,
        `${myName} added you as a friend! 🎉`
      );

    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Could not add friend.');
    } finally {
      setProcessing(targetUser.uid, false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      !friends.includes(u.uid) &&
      !requests.some((r) => r.from === u.uid) &&
      (u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={[styles.header, { paddingTop: statusBarH + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Discover People</Text>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
          style={{ marginTop: 16 }}
        />
      </View>

      <SectionList
        sections={[
          {
            title: 'Friend Requests',
            data: requests as any[],
            renderItem: ({ item }: { item: FriendRequest }) => {
              const isProcessing = processingIds.has(item.id);
              return (
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <GradientAvatar name={item.fromName} photoURL={item.fromPhotoURL} size={48} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: theme.text }]}>{item.fromName}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Sent you a friend request</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      disabled={isProcessing}
                      onPress={() => acceptRequest(item)}
                      style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                    >
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={isProcessing}
                      onPress={() => declineRequest(item)}
                      style={[styles.actionBtn, { backgroundColor: theme.surfaceElevated }]}
                    >
                      <Ionicons name="close" size={18} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            },
          },
          {
            title: 'Suggested for you',
            data: filteredUsers as any[],
            renderItem: ({ item }: { item: DiscoverUser }) => {
              const isSent = sentRequests.includes(item.uid);
              const isProcessing = processingIds.has(item.uid);

              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedUser(item)}
                >
                  <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <GradientAvatar
                    name={item.displayName}
                    photoURL={item.photoURL}
                    size={48}
                    isOnline={item.isOnline}
                    showStatus
                  />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: theme.text }]}>{item.displayName}</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.status || item.email}
                    </Text>
                  </View>

                  {isSent ? (
                    // Already sent request — show "Sent" label
                    <View style={[styles.sentBadge, { backgroundColor: theme.surfaceElevated }]}>
                      <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
                      <Text style={[styles.sentText, { color: theme.textTertiary }]}>Sent</Text>
                    </View>
                  ) : (
                    // Add Friend button — sends a request ✅
                    <TouchableOpacity
                      disabled={isProcessing}
                      onPress={() => sendRequest(item)}
                      activeOpacity={0.85}
                      style={styles.addBtnWrap}
                    >
                      <LinearGradient
                        colors={[theme.primary, theme.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.addBtn}
                      >
                        <Ionicons name="person-add-outline" size={14} color="#fff" />
                        <Text style={styles.addBtnText}>
                          {isProcessing ? 'Adding...' : 'Add Friend'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                  </View>
                </TouchableOpacity>
              );
            },
          },
        ].filter((s) => s.data.length > 0) as any}
        keyExtractor={(item, index) => (item as any).uid || (item as any).id || index.toString()}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{title}</Text>
        )}
        SectionSeparatorComponent={() => <View style={{ height: 16 }} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <LinearGradient
                colors={[`${theme.primary}40`, `${theme.secondary}40`]}
                style={styles.emptyIconWrap}
              >
                <Ionicons name="people-outline" size={40} color={theme.primary} />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No suggestions</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Check back later for new people to connect with!
              </Text>
            </View>
          ) : null
        }
      />

      {/* User Details Modal */}
      <Modal
        visible={!!selectedUser}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUser(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedUser(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {selectedUser && (
              <>
                <View style={styles.modalHeader}>
                  <GradientAvatar
                    name={selectedUser.displayName}
                    photoURL={selectedUser.photoURL}
                    size={80}
                    isOnline={selectedUser.isOnline}
                    showStatus
                  />
                  <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalBody}>
                  <Text style={[styles.modalName, { color: theme.text }]}>
                    {selectedUser.displayName}
                  </Text>
                  <Text style={[styles.modalEmail, { color: theme.textSecondary }]}>
                    {selectedUser.email}
                  </Text>

                  {(selectedUser.status || selectedUser.statusEmoji) && (
                    <View style={[styles.modalStatusWrap, { backgroundColor: theme.surfaceElevated }]}>
                      {selectedUser.statusEmoji && <Text style={styles.modalStatusEmoji}>{selectedUser.statusEmoji}</Text>}
                      <Text style={[styles.modalStatusText, { color: theme.text }]}>
                        {selectedUser.status || 'No status'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalBioWrap}>
                    <Text style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>About</Text>
                    {selectedUser.bio ? (
                      <Text style={[styles.modalBioText, { color: theme.text }]}>{selectedUser.bio}</Text>
                    ) : (
                      <Text style={[styles.modalBioText, { color: theme.textTertiary, fontStyle: 'italic' }]}>No bio provided.</Text>
                    )}
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  {sentRequests.includes(selectedUser.uid) ? (
                    <View style={[styles.modalSentBtn, { backgroundColor: theme.surfaceElevated }]}>
                      <Ionicons name="time-outline" size={20} color={theme.textTertiary} />
                      <Text style={[styles.modalSentText, { color: theme.textTertiary }]}>Request Sent</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      disabled={processingIds.has(selectedUser.uid)}
                      onPress={() => {
                        sendRequest(selectedUser);
                        setSelectedUser(null);
                      }}
                      activeOpacity={0.8}
                      style={{ width: '100%' }}
                    >
                      <LinearGradient
                        colors={[theme.primary, theme.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.modalAddBtn}
                      >
                        <Ionicons name="person-add-outline" size={20} color="#fff" />
                        <Text style={styles.modalAddBtnText}>Send Friend Request</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    marginBottom: 32,
  },
  modalName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalEmail: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 20,
    gap: 8,
  },
  modalStatusEmoji: {
    fontSize: 18,
  },
  modalStatusText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  modalBioWrap: {
    marginTop: 8,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalBioText: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalFooter: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  modalAddBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalSentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  modalSentText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
