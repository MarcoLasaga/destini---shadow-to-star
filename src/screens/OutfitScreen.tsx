import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
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

const PERMANENT_RANKS = ['TOP 1', 'TOP 2', 'TOP 3'] as const;

const getRelOffset = (i: number, active: number): -1 | 0 | 1 => {
  const diff = (i - active + 3) % 3;
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  return -1;
};

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
      <Text style={styles.rimHintText}>Tap to select · Swipe to rotate</Text>
    </Pressable>
  );
}

interface ActiveWheelCardProps {
  outfit: GeneratedOutfit;
  rankLabel: string;
  onPress: () => void;
}

function ActiveWheelCard({ outfit, rankLabel, onPress }: ActiveWheelCardProps) {
  const garments = outfit.clothingItems || [];
  const topPieces = garments.slice(0, 4);
  const score = outfit.hybridScore ?? outfit.matchPercent ?? 92;

  return (
    <View style={styles.activeWheelCard}>
      <Pressable onPress={onPress} style={styles.cardInner}>
        {/* Top Header Row: Rank badge & Hybrid Match Score */}
        <View style={styles.rankRow}>
          <View style={styles.rankBadgeActive}>
            <Text style={styles.rankTextActive}>{rankLabel}</Text>
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
    </View>
  );
}

