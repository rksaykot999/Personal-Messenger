import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, TouchableWithoutFeedback, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GradientAvatar } from './GradientAvatar';
import { useTheme } from '@/contexts/ThemeContext';

interface ChatListItemProps {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  isOnline?: boolean;
  photoURL?: string | null;
  isTyping?: boolean;
  isSent?: boolean;
  isRead?: boolean;
  onPress: () => void;
  onRemove?: (id: string) => void;
}

interface ContextMenuItem {
  icon: string;
  label: string;
  color?: string;
  onPress: () => void;
}

export function ChatListItem({
  id,
  name,
  lastMessage,
  time,
  unreadCount = 0,
  isOnline = false,
  photoURL,
  isTyping = false,
  isSent = false,
  isRead = false,
  onPress,
  onRemove,
}: ChatListItemProps) {
  const { theme } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const menuAnim = useRef(new Animated.Value(0.85)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(menuAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
    ]).start();
  };

  const closeMenu = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(menuAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
      backdropAnim.setValue(0);
      menuAnim.setValue(0.85);
      callback?.();
    });
  };

  const menuItems: ContextMenuItem[] = [
    {
      icon: 'chatbubble-outline',
      label: 'Open Chat',
      onPress: () => closeMenu(onPress),
    },
    {
      icon: 'notifications-off-outline',
      label: 'Mute Notifications',
      onPress: () => closeMenu(),
    },
    {
      icon: 'checkmark-done-outline',
      label: 'Mark as Read',
      onPress: () => closeMenu(),
    },
    {
      icon: 'archive-outline',
      label: 'Archive Chat',
      onPress: () => closeMenu(),
    },
    {
      icon: 'person-remove-outline',
      label: 'Remove Account',
      color: '#FF453A',
      onPress: () => closeMenu(() => onRemove?.(id)),
    },
  ];

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={openMenu}
        delayLongPress={350}
        android_ripple={{ color: `${theme.primary}22` }}
        style={({ pressed }) => [
          styles.container,
          { borderBottomColor: theme.border },
          pressed && { opacity: 0.85 },
        ]}
      >
        {/* Avatar with online dot */}
        <GradientAvatar
          name={name}
          size={54}
          photoURL={photoURL}
          isOnline={isOnline}
          showStatus
        />

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[
                styles.name,
                { color: theme.text, fontWeight: unreadCount > 0 ? '700' : '600' },
              ]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text
              style={[
                styles.time,
                { color: unreadCount > 0 ? theme.primary : theme.textTertiary },
              ]}
            >
              {time}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.messageRow}>
              {isSent && !isTyping && (
                <Ionicons
                  name={isRead ? 'checkmark-done' : 'checkmark'}
                  size={15}
                  color={isRead ? '#00D4AA' : theme.textTertiary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.message,
                  {
                    color: isTyping ? theme.primary : theme.textSecondary,
                    fontStyle: isTyping ? 'italic' : 'normal',
                    fontWeight: unreadCount > 0 ? '500' : '400',
                    flex: 1,
                  },
                ]}
              >
                {isTyping ? 'typing...' : (isSent ? `You: ${lastMessage}` : lastMessage)}
              </Text>
            </View>

            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {/* Long Press Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeMenu()}
      >
        <TouchableWithoutFeedback onPress={() => closeMenu()}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropAnim },
            ]}
          />
        </TouchableWithoutFeedback>

        <View style={styles.menuWrapper} pointerEvents="box-none">
          {/* Preview Card */}
          <Animated.View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                transform: [{ scale: menuAnim }],
                opacity: menuAnim,
              },
            ]}
          >
            <GradientAvatar
              name={name}
              size={48}
              photoURL={photoURL}
              isOnline={isOnline}
              showStatus
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.previewName, { color: theme.text }]}>{name}</Text>
              <Text style={[styles.previewMsg, { color: theme.textSecondary }]} numberOfLines={1}>
                {lastMessage}
              </Text>
            </View>
          </Animated.View>

          {/* Menu Items */}
          <Animated.View
            style={[
              styles.menuContainer,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                transform: [{ scale: menuAnim }],
                opacity: menuAnim,
              },
            ]}
          >
            {menuItems.map((item, index) => (
              <React.Fragment key={item.label}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.menuItem}
                  onPress={item.onPress}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={item.color || theme.text}
                    style={{ marginRight: 14 }}
                  />
                  <Text
                    style={[
                      styles.menuLabel,
                      { color: item.color || theme.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
                {index < menuItems.length - 1 && (
                  <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
                )}
              </React.Fragment>
            ))}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  content: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: { fontSize: 16, flex: 1, marginRight: 8 },
  time: { fontSize: 12 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  message: { fontSize: 14 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Modal styles
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  menuWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewMsg: {
    fontSize: 13,
    marginTop: 2,
  },
  menuContainer: {
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
});
