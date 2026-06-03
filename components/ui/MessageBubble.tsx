import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GradientAvatar } from './GradientAvatar';
import { Typography } from '@/constants/theme';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  replyTo?: { id: string; text: string; senderName: string } | null;
  reactions?: { [emoji: string]: string[] };
  type?: 'text' | 'image' | 'video';
  mediaUrl?: string;
  deletedFor?: string[];
  isEdited?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  showTime?: boolean;
  onLongPress?: () => void;
  onReply?: () => void;
  onImagePress?: (url: string) => void;
  onReactionPress?: (emoji: string, uids: string[]) => void;
  senderName?: string;
  senderPhotoURL?: string | null;
  isGroup?: boolean;
}

function formatTime(ts: any): string {
  const date = !ts ? new Date() : (ts.toDate ? ts.toDate() : new Date(ts));
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function MessageBubble({
  message,
  isMe,
  showTime = true,
  onLongPress,
  onReply,
  onImagePress,
  onReactionPress,
  senderName,
  senderPhotoURL,
  isGroup = false,
}: MessageBubbleProps) {
  const { theme, fontSizeMultiplier } = useTheme();

  const bubbleColor = isMe ? theme.myBubble : theme.theirBubble;
  const textColor = isMe ? theme.myBubbleText : theme.theirBubbleText;
  const reactions = message.reactions
    ? Object.entries(message.reactions).filter(([_, users]) => Array.isArray(users) && users.length > 0)
    : [];

  const resolvedSenderName = senderName || "Someone";

  return (
    <View style={[styles.rowContainer, isMe ? styles.rowContainerRight : styles.rowContainerLeft]}>
      {!isMe && (
        <View style={styles.avatarWrapper}>
          <GradientAvatar name={resolvedSenderName} photoURL={senderPhotoURL} size={30} />
        </View>
      )}

      <View style={[styles.bubbleWrapper, isMe ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft]}>
        {!isMe && isGroup && senderName && (
          <Text style={[styles.senderNameText, { color: theme.textSecondary }]}>
            {senderName}
          </Text>
        )}

        {/* Reply context */}
        {message.replyTo && (
          <View
            style={[
              styles.replyBox,
              {
                borderLeftColor: theme.primary,
                backgroundColor: isMe
                  ? 'rgba(255,255,255,0.15)'
                  : theme.surfaceElevated,
                alignSelf: isMe ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <Text style={[styles.replyName, { color: theme.primary }]}>
              {message.replyTo.senderName}
            </Text>
            <Text style={[styles.replyText, { color: theme.textSecondary }]} numberOfLines={1}>
              {message.replyTo.text}
            </Text>
          </View>
        )}

        {/* Bubble */}
        <TouchableOpacity
          onLongPress={onLongPress}
          activeOpacity={0.85}
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleColor,
              borderBottomRightRadius: isMe ? 4 : 18,
              borderBottomLeftRadius: isMe ? 18 : 4,
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              paddingHorizontal: message.type && message.type !== 'text' ? 6 : 14,
              paddingTop: message.type && message.type !== 'text' ? 6 : 10,
              paddingBottom: 6,
            },
          ]}
        >
          {message.type === 'image' && message.mediaUrl && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress?.(message.mediaUrl!)}>
              <Image
                source={{ uri: message.mediaUrl }}
                style={styles.mediaImage}
                contentFit="cover"
                transition={200}
              />
            </TouchableOpacity>
          )}

          {/* Video fallback text since expo-av is removed */}
          {message.type === 'video' && (
            <View style={styles.mediaVideoPlaceholder}>
              <Ionicons name="videocam" size={24} color={textColor} />
              <Text style={{ color: textColor, marginLeft: 8, fontSize: 13 }}>Video message</Text>
            </View>
          )}

          {message.text ? (
            <Text
              style={[
                styles.text,
                {
                  color: textColor,
                  fontSize: 15 * (fontSizeMultiplier || 1),
                  lineHeight: 22 * (fontSizeMultiplier || 1),
                  paddingHorizontal: message.type && message.type !== 'text' ? 8 : 0,
                  marginTop: message.type && message.type !== 'text' ? 8 : 0,
                },
              ]}
            >
              {message.text}
            </Text>
          ) : null}

          {/* Time + status */}
          <View style={[styles.meta, { justifyContent: isMe ? 'flex-end' : 'flex-start', paddingHorizontal: message.type && message.type !== 'text' ? 8 : 0 }]}>
            <Text style={[styles.time, { color: isMe ? 'rgba(255,255,255,0.65)' : theme.textTertiary }]}>
              {formatTime(message.createdAt)}
            </Text>
            {message.isEdited && (
              <Text style={[styles.editedLabel, { color: isMe ? 'rgba(255,255,255,0.65)' : theme.textTertiary }]}>Edited</Text>
            )}
            {isMe && (
              <Ionicons
                name={
                  message.status === 'read'
                    ? 'checkmark-done'
                    : message.status === 'delivered'
                      ? 'checkmark-done'
                      : 'checkmark'
                }
                size={13}
                color={message.status === 'read' ? '#00D4AA' : 'rgba(255,255,255,0.65)'}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Reactions */}
        {reactions.length > 0 && (
          <View style={[styles.reactions, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
            {reactions.map(([emoji, users]) => (
              <TouchableOpacity
                key={emoji}
                activeOpacity={0.7}
                onPress={() => onReactionPress?.(emoji, users)}
                style={[styles.reaction, { backgroundColor: theme.surfaceElevated }]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {users.length > 1 && (
                  <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>
                    {users.length}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 16,
    width: '100%',
  },
  rowContainerRight: {
    justifyContent: 'flex-end',
  },
  rowContainerLeft: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  avatarWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  bubbleWrapper: {
    maxWidth: '80%',
  },
  editedLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    marginLeft: 6,
    alignSelf: 'center',
    fontStyle: 'italic',
  },
  bubbleWrapperRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapperLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderNameText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  text: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  time: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
  },
  replyBox: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    paddingRight: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  replyName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
    fontWeight: '600',
  },
  mediaImage: {
    width: 240,
    height: 180,
    borderRadius: 14,
  },
  mediaVideoPlaceholder: {
    width: 240,
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});