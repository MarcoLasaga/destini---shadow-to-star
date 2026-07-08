import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfile } from '../contexts/ProfileContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { Image } from 'expo-image';

const MENU_ITEMS = [
  { key: 'SavedOutfits', label: 'Saved Outfits', icon: 'bookmark-outline' as const },
  { key: 'Analytics', label: 'Analytics', icon: 'bar-chart-outline' as const },
  { key: 'Cookbook', label: 'Cookbook', icon: 'book-outline' as const },
  { key: 'Packing', label: 'Packing Assistant', icon: 'shirt-outline' as const },
  { key: 'Settings', label: 'Settings', icon: 'settings-outline' as const },
  { key: 'Help', label: 'Help & Support', icon: 'help-circle-outline' as const },
];

export default function ProfileScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { profile, setAvatar } = useProfile();
  const { items } = useWardrobe();

  const favoritesCount = items.filter((i) => i.favorite).length;
  const totalWears = items.reduce((sum, i) => sum + i.timesWorn, 0);
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || '?';

  const handleAvatarPress = () => {
    Alert.alert('Change Profile Picture', undefined, [
      { text: 'Upload from Gallery', onPress: () => pickImage('library') },
      { text: 'Take a Photo', onPress: () => pickImage('camera') },
      ...(profile.avatarUri ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setAvatar(null) }] : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const pickImage = async (source: 'library' | 'camera') => {
    // NOTE: requires `expo-image-picker` (not yet installed). Install with:
    // npx expo install expo-image-picker
    // Left as a stub call here so avatar UI + local state wiring is ready;
    // swap in real ImagePicker.launchImageLibraryAsync / launchCameraAsync once installed.
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.profileCard, { backgroundColor: theme.surface }]}>
          <View style={styles.avatarWrap}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.mode === 'dark' ? '#3A3A42' : '#E4E1EC' }]}>
                <Text style={[styles.avatarInitial, { color: theme.secondaryAccent }]}>{initial}</Text>
              </View>
            )}
            <Pressable onPress={handleAvatarPress} style={[styles.cameraBadge, { backgroundColor: theme.secondaryAccent }]}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </Pressable>
          </View>

          <Text style={[styles.name, { color: theme.text }]}>{profile.displayName}</Text>
          <Text style={[styles.email, { color: theme.textMuted }]}>{profile.email}</Text>
          <Text style={[styles.memberSince, { color: theme.textMuted }]}>Member since {profile.memberSince}</Text>

          <View style={[styles.statsRow, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, { color: theme.text }]}>{items.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Items</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, { color: theme.text }]}>{favoritesCount}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Favorites</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, { color: theme.text }]}>{totalWears}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Wears</Text>
            </View>
          </View>
        </Animated.View>

        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          style={[styles.editButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
        >
          <Text style={[styles.editLabel, { color: theme.text }]}>Edit Profile</Text>
        </Pressable>

        <View style={[styles.menuCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {MENU_ITEMS.map((item, index) => (
            <Pressable
              key={item.key}
              onPress={() => navigation.navigate(item.key)}
              style={[styles.menuRow, index !== MENU_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
            >
              <Ionicons name={item.icon} size={19} color={theme.textMuted} />
              <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={17} color="#E5484D" />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  profileCard: { borderRadius: 22, padding: 20, alignItems: 'center', gap: 4 },
  avatarWrap: { marginBottom: 8 },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarInitial: { fontSize: 34, fontWeight: '800' },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  email: { fontSize: 13 },
  memberSince: { fontSize: 12, marginBottom: 12 },
  statsRow: { flexDirection: 'row', width: '100%', borderRadius: 14, paddingVertical: 14 },
  statBlock: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 11.5 },
  editButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  editLabel: { fontSize: 14.5, fontWeight: '700' },
  menuCard: { borderRadius: 18, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, paddingHorizontal: 16 },
  menuLabel: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F4C7C7',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  logoutLabel: { color: '#E5484D', fontWeight: '700', fontSize: 14.5 },
});