import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useProfile } from '../contexts/ProfileContext';
import { useWeather } from '../hooks/useWeather';
import OccasionDropdown from '../components/OccasionDropdown';
import Mannequin2D, { MannequinSlot } from '../components/Mannequin2D';
import OutfitCustomizeModal from '../components/OutfitCustomizeModal';
import CharacterCustomizeModal from '../components/CharacterCustomizeModal';
import { MelMascot, MelSpeechBubble, melOutfitForOccasion } from '../components/MelMascot';
import { GeneratedOutfit, OutfitClothingItem } from '../types';
import {
  classifyAnatomicalSlot,
  colorNameToHex,
  inferAccessoryZone,
} from '../services/outfitRecommendationService';
import { triggerWeatherAlertOncePerSession } from '../services/notificationService';
import { DATASET_GARMENT_CATALOG } from '../data/datasetGarmentCatalog';
import { MiniGarmentSvg } from '../utils/garmentImageHelper';
import { computeAccurateOutfitScore } from '../services/hybridScoreService';

const toAnatomical = (slot: MannequinSlot) =>
  slot === 'OUTERWEAR' ? 'outerLayer' : slot === 'BOTTOM' ? 'bottom' : slot === 'SHOES' ? 'shoes' : slot === 'ACCESSORIES' ? 'accessory' : 'innerTop';

interface RimCardProps {
  outfit: GeneratedOutfit;
  rankLabel: string;
  position: -1 | 1;
  onPress: () => void;
}

function RimCard({ outfit, rankLabel, position, onPress }: RimCardProps) {
  const score = outfit.hybridScore ?? outfit.matchPercent ?? 88;
  const styleLabel = outfit.name?.split(' ')[0] || outfit.occasionLabel || 'Look';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.rimCard,
        position === -1 ? styles.rimCardTop : styles.rimCardBottom,
      ]}
    >
      <View style={styles.rimCardInner}>
        <View style={styles.rimRankBadge}>
          <Text style={styles.rimRankText}>{rankLabel}</Text>
        </View>
        <Text style={styles.rimScoreText}>{score}%</Text>
        <Text style={styles.rimDot}>··</Text>
        <Text style={styles.rimStyleText} numberOfLines={1}>
          {styleLabel}
        </Text>
        <Ionicons
          name={position === -1 ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'}
          size={14}
          color="#819084"
          style={{ marginLeft: 'auto' }}
        />
      </View>
      <Text style={styles.rimHintText}>Swipe to rotate</Text>
    </Pressable>
  );
}

interface ActiveWheelCardProps {
  outfit: GeneratedOutfit;
  onPress: () => void;
  scaleAnim: Animated.Value;
}

