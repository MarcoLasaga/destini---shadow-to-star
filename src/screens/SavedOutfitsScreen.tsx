import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { savedOutfitsMock } from '../constants/profileMockData';
import ScreenHeader from '../components/ScreenHeader';

export default function SavedOutfitsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const outfits = savedOutfitsMock;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Saved Outfits" />

      {outfits.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryAccent + '33' }]}>
            <Ionicons name="shirt-outline" size={32} color={theme.secondaryAccent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Saved Outfits</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>Generate and save outfits to see them here</Text>
          <Pressable
            onPress={() => navigation.navigate('GenerateOutfit')}
            style={[styles.generateButton, { backgroundColor: theme.secondaryAccent }]}
          >
            <Text style={styles.generateLabel}>Generate Outfit</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  generateButton: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 13 },
  generateLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});