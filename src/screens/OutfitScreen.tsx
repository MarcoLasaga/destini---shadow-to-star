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
import { MelMascot, MelSpeechBubble } from '../components/MelMascot';
import { GeneratedOutfit, OutfitClothingItem } from '../types';
import { classifyAnatomicalSlot, colorNameToHex } from '../services/outfitRecommendationService';
import { triggerWeatherAlertOncePerSession } from '../services/notificationService';
import { DATASET_GARMENT_CATALOG } from '../data/datasetGarmentCatalog';
import { MiniGarmentSvg, resolveGarmentImageUrl } from '../utils/garmentImageHelper';

const toAnatomical = (slot: MannequinSlot) =>
  slot === 'OUTERWEAR' ? 'outerLayer' : slot === 'BOTTOM' ? 'bottom' : slot === 'SHOES' ? 'shoes' : slot === 'ACCESSORIES' ? 'accessory' : 'innerTop';

interface WheelCardProps {
  outfit: GeneratedOutfit;
  rankLabel: string;
  active: boolean;
  onPress: () => void;
  scaleAnim: Animated.Value;
}

function WheelCard({ outfit, rankLabel, active, onPress, scaleAnim }: WheelCardProps) {
  const garments = outfit.clothingItems || [];
  const topPieces = garments.slice(0, 4);

  return (
    <Animated.View
      style={[
        styles.wheelCard,
        active ? styles.wheelCardActive : styles.wheelCardInactive,
        {
          transform: [
            {
              scale: scaleAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [active ? 1.0 : 0.90, active ? 1.02 : 0.90],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable onPress={onPress} style={styles.cardInner}>
        {/* Top Header Row: Rank badge & Hybrid Match Score */}
        <View style={styles.rankRow}>
          <View style={[styles.rankBadge, active ? styles.rankBadgeActive : styles.rankBadgeInactive]}>
            <Text style={[styles.rankText, active && styles.rankTextActive]}>{rankLabel}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Ionicons name="sparkles" size={11} color="#4D9A65" />
            <Text style={styles.scoreText}>
              {outfit.hybridScore ?? outfit.matchPercent ?? 92}% Match
            </Text>
          </View>
        </View>

        {/* Outfit Title */}
        <Text style={[styles.cardTitle, active && styles.cardTitleActive]} numberOfLines={1}>
          {outfit.name || outfit.occasionLabel || 'Curated Look'}
        </Text>

        {/* Garment Micro-Thumbnails (Mini 2D Vector Previews - Never Empty / Black Box) */}
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
          <Text style={[styles.cardHint, active && styles.cardHintActive]}>
            {active ? 'Wearing on Mannequin · Tap to customize' : 'Tap to cycle to avatar'}
          </Text>
          <Ionicons
            name={active ? 'shirt-outline' : 'repeat-outline'}
            size={14}
            color={active ? '#F07E57' : '#718078'}
          />
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

  const top3 = currentOutfits.slice(0, 3);
  const activeOutfit = top3[activeIndex] || currentOutfit || null;
  const catalogOnly = items.length === 0;

  // Wheel transition animation
  const wheelAnim = useRef(new Animated.Value(0)).current;

  // True vertical circular wheel:
  // Slot 0 (Top): Top 3
  // Slot 1 (Middle / Active Center): Top 1 (currently worn by Mannequin)
  // Slot 2 (Bottom): Top 2
  const wheel = useMemo(() => {
    if (!top3.length) return [];
    return [
      { outfit: top3[(activeIndex + 2) % top3.length], rankLabel: 'TOP 3', isCenter: false, position: 0 },
      { outfit: top3[activeIndex % top3.length], rankLabel: 'TOP 1 · ACTIVE', isCenter: true, position: 1 },
      { outfit: top3[(activeIndex + 1) % top3.length], rankLabel: 'TOP 2', isCenter: false, position: 2 },
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

  // Rotate wheel circularly: activeIdx = (activeIdx + delta + 3) % 3 with spring animation
  const cycle = (direction: number) => {
    if (!top3.length) return;
    wheelAnim.setValue(direction > 0 ? 1 : -1);
    Animated.spring(wheelAnim, {
      toValue: 0,
      friction: 5,
      tension: 70,
      useNativeDriver: true,
    }).start();

    setActiveIndex((current) => (current + direction + top3.length) % top3.length);
  };

  // PanResponder for smooth vertical swipe gestures (swipe up / swipe down)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 10,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -18) {
            // Swiped up -> bring bottom card to center
            cycle(1);
          } else if (gesture.dy > 18) {
            // Swiped down -> bring top card to center
            cycle(-1);
          }
        },
      }),
    [top3.length]
  );

  const handleSelectCard = (position: number) => {
    if (position === 1) {
      setCustomizing(true);
    } else if (position === 0) {
      cycle(-1);
    } else {
      cycle(1);
    }
  };

  const chooseItem = (item: OutfitClothingItem, slot: MannequinSlot) => {
    if (!activeOutfit) return;
    const anatomical = toAnatomical(slot);
    const nextItems = (activeOutfit.clothingItems || []).filter(
      (entry) => (entry.slotType || classifyAnatomicalSlot(entry.name, entry.category)) !== anatomical
    );
    nextItems.push({ ...item, slotType: anatomical as any });
    const nextScore = Math.max(
      72,
      Math.min(98, (activeOutfit.hybridScore ?? activeOutfit.matchPercent ?? 90) + (item.isSuggested ? 1 : 2))
    );

    updateOutfitEverywhere(activeOutfit.id, {
      clothingItems: nextItems,
      hybridScore: nextScore,
      matchPercent: nextScore,
      contentScore: nextScore + 1,
      collaborativeScore: nextScore - 1,
    });

    setReaction(
      `Ooh, swapping to ${item.name.toLowerCase()} keeps your ${
        occasion === 'Any occasion' ? 'everyday' : occasion.toLowerCase()
      } direction clean. This look now scores ${nextScore}%!`
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Screen Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.kicker, { color: '#4D9A65' }]}>DRESS TO IMPRESS</Text>
            <Text style={[styles.title, { color: theme.text }]}>Your Outfit, Styled Around You</Text>
          </View>
          <Pressable onPress={generateOutfit} style={styles.refresh} accessibilityLabel="Refresh outfits">
            <Ionicons name="refresh" size={19} color="#4D9A65" />
          </Pressable>
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
                System Catalog / Mix
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
          <MelMascot size={60} outfit="smart_layered" />
          <MelSpeechBubble variant="smart_layered" message={reaction} position="inline" />
        </View>

        {/* Interactive Styling Stage: 2D Human Avatar on Left + Infinite Vertical Wheel on Right */}
        <View style={styles.stage}>
          {/* Left Pane: 2D Human Avatar */}
          <View style={styles.leftPane}>
            <Mannequin2D
              profile={profile}
              items={activeOutfit?.clothingItems || []}
              onSelectSlot={() => setCustomizing(true)}
            />
          </View>

          {/* Right Pane: True Infinite-Loop Vertical Wheel with PanResponder */}
          <View style={styles.rightPane} {...panResponder.panHandlers}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <Ionicons name="sync-outline" size={24} color="#4D9A65" />
                <Text style={styles.loading}>Mel is styling your look…</Text>
              </View>
            ) : wheel.length ? (
              <>
                {wheel.map((item) => (
                  <WheelCard
                    key={`${item.outfit.id}-${item.position}`}
                    outfit={item.outfit}
                    rankLabel={item.rankLabel}
                    active={item.isCenter}
                    onPress={() => handleSelectCard(item.position)}
                    scaleAnim={wheelAnim}
                  />
                ))}

                {/* Sub-controls to cycle up or down */}
                <View style={styles.wheelControls}>
                  <Pressable
                    onPress={() => cycle(-1)}
                    style={styles.cycleButton}
                    accessibilityLabel="Cycle wheel up"
                  >
                    <Ionicons name="chevron-up" size={18} color="#264C3B" />
                  </Pressable>
                  <Pressable
                    onPress={() => cycle(1)}
                    style={styles.cycleButton}
                    accessibilityLabel="Cycle wheel down"
                  >
                    <Ionicons name="chevron-down" size={18} color="#264C3B" />
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.loading}>Preparing your first three looks…</Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Focused Customizer Modal */}
      {activeOutfit && (
        <OutfitCustomizeModal
          visible={customizing}
          outfit={activeOutfit}
          profile={profile}
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
    paddingBottom: 12,
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
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    maxWidth: 300,
    marginTop: 2,
  },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAF3D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E6DB',
    borderRadius: 17,
    padding: 12,
    gap: 8,
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
    marginTop: 10,
    backgroundColor: '#EAF3D9',
    borderRadius: 14,
    padding: 12,
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
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
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
    minHeight: 450,
    gap: 8,
  },
  leftPane: {
    flex: 1.15,
    borderRadius: 20,
    backgroundColor: '#F3F6EC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E1E6DB',
  },
  rightPane: {
    flex: 0.85,
    justifyContent: 'center',
    gap: 8,
  },
  wheelCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCE1D6',
  },
  wheelCardActive: {
    borderColor: '#F07E57',
    borderWidth: 2,
    shadowColor: '#F07E57',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  wheelCardInactive: {
    opacity: 0.78,
  },
  cardInner: {
    padding: 10,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  rankBadgeActive: {
    backgroundColor: '#FFF2EB',
  },
  rankBadgeInactive: {
    backgroundColor: '#F0F3EC',
  },
  rankText: {
    color: '#819084',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rankTextActive: {
    color: '#F07E57',
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
  cardTitle: {
    color: '#264C3B',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
  },
  cardTitleActive: {
    color: '#1A3327',
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
  cardHint: {
    color: '#8C978E',
    fontSize: 9,
    fontWeight: '700',
    flex: 1,
  },
  cardHintActive: {
    color: '#F07E57',
  },
  wheelControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  cycleButton: {
    width: 32,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EAF3D9',
    alignItems: 'center',
    justifyContent: 'center',
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
