import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
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
import { getOccasionArchetypeBlueprint } from '../services/outfitRecommendationService';

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
    outfitSourceMode,
    setOutfitSourceMode,
    currentOutfit,
    currentOutfits,
    isLoading,
    generateOutfit,
    surpriseMe,
  } = useOutfit();

  const cleanItemsCount = items.filter((i) => i.status === 'clean').length;
  const hasEnoughClothes = cleanItemsCount >= MIN_CLEAN_ITEMS;

  const archetypeBlueprint = useMemo(
    () => getOccasionArchetypeBlueprint(occasion, items),
    [occasion, items]
  );

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

  // Display top 3 outfits
  const top3Outfits = currentOutfits.slice(0, 3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Outfit Recommendations</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Making Sense of Your Style · Confidence, Colors & Quick Decisions
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Weather Today Banner (Always in Celsius) */}
        <View style={[styles.weatherCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.weatherLeft}>
            <View style={[styles.weatherIconWrap, { backgroundColor: theme.primaryAccent + '33' }]}>
              <Ionicons name={weather.icon === 'sunny' ? 'sunny' : 'partly-sunny'} size={20} color="#E8833A" />
            </View>
            <View>
              <View style={styles.weatherTitleRow}>
                <Text style={[styles.weatherTemp, { color: theme.text }]}>
                  {weather.tempC ?? Math.round((weather.tempF - 32) * (5 / 9))}°C
                </Text>
                <View style={[styles.owmBadge, { backgroundColor: '#FFD586' }]}>
                  <Text style={styles.owmBadgeText}>Weather Today</Text>
                </View>
              </View>
              <Text style={[styles.weatherCondition, { color: theme.textMuted }]}>
                {weather.condition} · {weather.location}
              </Text>
            </View>
          </View>
          <Text style={[styles.weatherTip, { color: theme.accentText }]}>{weather.tip}</Text>
        </View>

        {/* Working "No New Clothes Mode" Toggle Card */}
        <View
          style={[
            styles.modeCard,
            {
              backgroundColor: noNewClothesMode
                ? theme.mode === 'dark'
                  ? '#1B3324'
                  : '#EDF7F0'
                : theme.surface,
              borderColor: noNewClothesMode ? '#2F8F5B' : theme.border,
            },
          ]}
        >
          <View style={styles.modeCardLeft}>
            <View
              style={[
                styles.leafIconWrap,
                { backgroundColor: noNewClothesMode ? '#2F8F5B' : theme.badgeBg },
              ]}
            >
              <Ionicons
                name="leaf-outline"
                size={18}
                color={noNewClothesMode ? '#FFFFFF' : theme.accent}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.modeTitleRow}>
                <Text style={[styles.modeTitle, { color: theme.text }]}>No New Clothes Mode</Text>
                {noNewClothesMode && (
                  <View style={styles.activePill}>
                    <Text style={[styles.activePillText, { color: theme.onAccent }]}>100% Reuse</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.modeSubtitle, { color: theme.textMuted }]}>
                Strictly reuses clean items in your wardrobe. Zero new purchases suggested.
              </Text>
            </View>
          </View>
          <Switch
            value={noNewClothesMode}
            onValueChange={toggleNoNewClothesMode}
            trackColor={{ false: theme.border, true: '#2F8F5B' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Occasion Selection Card */}
        <View style={[styles.occasionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.occasionLabel, { color: theme.text }]}>Target Occasion</Text>
          <OccasionDropdown value={occasion} onChange={setOccasion} />

          {/* Advisor's 2-Pill Toggle: "👕 My Closet Only" vs "✨ Best for Occasion" */}
          <View style={styles.sourceModeToggleWrap}>
            <Pressable
              onPress={() => setOutfitSourceMode('closet')}
              style={[
                styles.sourceModePill,
                {
                  backgroundColor: outfitSourceMode === 'closet' ? theme.secondaryAccent : theme.background,
                  borderColor: outfitSourceMode === 'closet' ? theme.secondaryAccent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.sourceModePillText,
                  { color: outfitSourceMode === 'closet' ? theme.onAccent : theme.text },
                ]}
              >
                👕 My Closet Only
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setOutfitSourceMode('bestForOccasion')}
              style={[
                styles.sourceModePill,
                {
                  backgroundColor: outfitSourceMode === 'bestForOccasion' ? theme.secondaryAccent : theme.background,
                  borderColor: outfitSourceMode === 'bestForOccasion' ? theme.secondaryAccent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.sourceModePillText,
                  { color: outfitSourceMode === 'bestForOccasion' ? theme.onAccent : theme.text },
                ]}
              >
                ✨ Dataset Picks
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.sourceModeHelper, { color: theme.textMuted }]}>
            {outfitSourceMode === 'closet'
              ? 'Builds outfits strictly from the clean clothes inside your closet.'
              : `Mixes your closet with studio "Dataset Pick" garments for ${occasion === 'Any occasion' ? 'Office' : occasion}.`}
          </Text>
        </View>

        {/* OCCASION FORMULA & CLOSET TIP CARD */}
        <View
          style={[
            styles.archetypeCard,
            {
              backgroundColor: theme.aiBannerBg,
              borderColor: theme.aiBannerBorder,
            },
          ]}
        >
          <View style={styles.archetypeHeader}>
            <View style={styles.archetypeTitleRow}>
              <Ionicons name="ribbon-outline" size={16} color={theme.accentText} />
              <Text style={[styles.archetypeTitle, { color: theme.aiBannerText }]}>
                {archetypeBlueprint.occasionTitle}
              </Text>
            </View>
            <View style={[styles.archetypeBoostPill, { backgroundColor: theme.aiPillBg }]}>
              <Text style={[styles.archetypeBoostText, { color: theme.aiPillText }]}>
                {archetypeBlueprint.currentMatchEst}% → {archetypeBlueprint.boostedMatchEst}% Match
              </Text>
            </View>
          </View>

          <View style={[styles.archetypeFormulaBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.archetypeSectionLabel, { color: theme.accentText }]}>
              WHAT TO WEAR FIRST (INSIDE → OUT)
            </Text>
            <Text style={[styles.archetypeFormulaText, { color: theme.text }]}>
              {archetypeBlueprint.benchmarkFormula}
            </Text>
          </View>

          <View style={styles.archetypeBulletRow}>
            <Ionicons name="checkmark-circle-outline" size={15} color={theme.accentText} style={{ marginTop: 1 }} />
            <Text style={[styles.archetypeBodyText, { color: theme.aiBannerText }]}>
              <Text style={{ fontWeight: '800' }}>Quick Tip: </Text>
              {archetypeBlueprint.howToWearNow}
            </Text>
          </View>

          <View style={styles.archetypeBulletRow}>
            <Ionicons name="trending-up-outline" size={15} color={theme.accentText} style={{ marginTop: 1 }} />
            <Text style={[styles.archetypeBodyText, { color: theme.aiBannerText }]}>
              <Text style={{ fontWeight: '800' }}>Upgrade Your Match: </Text>
              {archetypeBlueprint.closetGapTip}
            </Text>
          </View>
        </View>

        {/* Generation Action Buttons */}
        <View style={styles.generateRow}>
          <Pressable
            onPress={generateOutfit}
            disabled={isLoading}
            style={[
              styles.generateButton,
              { backgroundColor: theme.secondaryAccent, opacity: isLoading ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="sparkles" size={16} color={theme.onAccent} />
            <Text style={[styles.generateLabel, { color: theme.onAccent }]}>Generate Top-3 Outfits</Text>
          </Pressable>
          <Pressable
            onPress={surpriseMe}
            disabled={isLoading}
            style={[
              styles.surpriseButton,
              { borderColor: theme.border, backgroundColor: theme.surface, opacity: isLoading ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="shuffle" size={16} color={theme.text} />
            <Text style={[styles.surpriseLabel, { color: theme.text }]}>Surprise Me</Text>
          </Pressable>
        </View>

        {isLoading && <OutfitLoadingView />}

        {/* Display Top-3 Outfits */}
        {!isLoading && top3Outfits.length > 0 && (
          <View style={styles.recommendationsSection}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, { color: theme.text }]}>Top-3 Outfits for You</Text>
              <Text style={[styles.resultsSubtitle, { color: theme.textMuted }]}>
                Tap any garment card on the moodboard below to swap from your closet or dataset picks
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

                {/* Score Breakdown Bar */}
                <OutfitRecommendationStatsBar outfit={outfit} />

                {/* Outfit Preview Card with Explainability & Like/Dislike/Save/Wear */}
                <OutfitPreviewCard outfit={outfit} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 36, gap: 14, paddingTop: 8 },
  weatherCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  weatherLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weatherIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTemp: { fontSize: 18, fontWeight: '800' },
  owmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  owmBadgeText: { fontSize: 10, fontWeight: '700', color: '#3D2E10' },
  weatherCondition: { fontSize: 12.5 },
  weatherTip: { fontSize: 12, fontWeight: '600' },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modeCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  leafIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeTitle: { fontSize: 14, fontWeight: '700' },
  activePill: {
    backgroundColor: '#2F8F5B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  modeSubtitle: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  occasionCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  occasionLabel: { fontSize: 13.5, fontWeight: '700' },
  sourceModeToggleWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  sourceModePill: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceModePillText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  sourceModeHelper: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  archetypeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  archetypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  archetypeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  archetypeTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1,
  },
  archetypeBoostPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  archetypeBoostText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  archetypeFormulaBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  archetypeSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  archetypeFormulaText: {
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  archetypeBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  archetypeBodyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16.5,
  },
  generateRow: { flexDirection: 'row', gap: 10 },
  generateButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  generateLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  surpriseButton: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  surpriseLabel: { fontWeight: '700', fontSize: 13.5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 6 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySubtitle: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  addButton: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 14 },
  addButtonLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
  recommendationsSection: { gap: 16, marginTop: 6 },
  resultsHeader: { gap: 2, marginBottom: 4 },
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
});
