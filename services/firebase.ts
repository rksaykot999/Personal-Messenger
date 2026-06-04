import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, EmailAuthProvider, FacebookAuthProvider, getAuth, GoogleAuthProvider, linkWithCredential, signInWithCredential, signInWithPopup } from 'firebase/auth';
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

// Initialize Firebase
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;

const isWeb = Platform.OS === 'web';
if (isWeb) {
  auth = getAuth(app);
} else {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnAuth = require('firebase/auth/react-native');
    const { initializeAuth: initializeAuthRN, getReactNativePersistence: getReactNativePersistenceRN } = rnAuth;
    auth = initializeAuthRN(app, { persistence: getReactNativePersistenceRN(AsyncStorage) });
  } catch (error) {
    // ত্রুটি সংশোধন: error টি Error টাইপের কি না তা চেক করা হচ্ছে
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn('React Native Firebase auth helpers not available, falling back to getAuth():', errorMessage);
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;

/**
 * Web: Sign in with Google using Firebase popup.
 */
export async function signInWithGoogleWeb() {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  return signInWithPopup(auth, provider);
}

/**
 * Native: Sign in with Google using a token obtained from expo-auth-session.
 */
export async function signInWithGoogleCredential(idToken: string, accessToken?: string) {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  return signInWithCredential(auth, credential);
}

/**
 * Web: Sign in with Facebook using Firebase popup.
 */
export async function signInWithFacebookWeb() {
  const provider = new FacebookAuthProvider();
  provider.addScope('email');
  provider.addScope('public_profile');
  return signInWithPopup(auth, provider);
}

/**
 * Link the currently signed-in (e.g., Google) user with an email/password credential.
 */
export async function linkCurrentUserWithEmailPassword(password: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No signed-in user with an email address available to link.');
  const credential = EmailAuthProvider.credential(user.email, password);
  return linkWithCredential(user, credential);
}