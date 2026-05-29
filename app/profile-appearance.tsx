import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, FontSizeMode } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileAppearanceScreen() {
  const { theme, isDark, toggleTheme, fontSize, changeFontSize, fontSizeMultiplier } = useTheme();
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;

  const fontSizes: { key: FontSizeMode; label: string; desc: string }[] = [
    { key: 'small', label: 'Aa', desc: 'Small' },
    { key: 'medium', label: 'Aa', desc: 'Medium' },
    { key: 'large', label: 'Aa', desc: 'Large' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Appearance & Styles</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Real-time Font Preview Container */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CHAT PREVIEW</Text>
        </View>
        <View style={[styles.previewContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Incoming message preview */}
          <View style={styles.previewIncomingRow}>
            <View style={[styles.previewAvatar, { backgroundColor: theme.primary + '30' }]}>
              <Text style={[styles.previewAvatarText, { color: theme.primary }]}>D</Text>
            </View>
            <View style={[styles.previewBubble, { backgroundColor: theme.theirBubble }]}>
              <Text style={[styles.previewBubbleText, { color: theme.theirBubbleText, fontSize: 14 * fontSizeMultiplier, lineHeight: 20 * fontSizeMultiplier }]}>
                Hey! Try changing the font size...
              </Text>
              <Text style={[styles.previewTime, { color: theme.textTertiary }]}>10:41 AM</Text>
            </View>
          </View>

          {/* Outgoing message preview */}
          <View style={styles.previewOutgoingRow}>
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.previewBubble, styles.previewBubbleRight]}
            >
              <Text style={[styles.previewBubbleText, { color: theme.myBubbleText, fontSize: 14 * fontSizeMultiplier, lineHeight: 20 * fontSizeMultiplier }]}>
                Wow! This is amazing, it responds instantly! 😍
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.previewTime, { color: 'rgba(255,255,255,0.7)' }]}>10:42 AM</Text>
                <Ionicons name="checkmark-done" size={13} color="#00D4AA" style={{ marginLeft: 3 }} />
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Font Size Selector Card */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TEXT SIZING</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 16, gap: 16 }]}>
          <View style={styles.sizesRow}>
            {fontSizes.map((item) => {
              const isSelected = fontSize === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => changeFontSize(item.key)}
                  activeOpacity={0.85}
                  style={[
                    styles.sizeBtn,
                    isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : { backgroundColor: theme.surfaceElevated, borderColor: theme.border }
                  ]}
                >
                  <Text style={[
                    styles.sizeLabel,
                    { fontSize: item.key === 'small' ? 12 : item.key === 'medium' ? 15 : 19 },
                    isSelected ? { color: '#fff', fontWeight: '800' } : { color: theme.text, fontWeight: '600' }
                  ]}>
                    {item.label}
                  </Text>
                  <Text style={[
                    styles.sizeDesc,
                    isSelected ? { color: 'rgba(255,255,255,0.85)' } : { color: theme.textSecondary }
                  ]}>
                    {item.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Themes Card */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INTERFACE THEME</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}18` }]}>
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={theme.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Dark mode</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>Use the calmer low-light interface.</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: `${theme.primary}70` }}
              thumbColor={isDark ? theme.primary : theme.textTertiary}
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  sectionHeader: { marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 13, lineHeight: 18 },
  
  // Sizing segment CSS
  sizesRow: { flexDirection: 'row', gap: 10 },
  sizeBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, gap: 6 },
  sizeLabel: { textAlign: 'center' },
  sizeDesc: { fontSize: 11, fontWeight: '500' },

  // Live preview CSS
  previewContainer: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 16 },
  previewIncomingRow: { flexDirection: 'row', gap: 10, alignSelf: 'flex-start', maxWidth: '85%' },
  previewAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  previewAvatarText: { fontSize: 14, fontWeight: '800' },
  previewBubble: { borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  previewBubbleRight: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  previewBubbleText: { fontWeight: '500' },
  previewTime: { fontSize: 10, alignSelf: 'flex-end' },
  previewOutgoingRow: { alignSelf: 'flex-end', maxWidth: '85%' },
  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2 },
});
