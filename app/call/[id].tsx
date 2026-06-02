/**
 * app/call/[id].tsx
 * ──────────────────────────────────────────────────────────────
 * WebRTC Voice ও Video Call এর পূর্ণাঙ্গ Screen।
 * 
 * URL params:
 *   id       → call document ID (Firestore)
 *   role     → 'caller' | 'receiver'
 *   type     → 'voice' | 'video'
 *   name     → অপর ব্যক্তির নাম
 *   photo    → অপর ব্যক্তির ছবির URL (optional)
 * ──────────────────────────────────────────────────────────────
 */

import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/firebase';
import {
  acceptIncomingWebRTCCall,
  endActiveWebRTCCall,
  flipCamera,
  getLocalStream,
  getRemoteStream,
  isWebRTCSupported,
  setCameraEnabled,
  setMicrophoneMuted,
  setOnStreamsUpdate,
  setSpeakerphoneOn,
  startOutgoingWebRTCCall,
} from '@/services/webrtcCalls';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

// react-native-webrtc শুধু native এ import করব
let RTCView: any = null;
if (Platform.OS !== 'web') {
  try {
    RTCView = eval('require')('react-native-webrtc').RTCView;
  } catch {
    RTCView = null;
  }
}

// ─── Web Video Component (Web Only) ──────────────────────────
const WebVideo = ({ stream, isLocal, mirror }: { stream: any, isLocal?: boolean, mirror?: boolean }) => {
  const videoRef = useRef<any>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  if (Platform.OS !== 'web') return null;
  return React.createElement('video', {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: isLocal,
    style: { width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : 'none' },
  });
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Call Duration Format করা ─────────────────────────────────
function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function CallScreen() {
  const { id, role, type, name, photo } = useLocalSearchParams<{
    id: string;
    role: 'caller' | 'receiver';
    type: 'voice' | 'video';
    name: string;
    photo?: string;
  }>();

  const { user } = useAuth();

  // ─── Call States ──────────────────────────────────────────
  const [callStatus, setCallStatus] = useState<
    'connecting' | 'ringing' | 'connected' | 'ended'
  >(role === 'caller' ? 'connecting' : 'ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(type === 'video'); // Auto-speaker for video
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Apply speakerphone routing
  useEffect(() => {
    setSpeakerphoneOn(isSpeakerOn);
  }, [isSpeakerOn]);

  // ─── Stream States ─────────────────────────────────────────
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  // ─── Refs & Animations ──────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusUnsubRef = useRef<(() => void) | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for ringing
  useEffect(() => {
    if (callStatus === 'ringing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [callStatus]);

  const isVideo = type === 'video';

  // ─── Firestore Call Status আপডেট ─────────────────────────
  const updateCallStatus = useCallback(
    async (status: string, extras: Record<string, any> = {}) => {
      if (!id) return;
      try {
        await updateDoc(doc(db, 'calls', id), {
          status,
          updatedAt: serverTimestamp(),
          ...extras,
        });
      } catch (err) {
        console.warn('[CallScreen] updateCallStatus error:', err);
      }
    },
    [id],
  );

  // ─── Call History Save করা ────────────────────────────────
  const saveCallHistory = useCallback(
    async (status: string) => {
      if (!user || !id) return;
      try {
        await addDoc(collection(db, 'users', user.uid, 'callHistory'), {
          callId: id,
          callerName: name,
          callType: role === 'caller' ? 'outgoing' : 'incoming',
          callStatus: status,
          mediaType: type,
          duration,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[CallScreen] saveCallHistory error:', err);
      }
    },
    [user, id, name, role, type, duration],
  );

  // ─── Call শেষ করা ────────────────────────────────────────
  const endCall = useCallback(
    async (reason: 'ended' | 'declined' | 'missed' = 'ended') => {
      // Cleanup
      endActiveWebRTCCall();
      setOnStreamsUpdate(null);
      statusUnsubRef.current?.();
      statusUnsubRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setCallStatus('ended');

      // Firestore আপডেট
      await updateCallStatus(reason, { endedAt: serverTimestamp() });
      await saveCallHistory(reason);

      // Vibration বন্ধ
      Vibration.cancel();

      // Screen বন্ধ
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)' as any);
        }
      }, 600);
    },
    [updateCallStatus, saveCallHistory],
  );

  // ─── WebRTC শুরু করা ─────────────────────────────────────
  useEffect(() => {
    if (!id || !type) return;

    let isCancelled = false;

    const initWebRTC = async () => {
      // Stream update callback register
      setOnStreamsUpdate((local, remote) => {
        if (isCancelled) return;
        setLocalStream(local);
        setRemoteStream(remote);
      });

      if (!isWebRTCSupported()) {
        Alert.alert(
          'WebRTC Not Supported',
          Platform.OS === 'web'
            ? 'Your browser does not support WebRTC.'
            : 'WebRTC requires a Development Build (Does not work in Expo Go).',
          [{ text: 'OK', onPress: () => endCall('ended') }],
        );
        return;
      }

      try {
        if (role === 'caller') {
          // Caller: Create offer
          const callRef = doc(db, 'calls', id);
          await startOutgoingWebRTCCall(callRef, type as 'voice' | 'video');
          if (!isCancelled) setCallStatus('ringing');
        }
        // For receiver, we wait for the user to press Accept
      } catch (err: any) {
        console.error('[CallScreen] WebRTC init error:', err);
        if (!isCancelled) {
          Alert.alert(
            'Call Error',
            err?.message || 'Failed to start the call.',
            [{ text: 'OK', onPress: () => endCall('ended') }],
          );
        }
      }
    };

    initWebRTC();

    // Firestore call status পর্যবেক্ষণ
    statusUnsubRef.current = onSnapshot(doc(db, 'calls', id), (snap) => {
      const data = snap.data();
      if (!data || isCancelled) return;

      if (data.status === 'accepted' && callStatus !== 'connected') {
        setCallStatus('connected');
      }

      if (
        data.status === 'ended' ||
        data.status === 'declined' ||
        data.status === 'missed'
      ) {
        if (!isCancelled) endCall(data.status as any);
      }
    });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type, role]);

  // ─── Accept Call ─────────────────────────────────────────
  const handleAcceptCall = async () => {
    try {
      setCallStatus('connecting');
      await acceptIncomingWebRTCCall(id, type as 'voice' | 'video');
      setCallStatus('connected');
      await updateCallStatus('accepted', { acceptedAt: serverTimestamp() });
    } catch (err: any) {
      console.error('[CallScreen] Accept error:', err);
      Alert.alert('Error', 'Failed to accept the call.', [{ text: 'OK' }]);
      endCall('ended');
    }
  };

  // ─── Timer শুরু করা (connected হলে) ──────────────────────
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Existing streams attach করা
      setLocalStream(getLocalStream());
      setRemoteStream(getRemoteStream());
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // ─── Ringing vibration ───────────────────────────────────
  useEffect(() => {
    if (callStatus === 'ringing') {
      Vibration.vibrate([500, 1000, 500, 1000], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [callStatus]);

  // ─── Mute Toggle ─────────────────────────────────────────
  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMicrophoneMuted(newMuted);
  };

  // ─── Camera Toggle ────────────────────────────────────────
  const handleCameraToggle = () => {
    const newState = !isCameraOn;
    setIsCameraOn(newState);
    setCameraEnabled(newState);
  };

  // ─── Camera Flip ─────────────────────────────────────────
  const handleFlipCamera = async () => {
    setIsFrontCamera((prev) => !prev);
    await flipCamera();
  };

  // ─── Status Text ─────────────────────────────────────────
  const statusText = () => {
    switch (callStatus) {
      case 'connecting': return 'Connecting...';
      case 'ringing': return role === 'caller' ? 'Ringing...' : 'Incoming call...';
      case 'connected': return formatDuration(duration);
      case 'ended': return 'Call ended';
    }
  };

  // ─── Video Streams ─────────────────────────────────────────
  const renderVideoStreams = () => {
    if (!isVideo) return null;

    if (Platform.OS === 'web') {
      return (
        <View style={StyleSheet.absoluteFill}>
          {remoteStream && (
            <WebVideo stream={remoteStream} />
          )}
          {localStream && isCameraOn && (
            <View style={styles.localVideoContainer}>
              <WebVideo stream={localStream} isLocal mirror={isFrontCamera} />
            </View>
          )}
        </View>
      );
    }

    if (!RTCView) return null;

    return (
      <View style={StyleSheet.absoluteFill}>
        {/* Remote video (full screen) */}
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={false}
          />
        )}

        {/* Local video (ছোট, কোণায়) */}
        {localStream && isCameraOn && (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={isFrontCamera}
              zOrder={1}
            />
          </View>
        )}
      </View>
    );
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background — video হলে stream, নয়তো gradient */}
      {isVideo ? (
        renderVideoStreams()
      ) : (
        <LinearGradient
          colors={['#0f0c29', '#302b63', '#24243e']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Dark overlay video এর উপরে (হালকা করা হলো) */}
      {isVideo && (
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.8)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.callTypeBadge}>
          <Ionicons
            name={isVideo ? 'videocam' : 'call'}
            size={14}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={styles.callTypeText}>
            {isVideo ? 'VIDEO CALL' : 'VOICE CALL'}
          </Text>
        </View>
      </View>

      {/* ─── Caller Info ─── */}
      <View style={styles.callerInfo}>
        {/* Video call এ connected হলে avatar লুকানো */}
        {(!isVideo || callStatus !== 'connected' || !remoteStream) && (
          <View style={styles.avatarContainer}>
            {callStatus === 'ringing' && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
            )}
            <View style={styles.avatarRing}>
              <GradientAvatar
                name={name || 'Friend'}
                photoURL={photo || null}
                size={120}
              />
            </View>
          </View>
        )}

        <Text style={styles.callerName} numberOfLines={1}>
          {name || 'Friend'}
        </Text>
        <Text
          style={[
            styles.callStatus,
            callStatus === 'connected' && styles.connectedStatus,
          ]}
        >
          {statusText()}
        </Text>
      </View>

      {/* ─── Control Buttons ─── */}
      <View style={styles.controls}>
        {role === 'receiver' && callStatus === 'ringing' ? (
          /* Incoming Call Actions */
          <View style={styles.incomingActionsRow}>
            <TouchableOpacity
              style={styles.incomingBtnWrap}
              onPress={() => endCall('declined')}
              activeOpacity={0.8}
            >
              <View style={[styles.actionBtn, { backgroundColor: '#FF3B30' }]}>
                <Ionicons name="close" size={34} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.incomingBtnWrap}
              onPress={handleAcceptCall}
              activeOpacity={0.8}
            >
              <View style={[styles.actionBtn, { backgroundColor: '#34C759' }]}>
                <Ionicons name="call" size={32} color="#fff" />
              </View>
              <Text style={styles.actionLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Ongoing/Outgoing Call Actions */
          <>
            <View style={styles.controlRow}>
              {/* Mute */}
              <TouchableOpacity
                style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                onPress={handleMuteToggle}
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={26}
                  color="#fff"
                />
                <Text style={styles.controlLabel}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              {/* Speaker / Camera toggle */}
              {isVideo ? (
                <TouchableOpacity
                  style={[styles.controlBtn, !isCameraOn && styles.controlBtnActive]}
                  onPress={handleCameraToggle}
                >
                  <Ionicons
                    name={isCameraOn ? 'videocam' : 'videocam-off'}
                    size={26}
                    color="#fff"
                  />
                  <Text style={styles.controlLabel}>
                    {isCameraOn ? 'Camera' : 'Camera Off'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
                  onPress={() => setIsSpeakerOn((p) => !p)}
                >
                  <Ionicons
                    name={isSpeakerOn ? 'volume-high' : 'volume-medium'}
                    size={26}
                    color="#fff"
                  />
                  <Text style={styles.controlLabel}>Speaker</Text>
                </TouchableOpacity>
              )}

              {/* Switch to Video / Flip Camera */}
              {!isVideo ? (
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => Alert.alert('Upgrade to Video', 'Switching to video call will be available in the next update.')}
                >
                  <Ionicons name="videocam" size={26} color="#fff" />
                  <Text style={styles.controlLabel}>Video</Text>
                </TouchableOpacity>
              ) : Platform.OS !== 'web' ? (
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={handleFlipCamera}
                >
                  <Ionicons name="camera-reverse" size={26} color="#fff" />
                  <Text style={styles.controlLabel}>Flip</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.controlBtn} />
              )}
            </View>

            {/* End Call */}
            <View style={styles.endCallRow}>
              <TouchableOpacity
                style={styles.endCallBtn}
                onPress={() => endCall('ended')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF1744', '#D50000']}
                  style={styles.endCallGradient}
                >
                  <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  callTypeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  callerInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(108, 99, 255, 0.45)',
  },
  avatarRing: {
    padding: 6,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 8,
  },
  callerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  callStatus: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
  connectedStatus: {
    color: '#4ADE80',
    fontWeight: '700',
    fontSize: 18,
  },
  // ─── Video Streams ───────────────────────────────────────
  localVideoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    width: SCREEN_W * 0.28,
    height: SCREEN_W * 0.28 * 1.5,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  localVideo: {
    flex: 1,
  },
  // ─── Controls ────────────────────────────────────────────
  controls: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 52 : 36,
    gap: 32,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#fff',
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  endCallRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  endCallBtn: {
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  endCallGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
  },
  incomingActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  incomingBtnWrap: {
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
