import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { uploadToSupabaseRest } from '@/services/supabase';

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { user, userProfile, updateUserProfile } = useAuth();
  const [name, setName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [status, setStatus] = useState(userProfile?.status || '');
  const [statusEmoji, setStatusEmoji] = useState(userProfile?.statusEmoji || '👋');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);
  const statusBarH = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44;
  const profilePhotoURL = localPhotoPreview || userProfile?.photoURL;

  const EMOJI_OPTIONS = ['👋', '😊', '🔥', '💻', '🎵', '✈️', '📚', '🏠', '😴', '🎮'];

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
      return;
    }

    Alert.alert(title, message);
  };

  const getImageExtension = (mimeType?: string | null) => {
    if (mimeType?.includes('png')) return 'png';
    if (mimeType?.includes('webp')) return 'webp';
    if (mimeType?.includes('heic')) return 'heic';
    return 'jpg';
  };

  const handleUploadProfilePhoto = async () => {
    if (uploadingPhoto) return;

    const uid = user?.uid || userProfile?.uid;
    if (!uid) {
      showMessage('Not signed in', 'Please sign in again before changing your profile photo.');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showMessage('Permission needed', 'Please allow photo library access to upload a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      setLocalPhotoPreview(asset.uri);

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const mimeType = asset.mimeType || blob.type || 'image/jpeg';
      const extension = getImageExtension(mimeType);
      const filePath = `profiles/${uid}/profile-photo-${Date.now()}.${extension}`;
      const photoURL = await uploadToSupabaseRest(filePath, blob, mimeType);

      await updateUserProfile({ photoURL });
      setLocalPhotoPreview(null);
      showMessage('Photo updated', 'Your profile photo has been uploaded successfully.');
    } catch (error: any) {
      setLocalPhotoPreview(null);
      showMessage('Upload failed', error?.message || 'Could not upload your profile photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your display name.'); return; }
    setSaving(true);
    try {
      await updateUserProfile({ displayName: name.trim(), bio: bio.trim(), status: status.trim(), statusEmoji });
      Alert.alert('Saved!', 'Your profile has been updated.');
      router.back();
    } catch { Alert.alert('Error', 'Failed to save profile.'); }
    finally { setSaving(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: statusBarH + 16, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handleUploadProfilePhoto}
            activeOpacity={0.85}
            disabled={uploadingPhoto}
            style={styles.avatarButton}
          >
            <GradientAvatar name={name || 'U'} photoURL={profilePhotoURL} size={90} />
            <View style={[styles.changePhotoBtn, { backgroundColor: theme.primary }]}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[styles.changePhotoText, { color: theme.textSecondary }]}>
            {uploadingPhoto ? 'Uploading photo...' : 'Tap to change photo'}
          </Text>
        </View>

        {/* Fields */}
        <View style={styles.fields}>
          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Display Name</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={18} color={theme.textTertiary} />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={theme.textTertiary}
                style={[styles.input, { color: theme.text }]}
              />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Bio</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.border, alignItems: 'flex-start', paddingTop: 12 }]}>
              <Ionicons name="document-text-outline" size={18} color={theme.textTertiary} style={{ marginTop: 2 }} />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people about yourself..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
                style={[styles.input, { color: theme.text, minHeight: 60 }]}
              />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Status Message</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <Text style={{ fontSize: 18 }}>{statusEmoji}</Text>
              <TextInput
                value={status}
                onChangeText={setStatus}
                placeholder="What's on your mind?"
                placeholderTextColor={theme.textTertiary}
                style={[styles.input, { color: theme.text }]}
              />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Status Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_OPTIONS.map((e) => (
                <TouchableOpacity
                  key={e}
                  onPress={() => setStatusEmoji(e)}
                  style={[
                    styles.emojiOption,
                    { backgroundColor: e === statusEmoji ? `${theme.primary}30` : theme.inputBg,
                      borderColor: e === statusEmoji ? theme.primary : 'transparent' }
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <PremiumButton title="Save Changes" onPress={handleSave} loading={saving} size="lg" style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 24 },
  avatarSection: { alignItems: 'center', gap: 8 },
  avatarButton: {
    width: 98,
    height: 98,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    position: 'absolute', bottom: 4, right: 4,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  changePhotoText: { fontSize: 13 },
  fields: { gap: 16 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, gap: 10,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 0 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiOption: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
});
