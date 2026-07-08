import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import OccasionDropdown from '../components/OccasionDropdown';
import OutfitRecommendationStatsBar from '../components/OutfitRecommendationStatsBar';
import OutfitPreviewCard from '../components/OutfitPreviewCard';
import OutfitLoadingView from '../components/OutfitLoadingView';

const MIN_CLEAN_ITEMS = 2;

export default function OutfitScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { items } = useWardrobe();
  const { occasion, setOccasion, currentOutfit, isLoading, generateOutfit, surpriseMe } = useOutfit();

  const cleanItemsCount = items.filter((i) => i.status === 'clean').length;
  const hasEnoughClothes = cleanItemsCount >= MIN_CLEAN_ITEMS;

  useEffect(() => {
    if (hasEnoughClothes && !currentOutfit && !isLoading) {
      generateOutfit();
    }
  }, [hasEnoughClothes]);

  if (!hasEnoughClothes) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.text, paddingHorizontal: 20, paddingTop: 8 }]}>Outfit Generator</Text>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryAccent + '33' }]}>
            <Ionicons name="shirt-outline" size={30} color={theme.secondaryAccent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Not Enough Clothes</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Add at least {MIN_CLEAN_ITEMS} clean items to your wardrobe to generate outfits
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddClothes')}
            style={[styles.addButton, { backgroundColor: theme.secondaryAccent }]}
          >
            <Text style={styles.addButtonLabel}>Add Clothes</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Outfit Generator</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.occasionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.occasionLabel, { color: theme.text }]}>What's the occasion?</Text>
          <OccasionDropdown value={occasion} onChange={setOccasion} />
        </View>

        <View style={styles.generateRow}>
          <Pressable
            onPress={generateOutfit}
            disabled={isLoading}
            style={[styles.generateButton, { backgroundColor: theme.secondaryAccent, opacity: isLoading ? 0.6 : 1 }]}
          >
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.generateLabel}>Generate</Text>
          </Pressable>
          <Pressable
            onPress={surpriseMe}
            disabled={isLoading}
            style={[styles.surpriseButton, { borderColor: theme.border, backgroundColor: theme.surface, opacity: isLoading ? 0.6 : 1 }]}
          >
            <Ionicons name="shuffle" size={16} color={theme.text} />
            <Text style={[styles.surpriseLabel, { color: theme.text }]}>Surprise Me</Text>
          </Pressable>
        </View>

        {isLoading && <OutfitLoadingView />}

        {!isLoading && currentOutfit && (
          <>
            <OutfitRecommendationStatsBar outfit={currentOutfit} />
            <OutfitPreviewCard outfit={currentOutfit} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16, paddingTop: 8 },
  occasionCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  occasionLabel: { fontSize: 13.5, fontWeight: '600' },
  generateRow: { flexDirection: 'row', gap: 12 },
  generateButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15 },
  generateLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
  surpriseButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 15 },
  surpriseLabel: { fontWeight: '700', fontSize: 14.5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySubtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  addButton: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 14 },
  addButtonLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});