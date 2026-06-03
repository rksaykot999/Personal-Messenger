import Constants from 'expo-constants';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from './firebase';

// We'll use lazy-loading for expo-notifications to avoid crashes in Expo Go
let Notifications: any = null;

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isWeb = Platform.OS === 'web';

/**
 * Initialize notification handling safely
 */
export function initNotifications() {
  if (isWeb) {
    return;
  }

  try {
    // Lazy load the package
    if (!Notifications) {
      Notifications = require('expo-notifications');
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.warn('Error in initNotifications:', error);
  }
}

// Call initialization (only if not in Web)
if (!isWeb) {
  initNotifications();
}

/**
 * Register for push notifications and return the Expo Push Token
 */
export async function registerForPushNotificationsAsync() {
  if (isWeb || isExpoGo) {
    return null;
  }

  try {
    if (!Notifications) {
      Notifications = require('expo-notifications');
    }

    let token;

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      } catch (e) {
        console.error('Error setting notification channel:', e);
      }
    }

    // Get permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get the token
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '0ee488fc-fb14-426f-a7cb-43b611a33a36';

    token = (await Notifications.getExpoPushTokenAsync({
      projectId,
    })).data;

    console.log('Expo Push Token retrieved');

    if (token) {
      await saveTokenToFirestore(token);
    }

    return token;
  } catch (e) {
    console.error('Error in registerForPushNotificationsAsync:', e);
    return null;
  }
}

/**
 * Save the push token to the current user's Firestore document
 */
export async function saveTokenToFirestore(token: string) {
  const user = auth.currentUser;
  if (!user || !token) {
    console.log('Skipping push token save: no authenticated user or token.');
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      pushToken: token,
      lastTokenUpdate: serverTimestamp(),
    });

    console.log('Push token saved to Firestore');
  } catch (error) {
    console.error('Error saving token to Firestore:', error);
  }
}

/**
 * Send a local notification
 */
export async function sendLocalNotification(title: string, body: string, data?: any) {
  if (isWeb) return;

  try {
    if (!Notifications) {
      Notifications = require('expo-notifications');
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null,
    });
  } catch (e) {
    console.error('Error sending local notification:', e);
  }
}

/**
 * Send a push notification through Expo's push service.
 * This works only when the receiver has a saved Expo push token from a development/production build.
 */
export async function sendPushNotificationAsync(to: string | null | undefined, title: string, body: string, data?: any) {
  if (!to) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Expo push notification failed:', errorText);
    }
  } catch (error) {
    console.warn('Error sending push notification:', error);
  }
}

/**
 * Notification listeners helpers
 */
export function addNotificationReceivedListener(callback: (notification: any) => void) {
  if (isWeb) return { remove: () => { } };
  if (!Notifications) Notifications = require('expo-notifications');
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(callback: (response: any) => void) {
  if (isWeb) return { remove: () => { } };
  if (!Notifications) Notifications = require('expo-notifications');
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function removeNotificationSubscription(subscription: any) {
  if (subscription && typeof subscription.remove === 'function') {
    subscription.remove();
  }
}

export async function dismissAllNotifications() {
  if (isWeb) return;
  try {
    if (!Notifications) Notifications = require('expo-notifications');
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.warn('Error dismissing notifications:', error);
  }
}
