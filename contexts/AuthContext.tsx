import { auth, db } from '@/services/firebase';
import { registerForPushNotificationsAsync } from '@/services/notifications';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  bio: string;
  status: string;
  statusEmoji: string;
  isOnline: boolean;
  lastSeen: any;
  createdAt: any;
  pushToken?: string;
  friends?: string[];
  blockedUsers?: string[];
  // Personal information
  gender?: string;
  birthday?: string;
  phone?: string;
  location?: string;
  website?: string;
  // Notification settings
  pushNotificationsEnabled?: boolean;
  messageSoundsEnabled?: boolean;
  // Privacy settings
  readReceiptsEnabled?: boolean;
  lastSeenEnabled?: boolean;
  profileVisibilityEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (firebaseUser) {
        // Mark user as online
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            isOnline: true,
            lastSeen: serverTimestamp(),
          });

          // REAL-TIME profile listener
          profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data() as UserProfile);
            }
          }, (error) => {
            console.error("Profile onSnapshot error:", error);
            if (error.code === 'permission-denied' || error.message?.includes('permission')) {
              signOut(auth);
            }
          });

          // Request and save push token
          try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                pushToken: token,
              });
            }
          } catch (tokenError) {
            console.log('Error getting push token', tokenError);
          }
        } catch (e) {
          // Profile may not exist yet
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName });

    const newProfile: UserProfile = {
      uid: credential.user.uid,
      displayName,
      email,
      photoURL: null,
      bio: '',
      status: 'Hey there! I am using Personal Messenger.',
      statusEmoji: '👋',
      isOnline: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    setUserProfile(newProfile);
  };

  const logout = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          lastSeen: serverTimestamp(),
          pushToken: deleteField(),
        });
      }
    } catch (e) {
      console.error("Error updating online status during logout:", e);
    }
    await signOut(auth);
  };

  const resetPassword = async (email: string) => {
    try {
      // Log attempt for diagnostics
      // eslint-disable-next-line no-console
      console.log('Attempting password reset for', email);
      await sendPasswordResetEmail(auth, email);
      // eslint-disable-next-line no-console
      console.log('Password reset email sent (request accepted) for', email);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('sendPasswordResetEmail error:', e);
      throw e;
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), data);
    setUserProfile((prev) => prev ? { ...prev, ...data } : null);
  };

  const deleteAccount = async () => {
    if (!user) return;
    const uid = user.uid;
    try {
      // 1. Delete Firestore profile
      await deleteDoc(doc(db, 'users', uid));
      // 2. Delete Auth user
      await deleteUser(user);
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        throw new Error('Please log in again before deleting your account for security reasons.');
      }
      throw e;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, login, register, logout, updateUserProfile, resetPassword, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
