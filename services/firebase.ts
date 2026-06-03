import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
// @ts-ignore
import { Auth, getAuth, initializeAuth, getReactNativePersistence, GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyAKGQwNKtu9DwdSRHWRgsKKM4dPYwjK6l0",
  authDomain: "personal-messenger-58f00.firebaseapp.com",
  projectId: "personal-messenger-58f00",
  storageBucket: "personal-messenger-58f00.firebasestorage.app",
  messagingSenderId: "443606839141",
  appId: "1:443606839141:web:43541d5de6366c3a9c3b8c",
  measurementId: "G-MM90FMM35Y",
};

// Initialize Firebase (prevent duplicate init on hot reload)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;

if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;

/**
 * Web: Sign in with Google using Firebase popup.
 * Works without any client ID configuration.
 */
export async function signInWithGoogleWeb() {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  return signInWithPopup(auth, provider);
}

/**
 * Native: Sign in with Google using a token obtained from expo-auth-session.
 * Call this after you get the idToken/accessToken from Google.useAuthRequest hook.
 */
export async function signInWithGoogleCredential(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  return signInWithCredential(auth, credential);
}