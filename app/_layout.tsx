import React, { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Animated, Modal, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import 'react-native-reanimated';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { db } from '@/services/firebase';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { acceptIncomingWebRTCCall, endActiveWebRTCCall, isWebRTCSupported } from '@/services/webrtcCalls';

interface IncomingCall {
  id: string;
  callerId: string;
  callerName: string;
  callerPhotoURL?: string | null;
  receiverId: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';
}

function IncomingCallListener() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [incomingCall, setIncomingCall] = React.useState<IncomingCall | null>(null);
  const [connectedCall, setConnectedCall] = React.useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!user) {
      setIncomingCall(null);
      setConnectedCall(null);
      return;
    }

    const callsQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      if (snapshot.empty) {
        setIncomingCall(null);
        return;
      }

      const callDoc = snapshot.docs[0];
      setIncomingCall({ id: callDoc.id, ...callDoc.data() } as IncomingCall);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!connectedCall) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', connectedCall.id), (snapshot) => {
      const call = snapshot.data();
      if (!call || call.status === 'ended' || call.status === 'declined' || call.status === 'missed') {
        endActiveWebRTCCall();
        setConnectedCall(null);
      }
    });

    return unsubscribe;
  }, [connectedCall]);

  const updateCallStatus = async (call: IncomingCall, status: IncomingCall['status']) => {
    await updateDoc(doc(db, 'calls', call.id), {
      status,
      updatedAt: serverTimestamp(),
      ...(status === 'accepted' ? { acceptedAt: serverTimestamp() } : {}),
      ...(status === 'ended' ? { endedAt: serverTimestamp() } : {}),
    });
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    if (!isWebRTCSupported()) {
      Alert.alert(
        'WebRTC not available',
        'Free STUN calls work on web browsers in this build. Native Expo requires react-native-webrtc with a development build.'
      );
      await updateCallStatus(call, 'declined');
      setIncomingCall(null);
      return;
    }

    setIncomingCall(null);
    try {
      await acceptIncomingWebRTCCall(call.id, call.type);
      setConnectedCall(call);
    } catch (error: any) {
      Alert.alert('Call failed', error?.message || 'Could not answer this call.');
      await updateCallStatus(call, 'declined');
    }
  };

  const declineCall = async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    setIncomingCall(null);
    await updateCallStatus(call, 'declined');
  };

  const endConnectedCall = async () => {
    if (!connectedCall) return;
    const call = connectedCall;
    endActiveWebRTCCall();
    setConnectedCall(null);
    await updateCallStatus(call, 'ended');
  };

  const activeCall = incomingCall || connectedCall;
  if (!activeCall) return null;

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={incomingCall ? declineCall : endConnectedCall}>
      <LinearGradient colors={[theme.background, '#121212']} style={styles.callOverlay}>
        <View style={styles.callHeader}>
          <Ionicons name={activeCall.type === 'video' ? 'videocam' : 'call'} size={22} color="rgba(255,255,255,0.72)" />
          <Text style={styles.callType}>{activeCall.type === 'video' ? 'VIDEO CALL' : 'VOICE CALL'}</Text>
        </View>

        <View style={styles.callIdentity}>
          <View style={styles.callAvatarRing}>
            <GradientAvatar name={activeCall.callerName || 'Friend'} photoURL={activeCall.callerPhotoURL} size={124} />
          </View>
          <Text style={styles.callName}>{activeCall.callerName || 'Friend'}</Text>
          <Text style={styles.callStatus}>{incomingCall ? 'Incoming call...' : 'Connected'}</Text>
        </View>

        {incomingCall ? (
          <View style={styles.callActions}>
            <TouchableOpacity onPress={declineCall} style={[styles.callActionBtn, styles.declineBtn]}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={acceptCall} style={[styles.callActionBtn, styles.acceptBtn]}>
              <Ionicons name="call" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={endConnectedCall} style={[styles.callActionBtn, styles.declineBtn]}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Modal>
  );
}

function StartupAnimation({ theme }: { theme: any }) {
  const logoScale = useRef(new Animated.Value(0.2)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Logo spring in
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      // Text fade in after logo
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });

    // Pulse the loading dots
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[startupStyles.container, { backgroundColor: theme.background }]}>
      {/* Background glow blobs */}
      <View style={[startupStyles.glow1, { backgroundColor: theme.primary }]} />
      <View style={[startupStyles.glow2, { backgroundColor: theme.secondary }]} />

      {/* Animated logo */}
      <Animated.View style={[startupStyles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={startupStyles.logoGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={52} color="#fff" />
        </LinearGradient>
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[startupStyles.appName, { color: theme.text, opacity: textOpacity }]}>
        Personal Messenger
      </Animated.Text>
      <Animated.Text style={[startupStyles.tagline, { color: theme.textSecondary, opacity: textOpacity }]}>
        Stay close, no matter the distance
      </Animated.Text>

      {/* Pulsing loading indicator */}
      <Animated.View style={[startupStyles.dotsRow, { opacity: dotOpacity }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[startupStyles.dot, { backgroundColor: theme.primary }]} />
        ))}
      </Animated.View>
    </View>
  );
}

function RootContent() {
  const { user, loading } = useAuth();
  const { theme, mode } = useTheme();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/(tabs)' as any);
      } else {
        router.replace('/(auth)/splash' as any);
      }
    }
  }, [user, loading]);

  if (loading) {
    return <StartupAnimation theme={theme} />;
  }

  return (
    <ThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="new-chat" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="user/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-account" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-appearance" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-privacy" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-data-storage" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-language" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-help" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-about" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-blocked-users" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <IncomingCallListener />
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const startupStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  glow1: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -80,
    left: -80,
    opacity: 0.15,
  },
  glow2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: 60,
    right: -60,
    opacity: 0.12,
  },
  logoWrap: { marginBottom: 8 },
  logoGradient: {
    width: 110,
    height: 110,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: 60,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

const styles = StyleSheet.create({
  callOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 72,
    paddingHorizontal: 24,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callType: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  callIdentity: {
    alignItems: 'center',
    gap: 14,
  },
  callAvatarRing: {
    padding: 8,
    borderRadius: 74,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  callName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  callStatus: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    fontWeight: '600',
  },
  callActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 42,
  },
  callActionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: '#21C55D',
  },
  declineBtn: {
    backgroundColor: '#FF1744',
  },
});

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </AppThemeProvider>
  );
}