function ActiveWheelCard({ outfit, onPress, scaleAnim }: ActiveWheelCardProps) {
  const garments = outfit.clothingItems || [];
  const topPieces = garments.slice(0, 4);
  const score = outfit.hybridScore ?? outfit.matchPercent ?? 92;

  return (
    <Animated.View
      style={[
        styles.activeWheelCard,
        {
          transform: [
            {
              scale: scaleAnim.interpolate({
                inputRange: [-1, 0, 1],
                outputRange: [0.96, 1.0, 0.96],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable onPress={onPress} style={styles.cardInner}>
        {/* Top Header Row: Rank badge & Hybrid Match Score */}
        <View style={styles.rankRow}>
          <View style={styles.rankBadgeActive}>
            <Text style={styles.rankTextActive}>TOP 1</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Ionicons name="sparkles" size={11} color="#4D9A65" />
            <Text style={styles.scoreText}>✨ {score}%</Text>
          </View>
        </View>

        {/* Outfit Title */}
        <Text style={styles.cardTitleActive} numberOfLines={1}>
          {outfit.name || outfit.occasionLabel || 'Curated Look'}
        </Text>

        {/* Garment Micro-Thumbnails */}
        <View style={styles.thumbRow}>
          {topPieces.map((item, idx) => (
            <View key={`${item.id || 'item'}-${idx}`} style={styles.microThumb}>
              <MiniGarmentSvg
                slot={item.slotType}
                name={item.name}
                color={item.hexColor || item.primaryColor || item.color}
                size={24}
              />
            </View>
          ))}
          <Text style={styles.itemCountText} numberOfLines={1}>
            {garments.map((g) => g.name.split(' ')[0]).slice(0, 3).join(' + ')}
          </Text>
        </View>

        {/* Footer Hint */}
        <View style={styles.cardFooter}>
          <Text style={styles.cardHintActive}>Wearing · Tap to customize</Text>
          <Ionicons name="options-outline" size={14} color="#F07E57" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function OutfitScreen() {
  const theme = useAppTheme();
  const { items } = useWardrobe();
  const { profile } = useProfile();
  const { weather } = useWeather();
  const {
    occasion,
    setOccasion,
    outfitSourceMode,
    setOutfitSourceMode,
    currentOutfits,
    currentOutfit,
    isLoading,
    generateOutfit,
    updateOutfitEverywhere,
  } = useOutfit();

  const [activeIndex, setActiveIndex] = useState(0);
  const [customizing, setCustomizing] = useState(false);
  const [characterModalVisible, setCharacterModalVisible] = useState(false);
  const [reaction, setReaction] = useState(
    'Mel is balancing your colors, proportions, and today’s weather.'
  );

  useEffect(() => {
    if (!currentOutfit && !isLoading) {
      generateOutfit();
    }
  }, [currentOutfit, isLoading, generateOutfit]);

  useEffect(() => {
    if (weather) {
      triggerWeatherAlertOncePerSession(
        weather.tempC ?? 28,
        weather.condition,
        weather.location
      );
    }
  }, [weather]);

  useEffect(() => {
    const index = currentOutfits.findIndex((outfit) => outfit.id === currentOutfit?.id);
    if (index >= 0) setActiveIndex(index);
  }, [currentOutfit?.id, currentOutfits]);

  // Dynamically compute deterministic hybrid score for all top-3 outfits
  const top3 = useMemo(() => {
    return currentOutfits.slice(0, 3).map((outfit) => {
      const calculatedScore = computeAccurateOutfitScore(
        outfit.clothingItems || [],
        profile,
        weather,
        occasion
      );
      return {
        ...outfit,
        hybridScore: calculatedScore,
        matchPercent: calculatedScore,
      };
    });
  }, [currentOutfits, profile, weather, occasion]);

  const activeOutfit = top3[activeIndex] || currentOutfit || null;
  const catalogOnly = items.length === 0;

  // Rotary Wheel animation values for vertical 60fps circular drum loop
  const panY = useRef(new Animated.Value(0)).current;

  // True Rotary Wheel mapping:
  // Upper rim card: offset = -1 (top)
  // Active card: offset = 0 (middle / center)
  // Lower rim card: offset = +1 (bottom)
  const wheel = useMemo(() => {
    if (!top3.length) return [];
    return [
      {
        outfit: top3[(activeIndex + top3.length - 1) % top3.length],
        rankLabel: 'TOP 3',
        position: -1 as const,
      },
      {
        outfit: top3[activeIndex % top3.length],
        rankLabel: 'TOP 1',
        position: 0 as const,
      },
      {
        outfit: top3[(activeIndex + 1) % top3.length],
        rankLabel: 'TOP 2',
        position: 1 as const,
      },
    ];
  }, [top3, activeIndex]);

  // Combined suggestions for customizer (combining user wardrobe + dataset catalog)
  const allSuggestions = useMemo(() => {
    const fromWardrobe: OutfitClothingItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category as any,
      image: item.image,
      color: item.color,
      hexColor: colorNameToHex(item.color),
      slotType: classifyAnatomicalSlot(item.name, item.category),
      status: item.status,
      isSuggested: false,
    }));

    const fromDataset: OutfitClothingItem[] = DATASET_GARMENT_CATALOG.map((ds) => ({
      id: ds.id,
      name: ds.name,
      category: ds.category,
      image: ds.imageUri,
      color: ds.color,
      hexColor: ds.colorHex,
      slotType: ds.slotType,
      isSuggested: true,
    }));

    const fromOutfits = currentOutfits.flatMap((outfit) => outfit.clothingItems || []);

    const unique = new Map<string, OutfitClothingItem>();
    [...fromWardrobe, ...fromDataset, ...fromOutfits].forEach((item) => {
      if (item && item.id && item.name) {
        unique.set(item.id, item);
      }
    });

    return Array.from(unique.values());
  }, [items, currentOutfits]);

  // Rotate wheel circularly: activeIndex = (activeIndex + direction + top3.length) % top3.length
  const cycle = (direction: number) => {
    if (!top3.length) return;
    panY.setValue(direction > 0 ? 38 : -38);
    Animated.spring(panY, {
      toValue: 0,
      friction: 7,
      tension: 75,
      useNativeDriver: true,
    }).start();

    setActiveIndex((current) => (current + direction + top3.length) % top3.length);
  };

  // PanResponder for smooth 60fps vertical swipe gestures on the wheel
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 7,
        onPanResponderMove: (_, gesture) => {
          panY.setValue(gesture.dy * 0.42);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -20) {
            cycle(1);
          } else if (gesture.dy > 20) {
            cycle(-1);
          } else {
            Animated.spring(panY, {
              toValue: 0,
              friction: 7,
              tension: 75,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [top3.length]
  );

  const handleSelectCard = (position: number) => {
    if (position === 0) {
      setCustomizing(true);
    } else if (position === -1) {
      cycle(-1);
    } else {
      cycle(1);
    }
  };

  const chooseItem = (item: OutfitClothingItem | null, slot: MannequinSlot) => {
    if (!activeOutfit) return;
    const anatomical = toAnatomical(slot);

    let nextItems: OutfitClothingItem[];
    if (slot === 'ACCESSORIES' && item) {
      const itemZone = inferAccessoryZone(item);
      // Keep other zones intact, replace only the item in the same accessory zone
      nextItems = (activeOutfit.clothingItems || []).filter((entry) => {
        const isAcc = (entry.slotType || classifyAnatomicalSlot(entry.name, entry.category)) === 'accessory';
        if (!isAcc) return true;
        return inferAccessoryZone(entry) !== itemZone;
      });
      nextItems.push({ ...item, slotType: 'accessory' as any });
    } else {
      nextItems = (activeOutfit.clothingItems || []).filter(
        (entry) => (entry.slotType || classifyAnatomicalSlot(entry.name, entry.category)) !== anatomical
      );
      if (item) {
        nextItems.push({ ...item, slotType: anatomical as any });
      }
    }

    const nextScore = computeAccurateOutfitScore(nextItems, profile, weather, occasion);

    updateOutfitEverywhere(activeOutfit.id, {
      clothingItems: nextItems,
      hybridScore: nextScore,
      matchPercent: nextScore,
      contentScore: nextScore + 1,
      collaborativeScore: nextScore - 1,
    });

    if (item) {
      setReaction(
        `Ooh, swapping to ${item.name.toLowerCase()} keeps your ${
          occasion === 'Any occasion' ? 'everyday' : occasion.toLowerCase()
        } direction clean. This look now scores ${nextScore}%!`
      );
    } else {
      setReaction(
        `Deselected piece. Mel recalculated your live outfit match score to ${nextScore}%.`
      );
    }
  };

  useEffect(() => {
    if (activeOutfit) {
      const s = activeOutfit.hybridScore ?? activeOutfit.matchPercent ?? 88;
      setReaction(
        `Wearing ${activeOutfit.name || 'Look'} (${s}% match). Mel styled this for ${
          occasion === 'Any occasion' ? 'everyday wear' : occasion
        }!`
      );
    }
  }, [activeOutfit?.id, occasion]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Screen Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.kicker, { color: '#4D9A65' }]}>AI OUTFIT STUDIO</Text>
            <Text style={[styles.title, { color: theme.text }]}>Your Outfit Recommendations</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setCharacterModalVisible(true)}
              style={styles.characterBtn}
              accessibilityLabel="Customize character"
            >
              <Text style={styles.characterBtnText}>🎨 Character</Text>
            </Pressable>
            <Pressable onPress={generateOutfit} style={styles.refresh} accessibilityLabel="Refresh outfits">
              <Ionicons name="refresh" size={19} color="#4D9A65" />
            </Pressable>
          </View>
        </View>

        {/* Controls: Target Occasion & Wardrobe Source Toggle */}
        <View style={styles.controls}>
          <Text style={[styles.controlLabel, { color: theme.text }]}>Target Occasion</Text>
          <OccasionDropdown value={occasion} onChange={setOccasion} />

          <View style={styles.sourceToggle}>
            <Pressable
              onPress={() => setOutfitSourceMode('closet')}
              style={[styles.sourceOption, outfitSourceMode === 'closet' && styles.sourceActive]}
            >
              <Text
                style={[styles.sourceText, outfitSourceMode === 'closet' && styles.sourceTextActive]}
              >
                My Wardrobe
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOutfitSourceMode('bestForOccasion')}
              style={[styles.sourceOption, outfitSourceMode === 'bestForOccasion' && styles.sourceActive]}
            >
              <Text
                style={[
                  styles.sourceText,
                  outfitSourceMode === 'bestForOccasion' && styles.sourceTextActive,
                ]}
              >
                Style Suggestions
              </Text>
            </Pressable>
          </View>
        </View>

        {catalogOnly && (
          <View style={styles.emptyBanner}>
            <Ionicons name="sparkles-outline" size={18} color="#4D9A65" />
            <Text style={styles.emptyBannerText}>
              You haven't uploaded your wardrobe yet, so I styled these Top-3 looks from our curated fashion dataset. Tap Wardrobe anytime to scan your own clothes.
            </Text>
          </View>
        )}

        {/* Dedicated Mel Mascot & Coach Speech Bubble Row (ZERO OVERLAP with Mannequin) */}
        <View style={styles.melRow}>
          <MelMascot
            size={58}
            outfit={melOutfitForOccasion(activeOutfit?.occasionLabel || occasion)}
          />
          <MelSpeechBubble
            variant={melOutfitForOccasion(activeOutfit?.occasionLabel || occasion)}
            message={reaction}
            position="inline"
          />
        </View>

        {/* Interactive Styling Stage: 2D Human Avatar on Left + Rotary Wheel on Right */}
        <View style={styles.stage}>
          {/* Left Pane: 2D Human Avatar */}
          <View style={styles.leftPane}>
            <Mannequin2D
              profile={profile}
              items={activeOutfit?.clothingItems || []}
              onSelectSlot={() => setCustomizing(true)}
              occasionScene={activeOutfit?.occasionLabel || occasion}
              viewBoxOverride="0 0 240 385"
            />
          </View>

          {/* Right Pane: True Rotary Circular Wheel with PanResponder */}
          <View style={styles.rightPane} {...panResponder.panHandlers}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <Ionicons name="sync-outline" size={24} color="#4D9A65" />
                <Text style={styles.loading}>Mel is styling your look…</Text>
              </View>
            ) : wheel.length ? (
              <View style={styles.rotaryWheelContainer}>
                {/* Upper Rim Card (Top 3) at translateY: -104 */}
                <Animated.View
                  style={[
                    styles.rotaryCardWrapper,
                    {
                      transform: [
                        { translateY: Animated.add(new Animated.Value(-104), panY) },
                        { scale: 0.85 },
                      ],
                      opacity: 0.72,
                      zIndex: 1,
                    },
                  ]}
                >
                  <RimCard
                    outfit={wheel[0].outfit}
                    rankLabel={wheel[0].rankLabel}
                    position={-1}
                    onPress={() => handleSelectCard(-1)}
                  />
                </Animated.View>

                {/* Center Active Card (Top 1) at translateY: 0 */}
                <Animated.View
                  style={[
                    styles.rotaryCardWrapper,
                    {
                      transform: [
                        { translateY: panY },
                        { scale: 1.0 },
                      ],
                      opacity: 1.0,
                      zIndex: 3,
                    },
                  ]}
                >
                  <ActiveWheelCard
                    outfit={wheel[1].outfit}
                    onPress={() => handleSelectCard(0)}
                    scaleAnim={panY}
                  />
                </Animated.View>

                {/* Lower Rim Card (Top 2) at translateY: +104 */}
                <Animated.View
                  style={[
                    styles.rotaryCardWrapper,
                    {
                      transform: [
                        { translateY: Animated.add(new Animated.Value(104), panY) },
                        { scale: 0.85 },
                      ],
                      opacity: 0.72,
                      zIndex: 1,
                    },
                  ]}
                >
                  <RimCard
                    outfit={wheel[2].outfit}
                    rankLabel={wheel[2].rankLabel}
                    position={1}
                    onPress={() => handleSelectCard(1)}
                  />
                </Animated.View>
              </View>
            ) : (
              <Text style={styles.loading}>Preparing your first three looks…</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Character Customization Modal */}
      <CharacterCustomizeModal
        visible={characterModalVisible}
        onClose={() => setCharacterModalVisible(false)}
        initialGender={profile?.gender === 'female' ? 'female' : 'male'}
      />

      {/* Focused Customizer Modal */}
      {activeOutfit && (
        <OutfitCustomizeModal
          visible={customizing}
          outfit={activeOutfit}
          profile={profile}
          weather={weather}
          suggestions={allSuggestions}
          onClose={() => setCustomizing(false)}
          onEquip={chooseItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    maxWidth: 240,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  characterBtn: {
    backgroundColor: '#EAF3D9',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4E6BD',
  },
  characterBtnText: {
    color: '#264C3B',
    fontSize: 11.5,
    fontWeight: '800',
  },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF3D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E6DB',
    borderRadius: 16,
    padding: 10,
    gap: 6,
    marginBottom: 6,
  },
  controlLabel: {
    fontSize: 12.5,
    fontWeight: '900',
  },
  sourceToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: '#EEF2EA',
    padding: 3,
    gap: 3,
  },
  sourceOption: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sourceActive: {
    backgroundColor: '#264C3B',
  },
  sourceText: {
    fontSize: 11,
    color: '#68766B',
    fontWeight: '800',
  },
  sourceTextActive: {
    color: '#FFFFFF',
  },
  emptyBanner: {
    marginTop: 8,
    backgroundColor: '#EAF3D9',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  emptyBannerText: {
    flex: 1,
    color: '#3B5944',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  melRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E1E6DB',
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  stage: {
    flexDirection: 'row',
    marginTop: 4,
    height: 335,
    maxHeight: 345,
    gap: 8,
  },
  leftPane: {
    width: '54%',
    height: 335,
    borderRadius: 24,
    backgroundColor: '#F3F6EC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E6DB',
  },
  rightPane: {
    width: '46%',
    height: 335,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotaryWheelContainer: {
    width: '100%',
    height: 335,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  rotaryCardWrapper: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rimCard: {
    width: '94%',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E6DC',
    paddingHorizontal: 9,
    paddingVertical: 7,
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  rimCardTop: {},
  rimCardBottom: {},
  rimCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rimRankBadge: {
    backgroundColor: '#EEF2EA',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rimRankText: {
    color: '#657468',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rimScoreText: {
    color: '#4D9A65',
    fontSize: 10.5,
    fontWeight: '900',
  },
  rimDot: {
    color: '#BDC5BD',
    fontSize: 9,
    fontWeight: '900',
  },
  rimStyleText: {
    color: '#4B5563',
    fontSize: 10.5,
    fontWeight: '700',
    flex: 1,
  },
  rimHintText: {
    color: '#8C978E',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  activeWheelCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E07A5F',
    shadowColor: '#E07A5F',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    zIndex: 10,
  },
  cardInner: {
    padding: 10,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankBadgeActive: {
    backgroundColor: '#FFF2EB',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  rankTextActive: {
    color: '#F07E57',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  scoreText: {
    color: '#4D9A65',
    fontSize: 11.5,
    fontWeight: '900',
  },
  cardTitleActive: {
    color: '#1A3327',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  microThumb: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F5F7F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6EAE0',
  },
  itemCountText: {
    color: '#718078',
    fontSize: 9.5,
    fontWeight: '700',
    flex: 1,
    marginLeft: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#F0F3EA',
    paddingTop: 5,
  },
  cardHintActive: {
    color: '#F07E57',
    fontSize: 9,
    fontWeight: '700',
    flex: 1,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  loading: {
    color: '#758378',
    fontSize: 11.5,
    textAlign: 'center',
    lineHeight: 16,
  },
});
