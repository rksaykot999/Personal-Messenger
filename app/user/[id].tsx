import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
} from "react-native";
import { doc, onSnapshot, collection, query, where, getDocs, deleteDoc, writeBatch, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { db } from "@/services/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { GradientAvatar } from "@/components/ui/GradientAvatar";

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  isOnline: boolean;
  bio?: string;
  statusEmoji?: string;
  status?: string;
}

export default function UserDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Listen to real-time profile changes of this specific user
    const unsub = onSnapshot(
      doc(db, "users", id),
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching user details:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [id]);

  const handleUnfriend = async () => {
    if (!user || !id || !profile) return;

    Alert.alert(
      "Unfriend",
      `Are you sure you want to remove ${profile.displayName} from your friends list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unfriend",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Remove from each other's friends array in Firestore
              await updateDoc(doc(db, "users", user.uid), {
                friends: arrayRemove(id),
              });
              await updateDoc(doc(db, "users", id), {
                friends: arrayRemove(user.uid),
              });

              // 2. Delete the accepted friend_request doc
              const reqsRef = collection(db, "friend_requests");
              const q = query(
                reqsRef,
                where("status", "==", "accepted"),
                where("participants", "array-contains", user.uid)
              );
              const snap = await getDocs(q);
              const docToDelete = snap.docs.find((d) => {
                const parts = d.data().participants || [];
                return parts.includes(id);
              });
              if (docToDelete) {
                await deleteDoc(docToDelete.ref);
              }

              Alert.alert("Success", `${profile.displayName} has been unfriended.`);
            } catch (e: any) {
              console.error("Error unfriending user:", e);
              Alert.alert("Error", "Could not unfriend user.");
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = async () => {
    if (!user || !id || !profile) return;

    Alert.alert(
      "Block User",
      `Are you sure you want to block ${profile.displayName}? They will not be able to message you or see your online status.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Mutually remove from each other's friends array and add to blocked list
              await updateDoc(doc(db, "users", user.uid), {
                friends: arrayRemove(id),
                blockedUsers: arrayUnion(id),
              });
              await updateDoc(doc(db, "users", id), {
                friends: arrayRemove(user.uid),
              });

              // 2. Delete the accepted friend_request doc
              const reqsRef = collection(db, "friend_requests");
              const q = query(
                reqsRef,
                where("status", "==", "accepted"),
                where("participants", "array-contains", user.uid)
              );
              const snap = await getDocs(q);
              const docToDelete = snap.docs.find((d) => {
                const parts = d.data().participants || [];
                return parts.includes(id);
              });
              if (docToDelete) {
                await deleteDoc(docToDelete.ref);
              }

              Alert.alert("Success", `${profile.displayName} has been blocked.`);
            } catch (e: any) {
              console.error("Error blocking user:", e);
              Alert.alert("Error", "Could not block user.");
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!user || !id || !profile) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        blockedUsers: arrayRemove(id),
      });
      Alert.alert("Success", `${profile.displayName} has been unblocked.`);
    } catch (e: any) {
      console.error("Error unblocking user:", e);
      Alert.alert("Error", "Could not unblock user.");
    }
  };

  const handleClearChat = async () => {
    if (!user || !id) return;

    Alert.alert(
      "Clear Chat History",
      "Are you sure you want to delete all messages in this chat? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              // Find the chat room ID
              const chatsRef = collection(db, "chats");
              const q = query(chatsRef, where("participants", "array-contains", user.uid));
              const snap = await getDocs(q);
              const chatDoc = snap.docs.find((d) =>
                d.data().participants?.includes(id)
              );

              if (chatDoc) {
                const messagesRef = collection(db, "chats", chatDoc.id, "messages");
                const msgsSnap = await getDocs(messagesRef);
                
                const batch = writeBatch(db);
                msgsSnap.docs.forEach((doc) => {
                  batch.delete(doc.ref);
                });
                await batch.commit();

                Alert.alert("Success", "Chat history cleared successfully.");
              }
            } catch (e: any) {
              console.error("Error clearing chat:", e);
              Alert.alert("Error", "Could not clear chat history.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary} />
        <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 12 }}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 12, backgroundColor: theme.primary, borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusBarH = Platform.OS === "android" ? StatusBar.currentHeight || 0 : 44;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent />

      {/* Hero Section with Large Avatar & Backdrop */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <LinearGradient
          colors={[`${theme.primary}25`, `${theme.background}`]}
          style={[styles.hero, { paddingTop: statusBarH + 20 }]}
        >
          {/* Top Custom Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.circleBtn, { backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.05)" }]}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.topTitle, { color: theme.text }]}>Profile Details</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Avatar Area */}
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarOutline, { borderColor: `${theme.primary}30` }]}>
              <GradientAvatar name={profile.displayName} photoURL={profile.photoURL} size={130} />
            </View>
            {profile.isOnline && (
              <View style={[styles.onlineIndicator, { backgroundColor: theme.online, borderColor: theme.background }]} />
            )}
          </View>

          {/* User Meta */}
          <Text style={[styles.displayName, { color: theme.text }]}>{profile.displayName}</Text>
          
          <View style={styles.statusRow}>
            <Text style={[styles.onlineText, { color: profile.isOnline ? theme.online : theme.textTertiary }]}>
              {profile.isOnline ? "Active Now" : "Offline"}
            </Text>
            {profile.statusEmoji && (
              <View style={[styles.statusBadge, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>{profile.statusEmoji} {profile.status}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Info Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CONTACT INFORMATION</Text>
          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={theme.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>Email Address</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>{profile.email}</Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <Ionicons name="chatbox-outline" size={20} color={theme.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: theme.textTertiary }]}>Bio / Tagline</Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {profile.bio || "Hey there! I am using Personal Messenger."}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>QUICK ACTIONS</Text>
          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            
            {/* Start a Chat */}
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.actionItem}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: `${theme.primary}15` }]}>
                <Ionicons name="chatbubble-ellipses" size={20} color={theme.primary} />
              </View>
              <Text style={[styles.actionText, { color: theme.text }]}>Send Message</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.border }]} />

            {/* Clear Chat History */}
            <TouchableOpacity
              onPress={handleClearChat}
              style={styles.actionItem}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: "rgba(255,23,73,0.1)" }]}>
                <Ionicons name="trash-outline" size={20} color="#FF1744" />
              </View>
              <Text style={[styles.actionText, { color: "#FF1744" }]}>Clear Chat History</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {userProfile?.friends?.includes(id || "") && (
              <>
                <View style={[styles.separator, { backgroundColor: theme.border }]} />

                {/* Unfriend */}
                <TouchableOpacity
                  onPress={handleUnfriend}
                  style={styles.actionItem}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: "rgba(255,23,73,0.1)" }]}>
                    <Ionicons name="person-remove-outline" size={20} color="#FF1744" />
                  </View>
                  <Text style={[styles.actionText, { color: "#FF1744" }]}>Unfriend</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
                </TouchableOpacity>
              </>
            )}

            {/* Block / Unblock User */}
            <View style={[styles.separator, { backgroundColor: theme.border }]} />
            
            {userProfile?.blockedUsers?.includes(id || "") ? (
              <TouchableOpacity
                onPress={handleUnblockUser}
                style={styles.actionItem}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: `${theme.primary}15` }]}>
                  <Ionicons name="shield-outline" size={20} color={theme.primary} />
                </View>
                <Text style={[styles.actionText, { color: theme.primary }]}>Unblock User</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleBlockUser}
                style={styles.actionItem}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: "rgba(255,23,73,0.1)" }]}>
                  <Ionicons name="ban-outline" size={20} color="#FF1744" />
                </View>
                <Text style={[styles.actionText, { color: "#FF1744" }]}>Block User</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            )}

          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatarOutline: {
    padding: 6,
    borderRadius: 75,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 4,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
  },
  displayName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  statusRow: {
    alignItems: "center",
    gap: 8,
  },
  onlineText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 8,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
  },
  separator: {
    height: 1,
    marginHorizontal: 16,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
});