export default function OutfitScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
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

  // Check if wardrobe has minimum required pieces (Top + Bottom + Shoes)
  const hasTop = useMemo(() => items.some((i) => {
    const cat = (i.category || '').toUpperCase().trim();
    const name = (i.name || '').toLowerCase();
    return cat.startsWith('TOP') || /shirt|tee|polo|blouse|top|crewneck|tank/.test(name);
  }), [items]);

  const hasBottom = useMemo(() => items.some((i) => {
    const cat = (i.category || '').toUpperCase().trim();
    const name = (i.name || '').toLowerCase();
    return cat.startsWith('BOTTOM') || /pant|jean|short|skirt|trouser|chino/.test(name);
  }), [items]);

  const hasShoes = useMemo(() => items.some((i) => {
    const cat = (i.category || '').toUpperCase().trim();
    const name = (i.name || '').toLowerCase();
    return cat.startsWith('SHOE') || /shoe|sneaker|boot|loafer|sandal|heel/.test(name);
  }), [items]);

  const hasCompleteWardrobe = hasTop && hasBottom && hasShoes && items.length >= 3;
  const isWardrobeMode = outfitSourceMode === 'closet';
  const showEmptyWardrobePrompt = isWardrobeMode && !hasCompleteWardrobe;

  // 3-Card Animated Tracks for physical slide + scale carousel
  const cardTranslateY = useRef([
    new Animated.Value(0),
    new Animated.Value(108),
    new Animated.Value(-108),
  ]).current;

  const cardScale = useRef([
    new Animated.Value(1.0),
    new Animated.Value(0.84),
    new Animated.Value(0.84),
  ]).current;

  const cardOpacity = useRef([
    new Animated.Value(1.0),
    new Animated.Value(0.68),
    new Animated.Value(0.68),
  ]).current;

  const animateWheel = useCallback((nextActive: number) => {
    const anims: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < 3; i++) {
      const rel = getRelOffset(i, nextActive);
      const targetY = rel === 0 ? 0 : rel === 1 ? 108 : -108;
      const targetScale = rel === 0 ? 1.0 : 0.84;
      const targetOpacity = rel === 0 ? 1.0 : 0.68;

      anims.push(
        Animated.spring(cardTranslateY[i], {
          toValue: targetY,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(cardScale[i], {
          toValue: targetScale,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(cardOpacity[i], {
          toValue: targetOpacity,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        })
      );
    }
    Animated.parallel(anims).start();
  }, [cardTranslateY, cardScale, cardOpacity]);

  const cycle = useCallback((direction: number) => {
    if (!top3.length) return;
    const next = (activeIndex + direction + top3.length) % top3.length;
    setActiveIndex(next);
    animateWheel(next);
  }, [activeIndex, top3.length, animateWheel]);

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

  // PanResponder for smooth 60fps vertical swipe gestures on the wheel
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
        onPanResponderMove: (_, gesture) => {
          const dy = gesture.dy * 0.45;
          for (let i = 0; i < 3; i++) {
            const rel = getRelOffset(i, activeIndex);
            const baseY = rel === 0 ? 0 : rel === 1 ? 108 : -108;
            cardTranslateY[i].setValue(baseY + dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -24) {
            cycle(1);
          } else if (gesture.dy > 24) {
            cycle(-1);
          } else {
            for (let i = 0; i < 3; i++) {
              const rel = getRelOffset(i, activeIndex);
              const baseY = rel === 0 ? 0 : rel === 1 ? 108 : -108;
              Animated.spring(cardTranslateY[i], {
                toValue: baseY,
                friction: 7,
                tension: 60,
                useNativeDriver: true,
              }).start();
            }
          }
        },
      }),
    [activeIndex, top3.length, cycle, cardTranslateY]
  );

  const handleSelectCard = useCallback((relPosition: number, targetCardIndex?: number) => {
    if (relPosition === 0) {
      setCustomizing(true);
    } else if (targetCardIndex !== undefined) {
      setActiveIndex(targetCardIndex);
      animateWheel(targetCardIndex);
    } else if (relPosition === -1) {
      cycle(-1);
    } else {
      cycle(1);
    }
  }, [cycle, animateWheel]);

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
                Mix & Match
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

        {/* Empty or Incomplete Wardrobe Guard for My Wardrobe mode */}
        {showEmptyWardrobePrompt ? (
          <View style={[styles.emptyPromptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.emptyPromptMelRow}>
              <MelMascot outfit="casual_sunny" size={82} waving />
              <View style={{ flex: 1 }}>
                <MelSpeechBubble
                  variant="casual_sunny"
                  message="Add at least a Top, Bottom, and Shoes to build outfits from your own closet—or try Mix & Match to explore AI-styled looks right now!"
                  position="inline"
                />
              </View>
            </View>

            <View style={styles.emptyPromptActions}>
              <Pressable
                onPress={() => navigation.navigate('Wardrobe')}
                style={styles.emptyPromptBtnPrimary}
              >
                <Ionicons name="camera-outline" size={17} color="#FFFFFF" />
                <Text style={styles.emptyPromptBtnTextPrimary}>📸 Add to My Wardrobe</Text>
              </Pressable>

              <Pressable
                onPress={() => setOutfitSourceMode('bestForOccasion')}
                style={[styles.emptyPromptBtnSecondary, { borderColor: theme.border }]}
              >
                <Ionicons name="sparkles" size={16} color="#6B3F93" />
                <Text style={styles.emptyPromptBtnTextSecondary}>✨ Try Mix & Match</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* Interactive Styling Stage: 2D Human Avatar on Left + Rotary Wheel on Right */
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
              ) : top3.length ? (
                <View style={styles.rotaryWheelContainer}>
                  {top3.slice(0, 3).map((outfit, i) => {
                    const rel = getRelOffset(i, activeIndex);
                    const rankLabel = PERMANENT_RANKS[i];
                    const isCenter = rel === 0;

                    return (
                      <Animated.View
                        key={outfit.id || `wheel-card-${i}`}
                        style={[
                          styles.rotaryCardWrapper,
                          {
                            transform: [
                              { translateY: cardTranslateY[i] },
                              { scale: cardScale[i] },
                            ],
                            opacity: cardOpacity[i],
                            zIndex: isCenter ? 5 : 1,
                          },
                        ]}
                      >
                        {isCenter ? (
                          <ActiveWheelCard
                            outfit={outfit}
                            rankLabel={rankLabel}
                            onPress={() => handleSelectCard(0)}
                          />
                        ) : (
                          <RimCard
                            outfit={outfit}
                            rankLabel={rankLabel}
                            position={rel as -1 | 1}
                            onPress={() => handleSelectCard(rel, i)}
                          />
                        )}
                      </Animated.View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.loading}>Preparing your first three looks…</Text>
              )}
            </View>
          </View>
        )}
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
          sourceMode={outfitSourceMode === 'closet' ? 'wardrobe' : 'mix'}
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
  emptyPromptCard: {
    marginVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyPromptMelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyPromptActions: {
    gap: 10,
    marginTop: 4,
  },
  emptyPromptBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4D9A65',
    paddingVertical: 13,
    borderRadius: 14,
  },
  emptyPromptBtnTextPrimary: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  emptyPromptBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyPromptBtnTextSecondary: {
    color: '#6B3F93',
    fontWeight: '800',
    fontSize: 14,
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
