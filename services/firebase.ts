import { Platform } from "react-native";
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
let app: any;
let auth: any;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  
  if (Platform.OS === 'web') {
    // For Web, standard getAuth automatically handles persistence
    auth = getAuth(app);
  } else {
    // For React Native (iOS/Android), use AsyncStorage
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  }
} else {
  app = getApp();
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;