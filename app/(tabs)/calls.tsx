import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { db } from '@/services/firebase';
import { sendPushNotificationAsync } from '@/services/notifications';
import { endActiveWebRTCCall, isWebRTCSupported, startOutgoingWebRTCCall } from '@/services/webrtcCalls';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface CallTarget {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  pushToken?: string | null;
  isOnline?: boolean;
}

interface CallHistoryItem {
  id: string;
  receiverId?: string;
  name: string;
  photoURL?: string | null;
  pushToken?: string | null;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: string;
  time: string;
  missed: boolean;
}

export default function CallsScreen() {
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const [activeTab, setActiveTab] = useState<'All' | 'Missed' | 'Incoming' | 'Outgoing'>('All');
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);

  // Friend search modal states
  const [friendsModalVisible, setFriendsModalVisible] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Calling screen states
  const [callState, setCallState] = useState<'calling' | 'ringing' | 'connected' | null>(null);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [currentCallName, setCurrentCallName] = useState('');
  const [currentCallPhotoURL, setCurrentCallPhotoURL] = useState<string | null>(null);
  const [currentCallTarget, setCurrentCallTarget] = useState<CallTarget | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const callTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStatusUnsub = useRef<(() => void) | null>(null);
  const ringingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper function to format call duration
  const formatCallDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load friends when modal opens
  useEffect(() => {
    if (!user || !friendsModalVisible) return;
    setLoadingFriends(true);
    Promise.all([
      getDocs(collection(db, 'users')),
      getDoc(doc(db, 'users', user.uid))
    ]).then(([usersSnap, currentUserDoc]) => {
      const friendsList = currentUserDoc.data()?.friends || [];
      const list = usersSnap.docs
        .map((d) => d.data())
        .filter((u) => u.uid !== user.uid && friendsList.includes(u.uid));
      setFriends(list);
    }).catch((err) => {
      console.error("Error loading friends:", err);
    }).finally(() => {
      setLoadingFriends(false);
    });
  }, [user, friendsModalVisible]);

  // Load call history from Firestore
  useEffect(() => {
    if (!user) {
      setCallHistory([]);
      return;
    }

    const historyQuery = query(
      collection(db, 'users', user.uid, 'callHistory'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
      const history = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          receiverId: data.calleeId,
          name: data.calleeName,
          photoURL: data.calleePhotoURL,
          pushToken: data.pushToken,
          type: data.callType as 'incoming' | 'outgoing' | 'missed',
          duration: data.duration > 0 ? formatCallDuration(data.duration) : '',
          time: 'Just now',
          missed: data.callStatus === 'missed',
        };
      });
      setCallHistory(history);
    }, (error) => {
      console.warn('Error loading call history:', error);
    });

    return unsubscribe;
  }, [user]);

  // Call duration counter
  useEffect(() => {
    if (callState === 'connected') {
      callTimer.current = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimer.current) {
        clearInterval(callTimer.current);
        callTimer.current = null;
      }
      setCallSeconds(0);
    }
    return () => {
      if (callTimer.current) clearInterval(callTimer.current);
    };
  }, [callState]);

  useEffect(() => {
    return () => {
      callStatusUnsub.current?.();
      if (ringingTimer.current) clearTimeout(ringingTimer.current);
    };
  }, []);

  const startCall = async (target: CallTarget, type: 'voice' | 'video') => {
    if (!user || !target?.uid) {
      Alert.alert('Call unavailable', 'This call entry is missing a receiver account. Start a call from your friends list.');
      return;
    }
    if (!isWebRTCSupported()) {
      Alert.alert(
        'WebRTC not available',
        'Free STUN calls work on web browsers in this build. Native Expo requires react-native-webrtc with a development build.'
      );
      return;
    }

    callStatusUnsub.current?.();
    if (ringingTimer.current) clearTimeout(ringingTimer.current);

    setCurrentCallName(target.displayName || 'Friend');
    setCurrentCallPhotoURL(target.photoURL || null);
    setCurrentCallTarget(target);
    setCallType(type);
    setCallState('calling');
    setIsMuted(false);
    setIsSpeakerOn(false);
    setIsCameraOn(true);
    setFriendsModalVisible(false);

    try {
      const callRef = await addDoc(collection(db, 'calls'), {
        callerId: user.uid,
        callerName: userProfile?.displayName || user.displayName || 'Someone',
        callerPhotoURL: userProfile?.photoURL || user.photoURL || null,
        receiverId: target.uid,
        receiverName: target.displayName,
        receiverPhotoURL: target.photoURL || null,
        type,
        status: 'ringing',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setActiveCallId(callRef.id);
      await startOutgoingWebRTCCall(callRef, type);

      await sendPushNotificationAsync(
        target.pushToken,
        `${userProfile?.displayName || user.displayName || 'Someone'} is calling`,
        `Incoming ${type} call`,
        { type: 'incoming-call', callId: callRef.id }
      );

      callStatusUnsub.current = onSnapshot(callRef, (snap) => {
        const call = snap.data();
        if (!call) return;

        if (call.status === 'accepted') {
          setCallState('connected');
        }

        if (call.status === 'declined' || call.status === 'ended' || call.status === 'missed') {
          if (call.status === 'declined') {
            Alert.alert('Call declined', `${target.displayName || 'Friend'} declined the call.`);
          }
          finishLocalCall(call.status === 'declined');
        }
      });
    } catch (error: any) {
      finishLocalCall(true);
      Alert.alert('Call failed', error?.message || 'Could not start the call.');
      return;
    }

    ringingTimer.current = setTimeout(() => {
      setCallState('ringing');
    }, 1500);
  };

  const finishLocalCall = async (missed: boolean) => {
    endActiveWebRTCCall();
    if (callState === 'connected' || callState === 'ringing' || callState === 'calling') {
      const durationStr = callSeconds > 0 ? formatCallDuration(callSeconds) : '';
      const newLog = {
        id: Date.now().toString(),
        receiverId: currentCallTarget?.uid,
        name: currentCallName,
        photoURL: currentCallPhotoURL,
        pushToken: currentCallTarget?.pushToken,
        type: missed ? 'missed' as const : 'outgoing' as const,
        duration: durationStr,
        time: 'Just now',
        missed,
      };
      setCallHistory((prev) => [newLog, ...prev]);

      // Save to Firestore
      if (user && activeCallId) {
        try {
          await addDoc(collection(db, 'users', user.uid, 'callHistory'), {
            callId: activeCallId,
            calleeId: currentCallTarget?.uid,
            calleeName: currentCallName,
            calleePhotoURL: currentCallPhotoURL,
            callType: 'outgoing',
            callStatus: missed ? 'missed' : 'completed',
            duration: callSeconds,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          console.warn('Could not save call history to Firestore:', error);
        }
      }
    }

    callStatusUnsub.current?.();
    callStatusUnsub.current = null;
    if (ringingTimer.current) clearTimeout(ringingTimer.current);
    ringingTimer.current = null;
    setCallState(null);
    setCallType(null);
    setActiveCallId(null);
    setCurrentCallTarget(null);
  };

  const endCall = async () => {
    endActiveWebRTCCall();
    callStatusUnsub.current?.();
    callStatusUnsub.current = null;

    if (activeCallId) {
      try {
        await updateDoc(doc(db, 'calls', activeCallId), {
          status: 'ended',
          endedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('Could not update call status:', error);
      }
    }

    finishLocalCall(callSeconds === 0 && callState !== 'connected');
  };

  const getCallIcon = (type: string, missed: boolean) => {
    if (missed) return { name: 'call' as const, color: theme.error };
    if (type === 'incoming') return { name: 'call-outline' as const, color: theme.success };
    return { name: 'call-outline' as const, color: theme.primary };
  };

  const getArrowIcon = (type: string) => {
    if (type === 'incoming') return 'arrow-down-outline';
    if (type === 'outgoing') return 'arrow-up-outline';
    return 'call-outline';
  };

  // Filter lists based on active filters
  const filteredCalls = callHistory.filter((item) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Missed') return item.missed;
    if (activeTab === 'Incoming') return item.type === 'incoming' && !item.missed;
    if (activeTab === 'Outgoing') return item.type === 'outgoing' && !item.missed;
    return true;
  });

  const filteredFriends = friends.filter((f) =>
    f.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarH + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Calls</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {callHistory.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Clear History',
                  'Are you sure you want to clear your entire call history?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear All', style: 'destructive', onPress: async () => {
                      if (!user) return;
                      try {
                        const deletePromises = callHistory.map(item => 
                          deleteDoc(doc(db, 'users', user.uid, 'callHistory', item.id))
                        );
                        await Promise.all(deletePromises);
                      } catch (err) {
                        console.warn('Error clearing history:', err);
                        Alert.alert('Error', 'Could not clear history.');
                      }
                    } }
                  ]
                );
              }}
              style={[styles.newCallBtn, { backgroundColor: 'rgba(255, 23, 68, 0.15)' }]}
            >
              <Ionicons name="trash-outline" size={20} color="#FF1744" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setFriendsModalVisible(true)}
            style={[styles.newCallBtn, { backgroundColor: theme.surfaceElevated }]}
          >
            <Ionicons name="call-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs Filter */}
      <View style={[styles.tabsRow, { backgroundColor: theme.surfaceElevated }]}>
        {(['All', 'Missed', 'Incoming', 'Outgoing'] as const).map((label) => (
          <TouchableOpacity
            key={label}
            onPress={() => setActiveTab(label)}
            style={[styles.tab, activeTab === label && { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.tabText, { color: activeTab === label ? '#fff' : theme.textSecondary }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Call History Feed */}
      <FlatList
        data={filteredCalls}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const icon = getCallIcon(item.type, item.missed);
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (!item.receiverId) {
                  Alert.alert('Call unavailable', 'Start a real call from the New Call button so the app can find the receiver phone.');
                  return;
                }

                startCall({
                  uid: item.receiverId,
                  displayName: item.name,
                  photoURL: item.photoURL,
                  pushToken: item.pushToken,
                }, 'voice');
              }}
              style={[styles.callItem, { borderBottomColor: theme.border }]}
            >
              <GradientAvatar name={item.name} photoURL={item.photoURL} size={50} />
              <View style={styles.callInfo}>
                <Text style={[styles.callName, { color: item.missed ? theme.error : theme.text }]}>
                  {item.name || 'Unknown'}
                </Text>
                <View style={styles.callMeta}>
                  <Ionicons
                    name={getArrowIcon(item.type) as any}
                    size={12}
                    color={item.missed ? theme.error : theme.textTertiary}
                  />
                  <Text style={[styles.callSub, { color: item.missed ? theme.error : theme.textSecondary }]}>
                    {item.missed ? 'Missed' : item.type === 'incoming' ? 'Incoming' : 'Outgoing'}
                    {item.duration ? ` · ${item.duration}` : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.callRight}>
                <Text style={[styles.callTime, { color: theme.textTertiary }]}>{item.time}</Text>
                <TouchableOpacity
                  style={[styles.callBackBtn, { backgroundColor: `${theme.primary}18` }]}
                  onPress={() => {
                    if (!item.receiverId) {
                      Alert.alert('Call unavailable', 'Start a real call from the New Call button so the app can find the receiver phone.');
                      return;
                    }

                    startCall({
                      uid: item.receiverId,
                      displayName: item.name,
                      photoURL: item.photoURL,
                      pushToken: item.pushToken,
                    }, 'voice');
                  }}
                >
                  <Ionicons name="call" size={16} color={theme.primary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="call-outline" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary, marginTop: 12 }]}>
              No call history found
            </Text>
          </View>
        }
        ListHeaderComponent={
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Recent</Text>
        }
      />

      {/* Friends List Modal to Place Call */}
      <Modal
        visible={friendsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFriendsModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFriendsModalVisible(false)}>
          <View style={[styles.friendsSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.friendsHeader}>
              <Text style={[styles.friendsTitle, { color: theme.text }]}>New Call</Text>
              <TouchableOpacity onPress={() => setFriendsModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchContainer, { backgroundColor: theme.inputBg }]}>
              <Ionicons name="search-outline" size={18} color={theme.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search friends..."
                placeholderTextColor={theme.textTertiary}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>

            {loadingFriends ? (
              <View style={styles.loadingWrap}>
                <Text style={{ color: theme.textSecondary }}>Loading friends list...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredFriends}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={[styles.friendRow, { borderBottomColor: theme.border }]}>
                    <GradientAvatar name={item.displayName} photoURL={item.photoURL} size={44} isOnline={item.isOnline} showStatus />
                    <View style={styles.friendInfo}>
                      <Text style={[styles.friendName, { color: theme.text }]}>{item.displayName}</Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                        {item.isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    <View style={styles.friendActions}>
                      <TouchableOpacity
                        onPress={() => startCall(item as CallTarget, 'voice')}
                        style={[styles.dialBtn, { backgroundColor: `${theme.primary}18` }]}
                      >
                        <Ionicons name="call" size={16} color={theme.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => startCall(item as CallTarget, 'video')}
                        style={[styles.dialBtn, { backgroundColor: `${theme.secondary}18` }]}
                      >
                        <Ionicons name="videocam" size={16} color={theme.secondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyFriendsWrap}>
                    <Text style={{ color: theme.textSecondary }}>No friends found</Text>
                  </View>
                }
              />
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Simulated Call Screen Modal */}
      {callState && (
        <Modal
          visible={true}
          animationType="fade"
          transparent={false}
          onRequestClose={endCall}
        >
          <LinearGradient
            colors={[theme.background, '#121212']}
            style={styles.callContainer}
          >
            {/* Top Call Info */}
            <View style={styles.callHeader}>
              <Ionicons
                name={callType === 'video' ? 'videocam' : 'call'}
                size={20}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.callTypeText}>
                {callType === 'video' ? 'VIDEO CALL' : 'VOICE CALL'}
              </Text>
            </View>

            {/* Video preview simulation */}
            {callType === 'video' && callState === 'connected' && isCameraOn && (
              <LinearGradient
                colors={[theme.primary, theme.secondary]}
                style={StyleSheet.absoluteFillObject}
              >
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="person" size={100} color="rgba(255,255,255,0.3)" />
                  <Text style={styles.videoPlaceholderText}>Simulated Camera Preview</Text>
                </View>
              </LinearGradient>
            )}

            {/* Profile Avatar & Ringing Status */}
            <View style={styles.callProfileWrap}>
              <View style={styles.callAvatarOutline}>
                <GradientAvatar
                  name={currentCallName || 'Friend'}
                  photoURL={currentCallPhotoURL}
                  size={120}
                />
              </View>
              <Text style={styles.callOverlayName}>{currentCallName || 'Friend'}</Text>

              <Text style={styles.callStatusText}>
                {callState === 'calling' && 'Calling...'}
                {callState === 'ringing' && 'Ringing...'}
                {callState === 'connected' && formatCallDuration(callSeconds)}
              </Text>
            </View>

            {/* Calling control toggles */}
            <View style={styles.callControls}>
              <TouchableOpacity
                onPress={() => setIsMuted(!isMuted)}
                style={[
                  styles.callBtn,
                  isMuted && styles.callBtnActive,
                ]}
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {callType === 'video' ? (
                <TouchableOpacity
                  onPress={() => setIsCameraOn(!isCameraOn)}
                  style={[
                    styles.callBtn,
                    !isCameraOn && styles.callBtnActive,
                  ]}
                >
                  <Ionicons
                    name={isCameraOn ? 'videocam' : 'videocam-off'}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                  style={[
                    styles.callBtn,
                    isSpeakerOn && styles.callBtnActive,
                  ]}
                >
                  <Ionicons
                    name="volume-high"
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={endCall}
                style={[styles.callBtn, styles.callBtnEnd]}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  newCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabText: { fontSize: 12, fontWeight: '600' },
  sectionLabel: { fontSize: 13, marginLeft: 20, marginBottom: 8, fontWeight: '700' },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  callInfo: { flex: 1 },
  callName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  callMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callSub: { fontSize: 13 },
  callRight: { alignItems: 'flex-end', gap: 8 },
  callTime: { fontSize: 12 },
  callBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  // Modal Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  friendsSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    height: '75%',
  },
  friendsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  friendsTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFriendsWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
  },
  dialBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Call Overlay Screen Styles
  callContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.8,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  callProfileWrap: {
    alignItems: 'center',
    gap: 16,
  },
  callAvatarOutline: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 70,
    padding: 8,
  },
  callOverlayName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  callStatusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
  },
  callControls: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  callBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  callBtnEnd: {
    backgroundColor: '#FF1744',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoPlaceholderText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 14,
    opacity: 0.7,
  },
});
