import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useWeather } from '../hooks/useWeather';
import OccasionDropdown from '../components/OccasionDropdown';
import OutfitRecommendationStatsBar from '../components/OutfitRecommendationStatsBar';
import OutfitPreviewCard from '../components/OutfitPreviewCard';
import OutfitLoadingView from '../components/OutfitLoadingView';
import { triggerWeatherAlertOncePerSession } from '../services/notificationService';

const MIN_CLEAN_ITEMS = 2;

export default function OutfitScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { items } = useWardrobe();
  const { weather } = useWeather();
  const {
    occasion,
    setOccasion,
    noNewClothesMode,
    toggleNoNewClothesMode,
    currentOutfit,
    currentOutfits,
    isLoading,
    generateOutfit,
  } = useOutfit();

  const [infoModalVisible, setInfoModalVisible] = useState(false);

  const cleanItemsCount = items.filter((i) => i.status === 'clean').length;
  const hasEnoughClothes = cleanItemsCount >= MIN_CLEAN_ITEMS;

  useEffect(() => {
    if (hasEnoughClothes && !currentOutfit && !isLoading) {
      generateOutfit();
    }
  }, [hasEnoughClothes]);

  useEffect(() => {
    if (weather) {
      const tempC = weather.tempC ?? Math.round((weather.tempF - 32) * (5 / 9));
      triggerWeatherAlertOncePerSession(
        tempC,
        weather.condition || 'Clear',
        weather.location || 'Makati'
      );
    }
  }, [weather]);

  if (!hasEnoughClothes) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.text, paddingHorizontal: 20, paddingTop: 8 }]}>
          Outfit Recommendations
        </Text>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primaryAccent + '33' }]}>
            <Ionicons name="shirt-outline" size={30} color={theme.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Not Enough Clean Clothes</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Add at least {MIN_CLEAN_ITEMS} clean garments to your wardrobe to generate hybrid recommendations.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddClothes')}
            style={[styles.addButton, { backgroundColor: theme.secondaryAccent }]}
          >
            <Text style={[styles.addButtonLabel, { color: theme.onAccent }]}>Add Clothes to Wardrobe</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const top3Outfits = currentOutfits.slice(0, 3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* 1. Screen Title: "Outfit Recommendations" */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Outfit Recommendations</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* 2. Compact "No New Clothes Mode" Toggle Row with ⓘ Info Button */}
        <View
          style={[
            styles.compactModeRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.compactModeLeft}>
            <View
              style={[
                styles.leafIconCircle,
                { backgroundColor: noNewClothesMode ? '#2F8F5B1F' : theme.badgeBg },
              ]}
            >
              <Ionicons
                name="leaf-outline"
                size={16}
                color={noNewClothesMode ? '#2F8F5B' : theme.accentText}
              />
            </View>
            <Text style={[styles.compactModeTitle, { color: theme.text }]}>
              No New Clothes Mode
            </Text>
            <Pressable
              onPress={() => setInfoModalVisible(true)}
              style={styles.infoIconButton}
              hitSlop={10}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={theme.accentText}
              />
            </Pressable>
          </View>

          <Switch
            value={noNewClothesMode}
            onValueChange={toggleNoNewClothesMode}
            trackColor={{ false: theme.border, true: '#2F8F5B' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* 3. Target Occasion Dropdown */}
        <View style={[styles.occasionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.occasionLabel, { color: theme.text }]}>Target Occasion</Text>
          <OccasionDropdown value={occasion} onChange={setOccasion} />
        </View>

        {/* 4. Primary Action Button: "✨ Generate Top-3 Outfits" */}
        <Pressable
          onPress={generateOutfit}
          disabled={isLoading}
          style={[
            styles.generateButton,
            { backgroundColor: theme.secondaryAccent, opacity: isLoading ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.generateLabel, { color: theme.onAccent }]}>
            ✨ Generate Top-3 Outfits
          </Text>
        </Pressable>

        {isLoading && <OutfitLoadingView />}

        {/* 5. 2-Column Spatial Outfit Board showing recommended outfits */}
        {!isLoading && top3Outfits.length > 0 && (
          <View style={styles.recommendationsSection}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, { color: theme.text }]}>Top-3 Outfits for You</Text>
              <Text style={[styles.resultsSubtitle, { color: theme.textMuted }]}>
                Tap any garment on the Spatial Outfit Board or ✏️ to swap pieces from your closet
              </Text>
            </View>

            {top3Outfits.map((outfit, index) => (
              <View key={outfit.id} style={styles.outfitBlock}>
                <View style={styles.rankBadgeRow}>
                  <View
                    style={[
                      styles.rankBadge,
                      { backgroundColor: index === 0 ? theme.secondaryAccent : theme.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankBadgeText,
                        { color: index === 0 ? theme.onAccent : theme.text },
                      ]}
                    >
                      Choice #{index + 1}
                    </Text>
                  </View>
                  <Text style={[styles.rankScore, { color: theme.accentText }]}>
                    {outfit.hybridScore ?? outfit.matchPercent}% Style Match
                  </Text>
                </View>

                <OutfitRecommendationStatsBar outfit={outfit} />

                <OutfitPreviewCard
                  outfit={outfit}
                  index={index}
                  totalCount={top3Outfits.length}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Informative Modal for "About No New Clothes Mode" */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setInfoModalVisible(false)}
          />
          <View
            style={[
              styles.infoModalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.infoModalHeader}>
              <View style={[styles.leafIconCircle, { backgroundColor: '#2F8F5B1F' }]}>
                <Ionicons name="leaf" size={18} color="#2F8F5B" />
              </View>
              <Text style={[styles.infoModalTitle, { color: theme.text }]}>
                About No New Clothes Mode
              </Text>
              <Pressable
                onPress={() => setInfoModalVisible(false)}
                hitSlop={8}
                style={[styles.infoModalCloseBtn, { backgroundColor: theme.background }]}
              >
                <Ionicons name="close" size={17} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.infoBulletGroup}>
              <View
                style={[
                  styles.infoModeBox,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.infoModeBoxHeading, { color: '#2F8F5B' }]}>
                  • ON (Default)
                </Text>
                <Text style={[styles.infoModeBoxBody, { color: theme.text }]}>
                  Generates outfits using 100% clean clothes from your existing wardrobe. Perfect for sustainable styling and rotating forgotten favorites.
                </Text>
              </View>

              <View
                style={[
                  styles.infoModeBox,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.infoModeBoxHeading, { color: theme.accentText }]}>
                  • OFF
                </Text>
                <Text style={[styles.infoModeBoxBody, { color: theme.text }]}>
                  Allows StyleSense to suggest 1 complementary piece from outside your wardrobe if your closet is missing a key piece for the selected occasion.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setInfoModalVisible(false)}
              style={[styles.infoModalGotItBtn, { backgroundColor: theme.secondaryAccent }]}
            >
              <Text style={[styles.infoModalGotItText, { color: theme.onAccent }]}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingBottom: 36, gap: 12, paddingTop: 6 },
  compactModeRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactModeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  leafIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactModeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoIconButton: {
    padding: 2,
  },
  occasionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  occasionLabel: { fontSize: 13.5, fontWeight: '700' },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
  generateLabel: { fontWeight: '800', fontSize: 14.5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySubtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  addButton: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 14 },
  addButtonLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
  recommendationsSection: { gap: 16, marginTop: 4 },
  resultsHeader: { gap: 2, marginBottom: 2 },
  resultsTitle: { fontSize: 17, fontWeight: '800' },
  resultsSubtitle: { fontSize: 12.5 },
  outfitBlock: { gap: 8 },
  rankBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  rankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rankBadgeText: { fontSize: 12, fontWeight: '700' },
  rankScore: { fontSize: 13, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  infoModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  infoModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBulletGroup: {
    gap: 10,
  },
  infoModeBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  infoModeBoxHeading: {
    fontSize: 13,
    fontWeight: '800',
  },
  infoModeBoxBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  infoModalGotItBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalGotItText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
