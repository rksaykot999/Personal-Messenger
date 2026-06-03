import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { GradientAvatar } from './GradientAvatar';

interface TypingIndicatorProps {
  displayName?: string;
  photoURL?: string | null;
}

export function TypingIndicator({ displayName, photoURL }: TypingIndicatorProps) {
  const { theme } = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -5, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(500),
        ])
      );

    Animated.parallel([
      animate(dot1, 0),
      animate(dot2, 120),
      animate(dot3, 240),
    ]).start();
  }, []);

  if (displayName) {
    return (
      <View style={styles.typingRow}>
        <GradientAvatar name={displayName} photoURL={photoURL} size={28} />
        <View style={[styles.bubbleContainer, { backgroundColor: theme.theirBubble }]}>
          <Text style={[styles.typingText, { color: theme.textSecondary }]}>
            {displayName} is typing
          </Text>
          <View style={styles.dotsRow}>
            {[dot1, dot2, dot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: theme.textSecondary, transform: [{ translateY: dot }] },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Fallback to simple dots capsule
  return (
    <View style={[styles.container, { backgroundColor: theme.theirBubble }]}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: theme.textSecondary, transform: [{ translateY: dot }] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 16,
    marginVertical: 6,
    alignSelf: 'flex-start',
  },
  bubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    gap: 8,
  },
  typingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    height: 10,
    marginTop: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    gap: 4,
    alignSelf: 'flex-start',
    marginLeft: 48,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
