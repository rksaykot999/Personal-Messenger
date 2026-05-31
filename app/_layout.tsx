import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { db } from '@/services/firebase';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
} from '@/services/notifications';

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
  // ─── Active call tracking (incoming ringing) ──────────────
  const [shownCallId, setShownCallId] = React.useState<string | null>(null);
  const activeCallIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Firestore এ ringing status দেখা (receiver)
    const callsQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      if (snapshot.empty) {
        activeCallIdRef.current = null;
        return;
      }

      const callDoc = snapshot.docs[0];
      const callId = callDoc.id;

      // একই call বারবার navigate না করার জন্য
      if (activeCallIdRef.current === callId) return;
      activeCallIdRef.current = callId;
      setShownCallId(callId);

      const callData = callDoc.data() as IncomingCall;

      // Call screen এ navigate করা
      const encodedName = encodeURIComponent(callData.callerName || 'Friend');
      const encodedPhoto = encodeURIComponent(callData.callerPhotoURL || '');

      router.push(
        `/call/${callId}?role=receiver&type=${callData.type}&name=${encodedName}&photo=${encodedPhoto}` as any
      );
    });

    return unsubscribe;
  }, [user]);

  // এই component শুধু listener — কোনো UI নেই
  return null;
}

// ─── Foreground In-App Notification Banner ──────────────────────────────────
interface BannerData {
  title: string;
  body: string;
  chatId?: string;
}

function NotificationBanner() {
  const { theme } = useTheme();
  const [banner, setBanner] = React.useState<BannerData | null>(null);
  const slideY = useRef(new Animated.Value(-120)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = React.useCallback((data: BannerData) => {
    setBanner(data);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }).start();
    hideTimer.current = setTimeout(() => hideBanner(), 4000);
  }, [slideY]);

  const hideBanner = React.useCallback(() => {
    Animated.timing(slideY, { toValue: -120, duration: 300, useNativeDriver: true }).start(() => {
      setBanner(null);
    });
  }, [slideY]);

  useEffect(() => {
    const sub = addNotificationReceivedListener((notification: any) => {
      const { title, body, data } = notification.request.content;
      showBanner({ title: title || 'New message', body: body || '', chatId: data?.chatId });
    });
    return () => removeNotificationSubscription(sub);
  }, [showBanner]);

  if (!banner) return null;

  const statusH = Platform.OS === 'android' ? 32 : 54;

  return (
    <Animated.View
      style={[
        bannerStyles.bannerWrap,
        { top: statusH, transform: [{ translateY: slideY }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          hideBanner();
          if (banner.chatId) router.push(`/chat/${banner.chatId}` as any);
        }}
        style={[bannerStyles.bannerCard, { backgroundColor: theme.surface || theme.background }]}
      >
        <LinearGradient
          colors={[theme.primary, theme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={bannerStyles.bannerIcon}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
        </LinearGradient>
        <View style={bannerStyles.bannerText}>
          <Text style={[bannerStyles.bannerTitle, { color: theme.text }]} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={[bannerStyles.bannerBody, { color: theme.textSecondary }]} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
        <TouchableOpacity onPress={hideBanner} style={bannerStyles.closeBtn}>
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 12,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bannerBody: {
    fontSize: 13,
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
  },
});

function StartupAnimation({ theme }: { theme: any }) {
  const logoScale = useRef(new Animated.Value(0.2)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo spring in
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      // Text fade in after logo
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });

    // Animate progress bar to 100% over 2000ms
    Animated.timing(progressWidth, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();
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
          <Image source={require('../assets/pm_logo.png')} style={startupStyles.logoImage} resizeMode="contain" />
        </LinearGradient>
      </Animated.View>

      <Animated.Text style={[startupStyles.appName, { color: theme.text, opacity: textOpacity }]}>
        Personal Messenger
      </Animated.Text>
      <Animated.Text style={[startupStyles.tagline, { color: theme.textSecondary, opacity: textOpacity }]}>
        Stay close, no matter the distance
      </Animated.Text>

      {/* Premium progress bar */}
      <Animated.View style={[startupStyles.progressContainer, { opacity: textOpacity }]}>
        <Animated.View
          style={[
            startupStyles.progressBar,
            {
              backgroundColor: theme.primary,
              width: progressWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

function RootContent() {
  const { user, loading } = useAuth();
  const { theme, mode } = useTheme();
  const [isAppReady, setIsAppReady] = React.useState(false);

  // ─── Notification tap → navigate to chat ───────────────────────────────
  useEffect(() => {
    const responseSub = addNotificationResponseReceivedListener((response: any) => {
      const chatId = response?.notification?.request?.content?.data?.chatId;
      if (chatId) {
        router.push(`/chat/${chatId}` as any);
      }
    });
    return () => removeNotificationSubscription(responseSub);
  }, []);

  useEffect(() => {
    let active = true;

    // Set a guaranteed 2 second minimum loading preloader
    const timer = setTimeout(() => {
      if (active && !loading) {
        setIsAppReady(true);
      }
    }, 2000);

    if (!loading) {
      const checkTimer = setTimeout(() => {
        if (active) {
          setIsAppReady(true);
        }
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
        clearTimeout(checkTimer);
      };
    }

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    if (isAppReady) {
      if (user) {
        router.replace('/(tabs)' as any);
      } else {
        router.replace('/(auth)/splash' as any);
      }
    }
  }, [user, isAppReady]);

  if (!isAppReady) {
    return <StartupAnimation theme={theme} />;
  }

  return (
    <ThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="call/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal', headerShown: false }} />
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
      <NotificationBanner />
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
  logoImage: {
    width: 64,
    height: 64,
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
    marginBottom: 10,
  },
  progressContainer: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
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
  callDuration: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
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
