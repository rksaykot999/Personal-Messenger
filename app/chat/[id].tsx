import { GradientAvatar } from "@/components/ui/GradientAvatar";
import { Message, MessageBubble } from "@/components/ui/MessageBubble";
import { TypingIndicator } from "@/components/ui/TypingIndicator";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { db } from "@/services/firebase";
import { dismissAllNotifications, sendPushNotificationAsync } from "@/services/notifications";
import { uploadToSupabaseRest } from "@/services/supabase";
import { isWebRTCSupported } from "@/services/webrtcCalls";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from "react-native";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function ChatScreen({ chatId: propChatId }: { chatId?: string }) {
  const { id: paramId } = useLocalSearchParams<{ id: string }>();
  const id = propChatId || paramId;
  const { theme } = useTheme();
  const { user, userProfile } = useAuth();

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  useEffect(() => {
    if (isWide && !propChatId) {
      router.replace('/(tabs)' as any);
    }
  }, [isWide, propChatId]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Calling & Attachment Picker Custom States
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [callState, setCallState] = useState<
    "calling" | "ringing" | "connected" | null
  >(null);
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const callTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStatusUnsub = useRef<(() => void) | null>(null);
  const ringingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Premium Interactive Action states
  const [activeViewerImage, setActiveViewerImage] = useState<string | null>(
    null,
  );
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: "image" | "video" } | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [groupSettingsVisible, setGroupSettingsVisible] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  // Reactor details modal states
  const [reactorModalVisible, setReactorModalVisible] = useState(false);
  const [activeReactorEmoji, setActiveReactorEmoji] = useState("");
  const [activeReactorsList, setActiveReactorsList] = useState<string[]>([]);

  // Emoji composer picker states
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  const isGroupChat = chatInfo?.type === "group";
  const chatTitle = isGroupChat
    ? chatInfo?.groupName || "Group Chat"
    : otherUser?.displayName || "Loading...";
  const chatSubtitle = isGroupChat
    ? `${chatInfo?.participants?.length || 0} members`
    : otherUser?.isOnline
      ? "● Online"
      : "Offline";
  const chatPhotoURL = isGroupChat ? chatInfo?.groupPhotoURL : otherUser?.photoURL;
  const isBlockedByMe = !isGroupChat && otherUser && (userProfile as any)?.blockedUsers?.includes(otherUser.uid);
  const isBlockedByThem = !isGroupChat && otherUser && otherUser.blockedUsers?.includes(user?.uid);

  const resolveReactorProfile = (uid: string) => {
    if (uid === user?.uid) {
      return {
        displayName: (userProfile?.displayName || user.displayName || "Saykot") + " (You)",
        photoURL: userProfile?.photoURL || user.photoURL || null,
        email: userProfile?.email || user.email || "",
      };
    }

    const member = groupMembers.find(m => m.uid === uid);
    if (member) {
      return {
        displayName: member.displayName || "Someone",
        photoURL: member.photoURL || null,
        email: member.email || "",
      };
    }

    if (otherUser && otherUser.uid === uid) {
      return {
        displayName: otherUser.displayName || "Friend",
        photoURL: otherUser.photoURL || null,
        email: otherUser.email || "",
      };
    }

    return {
      displayName: "Someone",
      photoURL: null,
      email: "",
    };
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const getUnreadCountUpdates = () => {
    const updates: any = {};
    if (!user || !chatInfo?.participants) return updates;

    chatInfo.participants
      .filter((uid: string) => uid !== user.uid)
      .forEach((uid: string) => {
        updates[`unreadCount.${uid}`] = increment(1);
      });

    return updates;
  };

  // Fetch chat profile details in real-time
  useEffect(() => {
    if (!id || !user) return;
    const unsub = onSnapshot(doc(db, "chats", id), async (chatDoc) => {
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        setChatInfo({ id: chatDoc.id, ...data });
        if (data.type === "group") {
          setOtherUser(null);
          // Fetch members profiles to get their displayNames and photoURLs
          const membersList: any[] = [];
          const participants = data.participants || [];
          for (const uid of participants) {
            try {
              const uDoc = await getDoc(doc(db, "users", uid));
              if (uDoc.exists()) {
                membersList.push({ uid, ...uDoc.data() });
              }
            } catch (err) {
              console.error("Error fetching group member profile:", err);
            }
          }
          setGroupMembers(membersList);
          return;
        }

        const otherUid = data.participants?.find((p: string) => p !== user.uid);
        if (otherUid) {
          const userDoc = await getDoc(doc(db, "users", otherUid));
          if (userDoc.exists())
            setOtherUser({ uid: otherUid, ...userDoc.data() });
        }
      }
    });
    return () => unsub();
  }, [id, user]);

  // Subscribe to other user's profile in real-time to watch blocked status
  useEffect(() => {
    if (!id || !user || !chatInfo || chatInfo.type === "group") return;
    const otherUid = chatInfo.participants?.find((p: string) => p !== user.uid);
    if (!otherUid) return;

    const unsub = onSnapshot(doc(db, "users", otherUid), (snap) => {
      if (snap.exists()) {
        setOtherUser({ uid: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [id, user, chatInfo?.id]);

  // Clear notifications when entering the chat
  useEffect(() => {
    dismissAllNotifications();
  }, []);

  // Subscribe to messages
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "chats", id, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Message)
          .filter((msg) => !msg.deletedFor?.includes(user?.uid || ""));
        setMessages([...msgs].reverse());
        // Mark messages as read
        if (user) markRead(msgs);
      },
      (error) => {
        console.error("Messages subscription error:", error);
      },
    );
    return () => unsub();
  }, [id, user]);

  // Listen for typing indicator
  useEffect(() => {
    if (!id || !otherUser || isGroupChat) return;
    const typingRef = doc(db, "chats", id, "typing", otherUser.uid);
    const unsub = onSnapshot(
      typingRef,
      (snap) => {
        if (snap.exists()) {
          setIsTyping(snap.data()?.isTyping || false);
        }
      },
      (error) => {
        console.error("Typing indicator subscription error:", error);
      },
    );
    return () => unsub();
  }, [id, otherUser, isGroupChat]);

  const markRead = async (msgs: Message[]) => {
    if (!user || !id) return;
    try {
      // 1. Reset parent unreadCount for current user
      await updateDoc(doc(db, "chats", id), {
        [`unreadCount.${user.uid}`]: 0,
      });

      // 2. Query and set all incoming unread messages status to 'read'
      const unreadReceivedMessages = msgs.filter(
        (m) => m.senderId !== user.uid && m.status !== "read",
      );

      for (const msg of unreadReceivedMessages) {
        try {
          await updateDoc(doc(db, "chats", id, "messages", msg.id), {
            status: "read",
          });
        } catch (err) {
          console.error("Failed to mark message as read:", err);
        }
      }
    } catch (err) {
      console.error("markRead error:", err);
    }
  };

  // --- Bulletproof local file URI to Blob converter for React Native ---
  const uriToBlob = (localUri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        reject(new Error("Local file-to-blob conversion failed."));
      };
      xhr.responseType = "blob";
      xhr.open("GET", localUri, true);
      xhr.send(null);
    });
  };

  // --- Image & Video Upload and Sending Logic ---
  const uploadAndSendMedia = async (
    uri: string,
    mediaType: "image" | "video",
    caption: string = "",
  ) => {
    if (!id || !user) return;
    setSending(true);
    try {
      // 1. Fetch file and convert to Blob using robust XMLHttpRequest
      const blob = await uriToBlob(uri);
      const filename = `${Date.now()}_${mediaType === "image" ? "photo.jpg" : "video.mp4"}`;
      const filePath = `chats/${id}/media/${filename}`;

      // 2. Upload to Supabase using the zero-dependency REST utility
      const downloadUrl = await uploadToSupabaseRest(
        filePath,
        blob,
        mediaType === "image" ? "image/jpeg" : "video/mp4",
      );

      // 3. Save message details in Firestore
      const msgData: any = {
        text: caption.trim() ? caption.trim() : "",
        senderId: user.uid,
        senderName: userProfile?.displayName || user.displayName || "Someone",
        senderPhotoURL: userProfile?.photoURL || user.photoURL || null,
        createdAt: serverTimestamp(),
        status: "sent",
        type: mediaType,
        mediaUrl: downloadUrl,
      };

      await addDoc(collection(db, "chats", id, "messages"), msgData);

      await updateDoc(doc(db, "chats", id), {
        lastMessage: caption.trim()
          ? mediaType === "image"
            ? `📷 ${caption.trim()}`
            : `🎥 ${caption.trim()}`
          : mediaType === "image"
            ? "📷 Photo"
            : "🎥 Video",
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        deletedFor: [],
        ...getUnreadCountUpdates(),
      });

      // Send Push Notification
      const senderName = userProfile?.displayName || user.displayName || "Someone";
      const notifText = caption.trim()
        ? mediaType === "image"
          ? `📷 ${caption.trim()}`
          : `🎥 ${caption.trim()}`
        : mediaType === "image"
          ? "📷 Photo"
          : "🎥 Video";

      const isOtherUserMuted = chatInfo?.mutedBy?.includes(otherUser?.uid || "");
      if (!isGroupChat && otherUser?.pushToken && !isOtherUserMuted) {
        sendPushNotificationAsync(otherUser.pushToken, senderName, notifText, { url: `/chat/${id}` });
      } else if (isGroupChat && groupMembers) {
        groupMembers.forEach((member) => {
          const isMemberMuted = chatInfo?.mutedBy?.includes(member.uid);
          if (member.uid !== user.uid && member.pushToken && !isMemberMuted) {
            sendPushNotificationAsync(member.pushToken, chatInfo?.groupName || "Group Chat", `${senderName}: ${notifText}`, { url: `/chat/${id}` });
          }
        });
      }

      setSending(false);
    } catch (e: any) {
      console.error("Supabase REST upload error:", e);
      Alert.alert("Upload Error", e.message || "Failed to upload media.");
      setSending(false);
    }
  };

  const pickMedia = async (
    source: "library" | "camera",
    mediaType: "image" | "video",
  ) => {
    setAttachmentModalVisible(false);
    try {
      let result;
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Camera permission is required to take photos.",
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes:
            mediaType === "image"
              ? ImagePicker.MediaTypeOptions.Images
              : ImagePicker.MediaTypeOptions.Videos,
          quality: 0.8,
        });
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Gallery permission is required to pick files.",
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            mediaType === "image"
              ? ImagePicker.MediaTypeOptions.Images
              : ImagePicker.MediaTypeOptions.Videos,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPendingMedia({ uri: asset.uri, type: mediaType });
        setCaptionText("");
      }
    } catch (e) {
      console.error("Error picking media:", e);
      Alert.alert("Error", "Could not open media picker.");
    }
  };

  // --- Calling Signaling Engine ---
  useEffect(() => {
    if (callState === "connected") {
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

  const finishLocalCall = () => {
    // Call screen handles WebRTC cleanup
    callStatusUnsub.current?.();
    callStatusUnsub.current = null;
    if (ringingTimer.current) clearTimeout(ringingTimer.current);
    ringingTimer.current = null;
    setCallState(null);
    setCallType(null);
    setActiveCallId(null);
  };

  const startCall = async (type: "voice" | "video") => {
    if (isGroupChat) {
      Alert.alert("Group calls", "Group voice and video calls are not available yet.");
      return;
    }
    if (!user || !otherUser?.uid) {
      Alert.alert("Call unavailable", "Receiver account was not loaded yet.");
      return;
    }
    if (!isWebRTCSupported()) {
      Alert.alert(
        "WebRTC Not Supported",
        Platform.OS === 'web'
          ? "Your browser does not support WebRTC."
          : "WebRTC call requires a Development Build (Does not work in Expo Go).\n\nCommand: npx expo run:android",
      );
      return;
    }

    try {
      // 1. Firestore এ call document তৈরি করা
      const callRef = await addDoc(collection(db, "calls"), {
        callerId: user.uid,
        callerName: userProfile?.displayName || user.displayName || "Someone",
        callerPhotoURL: userProfile?.photoURL || user.photoURL || null,
        receiverId: otherUser.uid,
        receiverName: otherUser.displayName || "Friend",
        receiverPhotoURL: otherUser.photoURL || null,
        type,
        status: "ringing",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Push notification পাঠানো
      if (otherUser.pushToken) {
        await sendPushNotificationAsync(
          otherUser.pushToken,
          `${userProfile?.displayName || user.displayName || "Someone"} is calling`,
          `Incoming ${type} call`,
          { type: "incoming-call", callId: callRef.id },
        );
      }

      // 3. Call Screen এ navigate করা (caller role)
      const receiverName = encodeURIComponent(otherUser.displayName || 'Friend');
      const receiverPhoto = encodeURIComponent(otherUser.photoURL || '');
      router.push(
        `/call/${callRef.id}?role=caller&type=${type}&name=${receiverName}&photo=${receiverPhoto}` as any
      );
    } catch (error: any) {
      Alert.alert("Call failed", error?.message || "Failed to start the call.");
    }
  };

  const endCall = async () => {
    // Call screen handles WebRTC cleanup
    callStatusUnsub.current?.();
    callStatusUnsub.current = null;

    if (activeCallId) {
      try {
        await updateDoc(doc(db, "calls", activeCallId), {
          status: "ended",
          endedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn("Could not end call:", error);
      }
    }

    finishLocalCall();
  };

  const handleTyping = async (text: string) => {
    setInputText(text);
    if (!id || !user) return;
    // Set typing indicator securely with try-catch to prevent fatal crashes
    try {
      const isTypingValue = text.trim().length > 0;
      await setDoc(
        doc(db, "chats", id, "typing", user.uid),
        { isTyping: isTypingValue },
        { merge: true },
      );
      await updateDoc(doc(db, "chats", id), {
        [`typing.${user.uid}`]: isTypingValue,
      });
    } catch (e) {
      console.warn("Typing indicator write error (check Firestore rules):", e);
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      try {
        await setDoc(
          doc(db, "chats", id, "typing", user.uid),
          { isTyping: false },
          { merge: true },
        );
      } catch (e) {
        console.warn(
          "Typing indicator clear error (check Firestore rules):",
          e,
        );
      }

      try {
        await updateDoc(doc(db, "chats", id), {
          [`typing.${user.uid}`]: false,
        });
      } catch (e) {
        console.warn("Could not clear chat typing state:", e);
      }
    }, 2000);
  };

  const handleInputKeyPress = (event: any) => {
    if (Platform.OS !== "web") return;
    if (event.nativeEvent?.key === "Enter" && !event.nativeEvent?.shiftKey) {
      event.preventDefault?.();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !id || !user || sending) return;
    const text = inputText.trim();
    setInputText("");
    setReplyTo(null);
    setSending(true);

    if (editingMsg) {
      // Editing Mode: Update existing message in Firestore
      try {
        const msgRef = doc(db, "chats", id, "messages", editingMsg.id);
        await updateDoc(msgRef, {
          text: text,
          isEdited: true, // mark as edited!
        });

        if (messages[0]?.id === editingMsg.id) {
          await updateDoc(doc(db, "chats", id), {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
          });
        }

        setEditingMsg(null);
        inputRef.current?.blur();
      } catch (e: any) {
        Alert.alert("Error", "Failed to edit message.");
        console.error("EditMessage error:", e);
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      // Stop typing indicator safely
      try {
        await setDoc(
          doc(db, "chats", id, "typing", user.uid),
          { isTyping: false },
          { merge: true },
        );
      } catch (err) {
        console.warn("Could not clear typing state:", err);
      }

      const msgData: any = {
        text,
        senderId: user.uid,
        senderName: userProfile?.displayName || user.displayName || "Someone",
        senderPhotoURL: userProfile?.photoURL || user.photoURL || null,
        createdAt: serverTimestamp(),
        status: "sent",
      };
      if (replyTo) {
        msgData.replyTo = {
          id: replyTo.id,
          text: replyTo.text,
          senderName:
            replyTo.senderId === user.uid
              ? "You"
              : otherUser?.displayName || "Them",
        };
      }

      await addDoc(collection(db, "chats", id, "messages"), msgData);

      // Update chat metadata
      await updateDoc(doc(db, "chats", id), {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        lastMessageSenderId: user.uid,
        deletedFor: [],
        ...getUnreadCountUpdates(),
      });

      // Send Push Notification
      const senderName = userProfile?.displayName || user.displayName || "Someone";
      const isOtherUserMuted = chatInfo?.mutedBy?.includes(otherUser?.uid || "");
      if (!isGroupChat && otherUser?.pushToken && !isOtherUserMuted) {
        sendPushNotificationAsync(otherUser.pushToken, senderName, text, { url: `/chat/${id}` });
      } else if (isGroupChat && groupMembers) {
        groupMembers.forEach((member) => {
          const isMemberMuted = chatInfo?.mutedBy?.includes(member.uid);
          if (member.uid !== user.uid && member.pushToken && !isMemberMuted) {
            sendPushNotificationAsync(member.pushToken, chatInfo?.groupName || "Group Chat", `${senderName}: ${text}`, { url: `/chat/${id}` });
          }
        });
      }
    } catch (e: any) {
      Alert.alert(
        "Error",
        "Failed to send message. Make sure you have Firestore Security Rules applied.",
      );
      console.error("SendMessage error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!selectedMsg || !id || !user) return;
    setReactionModalVisible(false);
    try {
      const msgRef = doc(db, "chats", id, "messages", selectedMsg.id);

      // Get the absolute latest message object from the active list state to avoid stale snap closures
      const latestMsg = messages.find((m) => m.id === selectedMsg.id) || selectedMsg;
      const reactions = latestMsg.reactions || {};
      const updates: any = {};

      // 1. Loop through ALL emojis in reactions and remove the user's UID to prevent multiple reactions (Self-Healing)
      for (const [key, userList] of Object.entries(reactions)) {
        if (Array.isArray(userList) && userList.includes(user.uid)) {
          updates[`reactions.${key}`] = userList.filter((uid: string) => uid !== user.uid);
        }
      }

      // 2. If they tapped a new emoji (i.e. not toggling the existing emoji off), add them to its array list
      const wasAlreadyReactedWithThisEmoji = Array.isArray(reactions[emoji]) && reactions[emoji].includes(user.uid);

      if (!wasAlreadyReactedWithThisEmoji) {
        // Read either the updated list from step 1 or fall back to the existing list
        const currentList = updates[`reactions.${emoji}`] !== undefined
          ? updates[`reactions.${emoji}`]
          : (reactions[emoji] || []);
        updates[`reactions.${emoji}`] = [...currentList, user.uid];
      }

      await updateDoc(msgRef, updates);
    } catch (err) {
      console.error("handleReaction error:", err);
    }
    setSelectedMsg(null);
  };

  const handleCopy = (text: string) => {
    Clipboard.setString(text);
    Alert.alert("Copied", "Message copied to clipboard.");
    setReactionModalVisible(false);
    setSelectedMsg(null);
  };

  const handleDownload = async (url: string) => {
    try {
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `messenger_image_${Date.now()}.jpg`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        Alert.alert("Success", "Image download started in a new tab.");
      } else {
        Clipboard.setString(url);
        Alert.alert(
          "Link Copied",
          "Direct download link copied to clipboard. You can paste it in your browser to save the file!",
        );
      }
    } catch (err) {
      Alert.alert("Error", "Failed to download image.");
    }
  };

  const handleDelete = async (msgId: string) => {
    if (!selectedMsg || !id || !user) return;

    const isMe = selectedMsg.senderId === user.uid;

    const alertButtons: any[] = [
      {
        text: "Cancel",
        style: "cancel",
        onPress: () => {
          setReactionModalVisible(false);
          setSelectedMsg(null);
        },
      },
      {
        text: "Delete for Me",
        style: "default",
        onPress: async () => {
          setReactionModalVisible(false);
          setSelectedMsg(null);
          try {
            const msgRef = doc(db, "chats", id, "messages", msgId);
            const deletedFor = selectedMsg.deletedFor || [];
            await updateDoc(msgRef, {
              deletedFor: [...deletedFor, user.uid],
            });
          } catch (err) {
            console.error("Delete for me error:", err);
          }
        },
      },
    ];

    if (isMe) {
      alertButtons.push({
        text: "Delete for Everyone",
        style: "destructive",
        onPress: async () => {
          setReactionModalVisible(false);
          setSelectedMsg(null);
          try {
            await deleteDoc(doc(db, "chats", id!, "messages", msgId));
            await updateDoc(doc(db, "chats", id!), {
              lastMessage: "🚫 Message deleted",
              lastMessageTime: serverTimestamp(),
            });
          } catch (err) {
            console.error("Delete for everyone error:", err);
          }
        },
      });
    }

    Alert.alert(
      "Remove Message",
      "Choose how you want to remove this message:",
      alertButtons,
    );
  };

  const handleLeaveGroup = async () => {
    if (!id || !user || !chatInfo) return;

    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group chat?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              const newParticipants = chatInfo.participants.filter((p: string) => p !== user.uid);
              if (newParticipants.length === 0) {
                // If no one is left, delete the group!
                await deleteDoc(doc(db, "chats", id));
              } else {
                // Check if the leaving user was an admin
                let newAdmins = chatInfo.admins || [];
                if (newAdmins.includes(user.uid)) {
                  newAdmins = newAdmins.filter((a: string) => a !== user.uid);
                  // If no admins are left, promote the last entered participant to admin
                  if (newAdmins.length === 0 && newParticipants.length > 0) {
                    newAdmins = [newParticipants[newParticipants.length - 1]];
                  }
                }

                const updates: any = {
                  participants: newParticipants,
                  admins: newAdmins,
                };
                // Remove from unreadCount map
                if (chatInfo.unreadCount) {
                  const newUnread = { ...chatInfo.unreadCount };
                  delete newUnread[user.uid];
                  updates.unreadCount = newUnread;
                }

                await updateDoc(doc(db, "chats", id), updates);

                // Add a system message that the user left
                await addDoc(collection(db, "chats", id, "messages"), {
                  text: `${userProfile?.displayName || user.displayName || "Someone"} has left the group`,
                  senderId: "system",
                  createdAt: serverTimestamp(),
                  status: "sent",
                });
              }

              setGroupSettingsVisible(false);
              router.replace("/(tabs)");
            } catch (err) {
              console.error("Error leaving group:", err);
              Alert.alert("Error", "Could not leave group.");
            }
          }
        }
      ]
    );
  };

  const handleRemoveMember = async (memberToRemove: any) => {
    if (!id || !user || !chatInfo) return;
    const isCreator = chatInfo.createdBy === user.uid;
    const isAdmin = chatInfo.admins?.includes(user.uid);

    if (!isCreator && !isAdmin) {
      Alert.alert("Permission Denied", "Only group admins or the creator can remove members.");
      return;
    }

    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${memberToRemove.displayName} from this group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const newParticipants = chatInfo.participants.filter((p: string) => p !== memberToRemove.uid);
              let newAdmins = chatInfo.admins || [];
              if (newAdmins.includes(memberToRemove.uid)) {
                newAdmins = newAdmins.filter((a: string) => a !== memberToRemove.uid);
              }

              // If no admins are left, promote the last remaining participant to admin
              if (newAdmins.length === 0 && newParticipants.length > 0) {
                newAdmins = [newParticipants[newParticipants.length - 1]];
              }

              const updates: any = {
                participants: newParticipants,
                admins: newAdmins,
              };

              // Remove from unreadCount map
              if (chatInfo.unreadCount) {
                const newUnread = { ...chatInfo.unreadCount };
                delete newUnread[memberToRemove.uid];
                updates.unreadCount = newUnread;
              }

              await updateDoc(doc(db, "chats", id), updates);

              // Add a system message that the member was removed
              await addDoc(collection(db, "chats", id, "messages"), {
                text: `${memberToRemove.displayName} was removed from the group by ${userProfile?.displayName || user.displayName || "Admin"}`,
                senderId: "system",
                createdAt: serverTimestamp(),
                status: "sent",
              });

              Alert.alert("Success", `${memberToRemove.displayName} has been removed.`);
            } catch (err) {
              console.error("Error removing member:", err);
              Alert.alert("Error", "Could not remove member.");
            }
          }
        }
      ]
    );
  };

  const handleDeleteGroup = async () => {
    if (!id || !user || !chatInfo) return;

    Alert.alert(
      "Delete Group",
      "Are you sure you want to delete this group? This will permanently delete the group and all its message history for all members. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Group",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Delete all messages first (subcollection)
              const msgsSnap = await getDocs(collection(db, "chats", id, "messages"));
              for (const d of msgsSnap.docs) {
                await deleteDoc(d.ref);
              }
              // 2. Delete the chat doc itself
              await deleteDoc(doc(db, "chats", id));

              setGroupSettingsVisible(false);
              router.replace("/(tabs)");
            } catch (err) {
              console.error("Error deleting group:", err);
              Alert.alert("Error", "Could not delete group.");
            }
          }
        }
      ]
    );
  };

  const openForwardModal = async () => {
    setReactionModalVisible(false);
    setForwardModalVisible(true);
    setLoadingFriends(true);
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const list: any[] = [];
      usersSnap.forEach((doc) => {
        const u = doc.data();
        if (doc.id !== user?.uid) {
          list.push({ uid: doc.id, ...u });
        }
      });
      setFriends(list);
    } catch (e) {
      console.error("Fetch friends error:", e);
    } finally {
      setLoadingFriends(false);
    }
  };

  const forwardMessage = async (targetFriend: any) => {
    if (!selectedMsg) return;
    try {
      const participants = [user!.uid, targetFriend.uid].sort();
      const chatId = participants.join("_");

      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          id: chatId,
          participants,
          lastMessage: selectedMsg.text || "📷 Sent an attachment",
          lastMessageTime: serverTimestamp(),
          lastMessageSenderId: user!.uid,
          [`unreadCount.${targetFriend.uid}`]: 1,
          [`unreadCount.${user!.uid}`]: 0,
        });
      } else {
        await updateDoc(chatRef, {
          lastMessage: selectedMsg.text || "📷 Sent an attachment",
          lastMessageTime: serverTimestamp(),
          lastMessageSenderId: user!.uid,
          deletedFor: [],
          [`unreadCount.${targetFriend.uid}`]: increment(1),
        });
      }

      const msgData: any = {
        senderId: user!.uid,
        senderName: userProfile?.displayName || user!.displayName || "Someone",
        senderPhotoURL: userProfile?.photoURL || user!.photoURL || null,
        createdAt: serverTimestamp(),
        status: "sent",
      };
      if (selectedMsg.text) msgData.text = selectedMsg.text;
      if (selectedMsg.type) msgData.type = selectedMsg.type;
      if (selectedMsg.mediaUrl) msgData.mediaUrl = selectedMsg.mediaUrl;

      await addDoc(collection(db, "chats", chatId, "messages"), msgData);

      // Send Push Notification
      if (targetFriend.pushToken) {
        sendPushNotificationAsync(
          targetFriend.pushToken,
          userProfile?.displayName || user!.displayName || "Someone",
          "Forwarded a message",
          { url: `/chat/${chatId}` }
        );
      }

      Alert.alert(
        "Forwarded",
        `Message forwarded to ${targetFriend.displayName || "Friend"} successfully!`,
      );
      setForwardModalVisible(false);
      setSelectedMsg(null);
    } catch (err) {
      Alert.alert("Error", "Failed to forward message.");
      console.error("Forward message error:", err);
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const statusBarH =
    Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <LinearGradient
        colors={[theme.surface, theme.background]}
        style={[styles.header, { paddingTop: statusBarH + 12 }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          activeOpacity={0.8}
          onPress={() => {
            if (isGroupChat) {
              setGroupSettingsVisible(true);
            } else if (otherUser?.uid) {
              router.push(`/user/${otherUser.uid}`);
            }
          }}
        >
          <GradientAvatar
            name={chatTitle || "?"}
            photoURL={chatPhotoURL}
            size={40}
            isOnline={!isGroupChat && otherUser?.isOnline}
            showStatus={!isGroupChat}
          />
          <View style={styles.userMeta}>
            <Text
              style={[styles.userName, { color: theme.text }]}
              numberOfLines={1}
            >
              {chatTitle}
            </Text>
            <Text
              style={[
                styles.userOnline,
                {
                  color: !isGroupChat && otherUser?.isOnline
                    ? theme.online
                    : theme.textTertiary,
                },
              ]}
            >
              {chatSubtitle}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => startCall("video")}
            style={[
              styles.headerBtn,
              { backgroundColor: theme.surfaceElevated },
            ]}
          >
            <Ionicons name="videocam-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => startCall("voice")}
            style={[
              styles.headerBtn,
              { backgroundColor: theme.surfaceElevated },
            ]}
          >
            <Ionicons name="call-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12 }}
          renderItem={({ item, index }) => {
            const isMe = item.senderId === user?.uid;
            const prevMsg = index < messages.length - 1 ? messages[index + 1] : null;
            const showTime =
              !prevMsg ||
              (item.createdAt?.seconds || 0) -
              (prevMsg.createdAt?.seconds || 0) >
              300;

            const senderName = item.senderName || (isGroupChat ? (groupMembers.find(m => m.uid === item.senderId)?.displayName || chatInfo?.participantNames?.[item.senderId]) : otherUser?.displayName) || "Someone";
            const senderPhotoURL = item.senderPhotoURL || (isGroupChat ? groupMembers.find(m => m.uid === item.senderId)?.photoURL : otherUser?.photoURL) || null;

            return (
              <MessageBubble
                onImagePress={(url) => setActiveViewerImage(url)}
                message={item}
                isMe={isMe}
                showTime={showTime}
                onLongPress={() => {
                  setSelectedMsg(item);
                  setReactionModalVisible(true);
                }}
                onReply={() => setReplyTo(item)}
                onReactionPress={(emoji, uids) => {
                  setActiveReactorEmoji(emoji);
                  setActiveReactorsList(uids);
                  setReactorModalVisible(true);
                }}
                senderName={senderName}
                senderPhotoURL={senderPhotoURL}
                isGroup={isGroupChat}
              />
            );
          }}
          ListHeaderComponent={isTyping ? <TypingIndicator /> : null}
        />

        {/* Reply Banner */}
        {replyTo && (
          <View
            style={[
              styles.replyBanner,
              {
                backgroundColor: theme.surfaceElevated,
                borderLeftColor: theme.primary,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyLabel, { color: theme.primary }]}>
                Reply to{" "}
                {replyTo.senderId === user?.uid
                  ? "yourself"
                  : otherUser?.displayName}
              </Text>
              <Text
                style={[styles.replyPreview, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {replyTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Editing Banner */}
        {editingMsg && (
          <View
            style={[
              styles.replyBanner,
              {
                backgroundColor: theme.surfaceElevated,
                borderLeftColor: "#FF9100",
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyLabel, { color: "#FF9100" }]}>
                Editing message...
              </Text>
              <Text
                style={[styles.replyPreview, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {editingMsg.text}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingMsg(null);
                setInputText("");
              }}
            >
              <Ionicons name="close" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Block Banner vs Input Bar */}
        {isBlockedByMe ? (
          <View
            style={[
              styles.blockedBanner,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            <Ionicons name="ban-outline" size={18} color="#FF1744" style={{ marginRight: 8 }} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1, fontWeight: "600" }}>
              You have blocked this contact.
            </Text>
            <TouchableOpacity
              onPress={async () => {
                if (!user || !otherUser) return;
                try {
                  await updateDoc(doc(db, "users", user.uid), {
                    blockedUsers: arrayRemove(otherUser.uid),
                  });
                  Alert.alert("Success", `${otherUser.displayName} has been unblocked.`);
                } catch (err) {
                  console.error("Error unblocking:", err);
                  Alert.alert("Error", "Could not unblock user.");
                }
              }}
              style={{
                backgroundColor: theme.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Unblock</Text>
            </TouchableOpacity>
          </View>
        ) : isBlockedByThem ? (
          <View
            style={[
              styles.blockedBanner,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={theme.textTertiary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: "600", flex: 1 }}>
              This contact is not receiving messages right now.
            </Text>
          </View>
        ) : (
          <>
            {/* Quick Emoji Bar */}
            <View style={[styles.quickEmojiBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
              {["❤️", "😂", "🔥", "👍", "🙌", "😍", "🎉", "✨"].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleEmojiSelect(emoji)}
                  style={styles.quickEmojiItem}
                  activeOpacity={0.65}
                >
                  <Text style={styles.quickEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input Bar */}
            <View
              style={[
                styles.inputBar,
                { backgroundColor: theme.surface, borderTopColor: theme.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => setAttachmentModalVisible(true)}
                style={[styles.inputAction, { backgroundColor: theme.inputBg }]}
              >
                <Ionicons name="attach" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              <View style={[styles.inputWrap, { backgroundColor: theme.inputBg }]}>
                <TextInput
                  ref={inputRef}
                  value={inputText}
                  onChangeText={handleTyping}
                  onKeyPress={handleInputKeyPress}
                  placeholder="Type a message..."
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  maxLength={2000}
                  style={[styles.input, { color: theme.text }]}
                  returnKeyType="default"
                />
                <TouchableOpacity
                  style={styles.emojiBtn}
                  onPress={() => setEmojiPickerVisible(true)}
                >
                  <Ionicons
                    name="happy-outline"
                    size={20}
                    color={theme.textTertiary}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={
                    inputText.trim()
                      ? [theme.primary, theme.secondary]
                      : [theme.surfaceElevated, theme.surfaceElevated]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtn}
                >
                  <Ionicons
                    name="send"
                    size={18}
                    color={inputText.trim() ? "#fff" : theme.textTertiary}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* Premium Upgraded Messenger Context Menu & Action Sheet */}
      <Modal
        visible={reactionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setReactionModalVisible(false);
          setSelectedMsg(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setReactionModalVisible(false);
            setSelectedMsg(null);
          }}
        >
          <View
            style={[
              styles.reactionPicker,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                paddingBottom: 16,
              },
            ]}
          >
            {/* Quick Emoji reactions header */}
            <Text
              style={[
                styles.reactionTitle,
                { color: theme.textSecondary, marginBottom: 8 },
              ]}
            >
              React to message
            </Text>
            <View style={styles.reactionRow}>
              {REACTIONS.map((emoji) => {
                const alreadyReacted =
                  selectedMsg?.reactions?.[emoji]?.includes(user?.uid || "") || false;
                return (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleReaction(emoji)}
                    style={[
                      styles.reactionOption,
                      alreadyReacted && {
                        backgroundColor: theme.primary + "20",
                        borderRadius: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reactionEmoji,
                        alreadyReacted && { scaleX: 1.1, scaleY: 1.1 },
                      ]}
                    >
                      {emoji}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.reactionDivider,
                { backgroundColor: theme.border, marginVertical: 12 },
              ]}
            />

            {/* Menu Actions */}
            <TouchableOpacity
              onPress={() => {
                setReactionModalVisible(false);
                if (selectedMsg) setReplyTo(selectedMsg);
                setSelectedMsg(null);
              }}
              style={styles.reactionAction}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={20}
                color={theme.text}
              />
              <Text style={[styles.reactionActionText, { color: theme.text }]}>
                Reply
              </Text>
            </TouchableOpacity>

            {selectedMsg?.text && (
              <TouchableOpacity
                onPress={() => handleCopy(selectedMsg.text!)}
                style={styles.reactionAction}
              >
                <Ionicons name="copy-outline" size={20} color={theme.text} />
                <Text
                  style={[styles.reactionActionText, { color: theme.text }]}
                >
                  Copy Text
                </Text>
              </TouchableOpacity>
            )}

            {selectedMsg?.type === "image" && selectedMsg?.mediaUrl && (
              <TouchableOpacity
                onPress={() => {
                  setReactionModalVisible(false);
                  handleDownload(selectedMsg.mediaUrl!);
                  setSelectedMsg(null);
                }}
                style={styles.reactionAction}
              >
                <Ionicons
                  name="download-outline"
                  size={20}
                  color={theme.text}
                />
                <Text
                  style={[styles.reactionActionText, { color: theme.text }]}
                >
                  Download Image
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={openForwardModal}
              style={styles.reactionAction}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={20}
                color={theme.text}
              />
              <Text style={[styles.reactionActionText, { color: theme.text }]}>
                Forward Message
              </Text>
            </TouchableOpacity>

            {selectedMsg?.senderId === user?.uid &&
              selectedMsg?.type !== "image" &&
              selectedMsg?.type !== "video" && (
                <TouchableOpacity
                  onPress={() => {
                    if (selectedMsg) {
                      setReactionModalVisible(false);
                      setEditingMsg(selectedMsg);
                      setInputText(selectedMsg.text || "");
                      setTimeout(() => inputRef.current?.focus(), 150);
                    }
                  }}
                  style={styles.reactionAction}
                >
                  <Ionicons name="create-outline" size={20} color="#FF9100" />
                  <Text
                    style={[styles.reactionActionText, { color: "#FF9100" }]}
                  >
                    Edit Message
                  </Text>
                </TouchableOpacity>
              )}

            <TouchableOpacity
              onPress={() => handleDelete(selectedMsg!.id)}
              style={styles.reactionAction}
            >
              <Ionicons name="trash-outline" size={20} color="#FF1744" />
              <Text style={[styles.reactionActionText, { color: "#FF1744" }]}>
                Delete Message
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Attachment Picker Modal */}
      <Modal
        visible={attachmentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachmentModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAttachmentModalVisible(false)}
        >
          <View
            style={[
              styles.attachmentSheet,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text
              style={[styles.attachmentTitle, { color: theme.textSecondary }]}
            >
              Share Media
            </Text>
            <View style={styles.attachmentGrid}>
              <TouchableOpacity
                onPress={() => pickMedia("camera", "image")}
                style={styles.attachmentBtn}
              >
                <LinearGradient
                  colors={["#FF5252", "#FF1744"]}
                  style={styles.attachmentIconWrap}
                >
                  <Ionicons name="camera" size={24} color="#fff" />
                </LinearGradient>
                <Text style={[styles.attachmentText, { color: theme.text }]}>
                  Camera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => pickMedia("library", "image")}
                style={styles.attachmentBtn}
              >
                <LinearGradient
                  colors={["#448AFF", "#2979FF"]}
                  style={styles.attachmentIconWrap}
                >
                  <Ionicons name="image" size={24} color="#fff" />
                </LinearGradient>
                <Text style={[styles.attachmentText, { color: theme.text }]}>
                  Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => pickMedia("library", "video")}
                style={styles.attachmentBtn}
              >
                <LinearGradient
                  colors={["#E040FB", "#D500F9"]}
                  style={styles.attachmentIconWrap}
                >
                  <Ionicons name="videocam" size={24} color="#fff" />
                </LinearGradient>
                <Text style={[styles.attachmentText, { color: theme.text }]}>
                  Video
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setAttachmentModalVisible(false)}
              style={[
                styles.attachmentCloseBtn,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Text style={[styles.attachmentCloseText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Call Screen Overlay */}
      {callState && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { zIndex: 9999, backgroundColor: theme.background },
          ]}
        >
          <LinearGradient
            colors={[theme.background, "#121212"]}
            style={styles.callContainer}
          >
            {/* Top Info */}
            <View style={styles.callHeader}>
              <Ionicons
                name={callType === "video" ? "videocam" : "call"}
                size={20}
                color="rgba(255,255,255,0.6)"
              />
              <Text style={styles.callTypeText}>
                {callType === "video" ? "VIDEO CALL" : "VOICE CALL"}
              </Text>
            </View>

            {/* Video Preview */}
            {callType === "video" &&
              callState === "connected" &&
              isCameraOn && (
                <LinearGradient
                  colors={[theme.primary, theme.secondary]}
                  style={StyleSheet.absoluteFillObject}
                >
                  <View style={styles.videoPlaceholder}>
                    <Ionicons
                      name="person"
                      size={100}
                      color="rgba(255,255,255,0.3)"
                    />
                    <Text style={styles.videoPlaceholderText}>
                      Camera Preview
                    </Text>
                  </View>
                </LinearGradient>
              )}

            {/* Profile Avatar & Call Status */}
            <View style={styles.callProfileWrap}>
              <View style={styles.callAvatarOutline}>
                <GradientAvatar
                  name={otherUser?.displayName || "Friend"}
                  photoURL={otherUser?.photoURL}
                  size={120}
                />
              </View>
              <Text style={styles.callName}>
                {otherUser?.displayName || "Friend"}
              </Text>

              <Text style={styles.callStatusText}>
                {callState === "calling" && "Calling..."}
                {callState === "ringing" && "Ringing..."}
                {callState === "connected" && formatCallDuration(callSeconds)}
              </Text>
            </View>

            {/* Controls Bar */}
            <View style={styles.callControls}>
              <TouchableOpacity
                onPress={() => setIsMuted(!isMuted)}
                style={[styles.callBtn, isMuted && styles.callBtnActive]}
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              {callType === "video" ? (
                <TouchableOpacity
                  onPress={() => setIsCameraOn(!isCameraOn)}
                  style={[styles.callBtn, !isCameraOn && styles.callBtnActive]}
                >
                  <Ionicons
                    name={isCameraOn ? "videocam" : "videocam-off"}
                    size={24}
                    color="#fff"
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                  style={[styles.callBtn, isSpeakerOn && styles.callBtnActive]}
                >
                  <Ionicons name="volume-high" size={24} color="#fff" />
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
        </View>
      )}

      {/* 1. Sleek Full-Screen Image Viewer Modal with pinch-to-zoom-ready ScrollView */}
      <Modal
        visible={!!activeViewerImage}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setActiveViewerImage(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Top Header Controls */}
          <View
            style={{
              position: "absolute",
              top: 50,
              left: 16,
              right: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              zIndex: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => setActiveViewerImage(null)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (activeViewerImage) {
                  handleDownload(activeViewerImage);
                }
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Pinch-to-Zoom Ready ScrollView - Centered & collapse-proof style */}
          {activeViewerImage && (
            <ScrollView
              maximumZoomScale={3.0}
              minimumZoomScale={1.0}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={{ width: "100%", height: "100%" }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Image
                source={{ uri: activeViewerImage }}
                style={{ width: "95%", height: "85%" }}
                contentFit="contain"
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* WhatsApp/Messenger-style Media Caption Modal */}
      {pendingMedia && (
        <Modal
          visible={!!pendingMedia}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setPendingMedia(null)}
        >
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            {/* Top Bar with Cancel Button */}
            <View
              style={{
                position: "absolute",
                top: 50,
                left: 16,
                right: 16,
                flexDirection: "row",
                justifyContent: "space-between",
                zIndex: 10,
              }}
            >
              <TouchableOpacity
                onPress={() => setPendingMedia(null)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", alignSelf: "center" }}>
                Preview {pendingMedia.type === "image" ? "Photo" : "Video"}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Media Preview Area */}
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 100 }}>
              {pendingMedia.type === "image" ? (
                <Image
                  source={{ uri: pendingMedia.uri }}
                  style={{ width: "100%", height: "70%" }}
                  contentFit="contain"
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    height: "70%",
                    backgroundColor: "#111",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="videocam" size={80} color="#fff" style={{ opacity: 0.8 }} />
                  <Text style={{ color: "#fff", marginTop: 12, fontSize: 16, opacity: 0.6 }}>
                    Video selected
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom Caption Input Bar */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
            >
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.95)"]}
                style={{
                  paddingHorizontal: 16,
                  paddingBottom: 24,
                  paddingTop: 40,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {/* FIX: Changed background from light to dark so white text is visible */}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(0,0,0,0.5)",
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                >
                  <TextInput
                    style={{ flex: 1, color: "#fff", fontSize: 15, maxHeight: 80, paddingVertical: 0 }}
                    placeholder="Add a caption..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={captionText}
                    onChangeText={setCaptionText}
                    multiline
                  />
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    const media = pendingMedia;
                    const text = captionText;
                    setPendingMedia(null);
                    setCaptionText("");
                    await uploadAndSendMedia(media.uri, media.type, text);
                  }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: theme.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </LinearGradient>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* 2. Sleek Premium Forward Message Sheet */}
      <Modal
        visible={forwardModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setForwardModalVisible(false)}
        >
          <View
            style={[
              styles.attachmentSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                height: "60%",
              },
            ]}
          >
            <Text
              style={[styles.attachmentTitle, { color: theme.textSecondary }]}
            >
              Forward message to...
            </Text>

            {loadingFriends ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.textSecondary }}>
                  Loading friends...
                </Text>
              </View>
            ) : friends.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: theme.textSecondary }}>
                  No contacts found to forward.
                </Text>
              </View>
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={{ paddingVertical: 8 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <GradientAvatar
                      name={item.displayName || "User"}
                      photoURL={item.photoURL}
                      size={40}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: theme.text,
                        }}
                      >
                        {item.displayName || "Friend"}
                      </Text>
                      <Text
                        style={{ fontSize: 12, color: theme.textSecondary }}
                        numberOfLines={1}
                      >
                        {item.email || "Messenger active"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => forwardMessage(item)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        backgroundColor: theme.primary,
                        borderRadius: 16,
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
                        Send
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              onPress={() => setForwardModalVisible(false)}
              style={[
                styles.attachmentCloseBtn,
                { backgroundColor: theme.surfaceElevated, marginTop: 12 },
              ]}
            >
              <Text style={[styles.attachmentCloseText, { color: theme.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Group Settings Modal */}
      <Modal
        visible={groupSettingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGroupSettingsVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setGroupSettingsVisible(false)}
        >
          <View
            style={[
              styles.groupSettingsSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            {/* Handle Bar for Premium Drag Feel */}
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              {/* Group Avatar and Header */}
              <View style={styles.groupSettingsHeader}>
                <GradientAvatar
                  name={chatTitle || "?"}
                  photoURL={chatPhotoURL}
                  size={70}
                />
                <Text style={[styles.groupSettingsName, { color: theme.text }]}>
                  {chatTitle}
                </Text>
                <Text style={[styles.groupSettingsSubtitle, { color: theme.textSecondary }]}>
                  {chatSubtitle}
                </Text>
              </View>

              {/* Members Section */}
              <View style={styles.groupSettingsSection}>
                <Text
                  style={[
                    styles.groupSettingsSecTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Group Members ({groupMembers.length})
                </Text>
                <View style={styles.groupMembersList}>
                  {groupMembers.map((member) => {
                    const isAdmin = chatInfo?.admins?.includes(member.uid);
                    const isCreator = chatInfo?.createdBy === member.uid;
                    const isCurrentUserAdmin = chatInfo?.admins?.includes(user?.uid) || chatInfo?.createdBy === user?.uid;
                    return (
                      <View
                        key={member.uid}
                        style={[
                          styles.memberItem,
                          { borderBottomColor: theme.border },
                        ]}
                      >
                        <GradientAvatar
                          name={member.displayName || "?"}
                          photoURL={member.photoURL}
                          size={36}
                          isOnline={member.isOnline}
                          showStatus
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text
                            style={[
                              styles.memberName,
                              { color: theme.text },
                            ]}
                          >
                            {member.displayName} {member.uid === user?.uid && "(You)"}
                          </Text>
                          <Text
                            style={[
                              styles.memberEmail,
                              { color: theme.textTertiary },
                            ]}
                            numberOfLines={1}
                          >
                            {member.email}
                          </Text>
                        </View>
                        {(isAdmin || isCreator) && (
                          <View
                            style={[
                              styles.adminBadge,
                              { backgroundColor: theme.primary + "15", marginRight: (isCurrentUserAdmin && member.uid !== user?.uid) ? 8 : 0 },
                            ]}
                          >
                            <Text style={{ color: theme.primary, fontSize: 10, fontWeight: "700" }}>
                              {isCreator ? "Creator" : "Admin"}
                            </Text>
                          </View>
                        )}
                        {/* Remove/Delete Member Button */}
                        {isCurrentUserAdmin && member.uid !== user?.uid && (
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(member)}
                            style={[styles.removeMemberBtn, { backgroundColor: 'rgba(255,23,73,0.1)' }]}
                          >
                            <Ionicons name="trash-outline" size={16} color="#FF1744" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Actions Section */}
              <View style={styles.groupSettingsSection}>
                <Text
                  style={[
                    styles.groupSettingsSecTitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  Actions
                </Text>
                <View
                  style={[
                    styles.actionsContainer,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  {/* Leave Group */}
                  <TouchableOpacity
                    onPress={handleLeaveGroup}
                    style={styles.actionRowBtn}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#FF1744" />
                    <Text style={[styles.actionRowText, { color: "#FF1744" }]}>
                      Leave Group
                    </Text>
                  </TouchableOpacity>

                  {/* Delete Group (Admins or Creator only) */}
                  {(chatInfo?.admins?.includes(user?.uid) || chatInfo?.createdBy === user?.uid) && (
                    <>
                      <View
                        style={[
                          styles.actionDivider,
                          { backgroundColor: theme.border },
                        ]}
                      />
                      <TouchableOpacity
                        onPress={handleDeleteGroup}
                        style={styles.actionRowBtn}
                      >
                        <Ionicons name="trash-outline" size={20} color="#FF1744" />
                        <Text style={[styles.actionRowText, { color: "#FF1744" }]}>
                          Delete Group (Admin Action)
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Reactions Viewer Modal */}
      <Modal
        visible={reactorModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReactorModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReactorModalVisible(false)}
        >
          <View
            style={[
              styles.reactorsSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            {/* Handle Bar for Premium Drag Feel */}
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.reactorsHeader}>
              <Text style={[styles.reactorsTitle, { color: theme.text }]}>
                Reacted with {activeReactorEmoji}
              </Text>
              <Text style={[styles.reactorsSubtitle, { color: theme.textSecondary }]}>
                {activeReactorsList.length} {activeReactorsList.length === 1 ? "person" : "people"}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.reactorsList}>
                {activeReactorsList.map((uid) => {
                  const reactorProfile = resolveReactorProfile(uid);
                  return (
                    <View
                      key={uid}
                      style={[
                        styles.reactorItem,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <GradientAvatar
                        name={reactorProfile.displayName || "?"}
                        photoURL={reactorProfile.photoURL}
                        size={38}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.reactorName, { color: theme.text }]}>
                          {reactorProfile.displayName}
                        </Text>
                        {reactorProfile.email ? (
                          <Text style={[styles.reactorEmail, { color: theme.textTertiary }]} numberOfLines={1}>
                            {reactorProfile.email}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.reactorEmojiBadge, { backgroundColor: theme.surface }]}>
                        <Text style={{ fontSize: 18 }}>{activeReactorEmoji}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setReactorModalVisible(false)}
              style={[
                styles.reactorsCloseBtn,
                { backgroundColor: theme.surfaceElevated, marginTop: 12 },
              ]}
            >
              <Text style={[styles.reactorsCloseText, { color: theme.text }]}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal
        visible={emojiPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEmojiPickerVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEmojiPickerVisible(false)}
        >
          <View
            style={[
              styles.emojiSheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
          >
            {/* Drag Handle Bar for Premium Feel */}
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.emojiSheetHeader}>
              <Text style={[styles.emojiSheetTitle, { color: theme.text }]}>
                Select Emojis
              </Text>
              <Text style={[styles.emojiSheetSubtitle, { color: theme.textSecondary }]}>
                Tap to append emojis to your message
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {EMOJI_CATEGORIES.map((category) => (
                <View key={category.title} style={styles.emojiCategoryBlock}>
                  <Text style={[styles.emojiCategoryTitle, { color: theme.textSecondary }]}>
                    {category.title}
                  </Text>
                  <View style={styles.emojiGrid}>
                    {category.emojis.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        onPress={() => {
                          handleEmojiSelect(emoji);
                          setEmojiPickerVisible(false); // FIX: close picker so input is visible
                        }}
                        activeOpacity={0.6}
                        style={[styles.emojiGridItem, { backgroundColor: theme.surface }]}
                      >
                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setEmojiPickerVisible(false)}
              style={[
                styles.emojiSheetCloseBtn,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Text style={[styles.emojiSheetCloseText, { color: theme.text }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const EMOJI_CATEGORIES = [
  {
    title: "Smileys & Expressions",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"]
  },
  {
    title: "Hearts & Gestures",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "🤝", "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "✍️", "👏", "🙌", "👐", "🙏"]
  },
  {
    title: "Animals & Food & Nature",
    emojis: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐣", "🦆", "🦅", "🦉", "🐝", "🦋", "🐙", "🐠", "🐬", "🐳", "🐊", "🦖", "🦓", "🐘", "🐪", "🦒", "🐕", "🐈", "🐓", "🕊️", "🐇", "🍎", "🍉", "🍓", "🍕", "🍔", "🍟", "🍩", "🍺", "☕", "☀️", "🌙", "⭐", "🌈", "🔥", "⚡", "❄️", "🍀", "🌸"]
  }
];

const formatCallDuration = (sec: number): string => {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  userInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  userMeta: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "700" },
  userOnline: { fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 8 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: 3,
    gap: 10,
  },
  replyLabel: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyPreview: { fontSize: 13 },
  blockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 24 : 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 120,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, maxHeight: 100, paddingVertical: 0 },
  emojiBtn: { alignSelf: "flex-end", paddingBottom: 2 },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionPicker: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    width: 280,
    gap: 12,
  },
  reactionTitle: { fontSize: 12, textAlign: "center", fontWeight: "600" },
  reactionRow: { flexDirection: "row", justifyContent: "space-between" },
  reactionOption: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  reactionEmoji: { fontSize: 26 },
  reactionDivider: { height: StyleSheet.hairlineWidth },
  reactionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  reactionActionText: { fontSize: 15, fontWeight: "500" },
  // Call Screen Styles
  callContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  callHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.8,
  },
  callTypeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  callProfileWrap: {
    alignItems: "center",
    gap: 16,
  },
  callAvatarOutline: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 70,
    padding: 8,
  },
  callName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  callStatusText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "600",
  },
  callControls: {
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
    zIndex: 10,
  },
  callBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  callBtnActive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  callBtnEnd: {
    backgroundColor: "#FF1744",
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  videoPlaceholderText: {
    color: "#fff",
    marginTop: 16,
    fontSize: 14,
    opacity: 0.7,
  },
  // Attachment sheet styles
  attachmentSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    width: "100%",
    position: "absolute",
    bottom: 0,
    gap: 20,
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  attachmentGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
  },
  attachmentBtn: {
    alignItems: "center",
    gap: 8,
  },
  attachmentIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  attachmentCloseBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  attachmentCloseText: {
    fontSize: 15,
    fontWeight: "700",
  },
  groupSettingsSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    width: "100%",
    height: "75%",
    position: "absolute",
    bottom: 0,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
    marginBottom: 20,
  },
  groupSettingsHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  groupSettingsName: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  groupSettingsSubtitle: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.8,
  },
  groupSettingsSection: {
    marginBottom: 24,
  },
  groupSettingsSecTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  groupMembersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
  },
  memberEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionsContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  actionRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
  },
  removeMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  reactorsSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    width: "100%",
    maxHeight: "50%",
    position: "absolute",
    bottom: 0,
  },
  reactorsHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  reactorsTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  reactorsSubtitle: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  reactorsList: {
    gap: 12,
  },
  reactorItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reactorName: {
    fontSize: 14,
    fontWeight: "600",
  },
  reactorEmail: {
    fontSize: 11,
    marginTop: 2,
  },
  reactorEmojiBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  reactorsCloseBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  reactorsCloseText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emojiSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    width: "100%",
    height: "55%",
    position: "absolute",
    bottom: 0,
  },
  emojiSheetHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  emojiSheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emojiSheetSubtitle: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  emojiCategoryBlock: {
    marginBottom: 20,
  },
  emojiCategoryTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emojiGridItem: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emojiSheetCloseBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  emojiSheetCloseText: {
    fontSize: 14,
    fontWeight: "700",
  },
  quickEmojiBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
  },
  quickEmojiItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickEmojiText: {
    fontSize: 20,
  },
});