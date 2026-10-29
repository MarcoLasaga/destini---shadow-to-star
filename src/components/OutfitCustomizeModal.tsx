import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MelMascot, MelSpeechBubble } from './MelMascot';
import AltaOutfitCollage from './AltaOutfitCollage';
import { MannequinSlot, resolveGarmentHex } from './Mannequin2D';
import { GeneratedOutfit, OutfitClothingItem, UserProfile, WeatherData } from '../types';
import { MiniGarmentSvg, resolveGarmentImageUrl } from '../utils/garmentImageHelper';
import { computeAccurateOutfitScore } from '../services/hybridScoreService';
import { useToast } from '../contexts/ToastContext';
import { inferAccessoryZone, AccessoryZone } from '../services/outfitRecommendationService';

const ACCESSORY_ZONES: { id: 'ALL' | AccessoryZone; label: string }[] = [
  { id: 'ALL', label: 'All Zones' },
  { id: 'ears', label: '💎 Ears' },
  { id: 'neck', label: '📿 Neck' },
  { id: 'wrist', label: '⌚ Wrist' },
  { id: 'waist_bag', label: '👜 Waist/Bag' },
  { id: 'head', label: '🕶️ Head/Eyes' },
];

const SLOT_LABELS: Record<MannequinSlot, string> = {
  TOP: '1. TOP',
  OUTERWEAR: '2. OUTERWEAR',
  BOTTOM: '3. BOTTOM',
  SHOES: '4. SHOES',
  ACCESSORIES: '5. ACCESSORIES',
};

const toSlot = (item: OutfitClothingItem): MannequinSlot => {
  if (item.slotType === 'outerLayer') return 'OUTERWEAR';
  if (item.slotType === 'bottom') return 'BOTTOM';
  if (item.slotType === 'shoes') return 'SHOES';
  if (item.slotType === 'accessory') return 'ACCESSORIES';
  const name = (item.name || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  if (/hoodie|jacket|blazer|coat|cardigan|sweatshirt|crewneck|vest|bomber|parka/.test(name) || cat === 'outerwear') {
    return 'OUTERWEAR';
  }
  if (/jean|denim|pant|trouser|chino|short|skirt|cargo/.test(name) || cat === 'bottom') {
    return 'BOTTOM';
  }
  if (/shoe|sneaker|boot|loafer|sandal|slipper|heel|flat/.test(name) || cat === 'shoes') {
    return 'SHOES';
  }
  if (/watch|sunglass|glasses|belt|bag|tote|necklace|chain|airpod/.test(name) || cat === 'accessory' || cat === 'accessories') {
    return 'ACCESSORIES';
  }
  return 'TOP';
};

interface Props {
  visible: boolean;
  outfit: GeneratedOutfit;
  profile?: Partial<UserProfile> | null;
  weather?: WeatherData | null;
  suggestions: OutfitClothingItem[];
  sourceMode?: 'wardrobe' | 'mix' | 'closet' | 'bestForOccasion';
  onClose: () => void;
  onEquip: (item: OutfitClothingItem | null, slot: MannequinSlot) => void;
}

const CARD_WIDTH = 126;
const CARD_GAP = 10;

export default function OutfitCustomizeModal({
  visible,
  outfit,
  profile,
  weather,
  suggestions,
  sourceMode = 'mix',
  onClose,
  onEquip,
}: Props) {
  const { showToast } = useToast();
  const [activeSlot, setActiveSlot] = useState<MannequinSlot>('TOP');
  const [accessoryZoneFilter, setAccessoryZoneFilter] = useState<'ALL' | AccessoryZone>('ALL');
  const isWardrobeOnly = sourceMode === 'wardrobe' || sourceMode === 'closet';
  const equipped = outfit.clothingItems || [];
  const activeItem = equipped.find((item) => toSlot(item) === activeSlot) ?? null;

  const hasOuter = equipped.some((item) => toSlot(item) === 'OUTERWEAR');
  const isXrayOuterwear = hasOuter && activeSlot === 'TOP';

  // Choreographed In-Place Transition Animations
  const zoomAnim = useRef(new Animated.Value(0.94)).current;
  const slideRightAnim = useRef(new Animated.Value(110)).current;
  const slideUpAnim = useRef(new Animated.Value(130)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Accurate live hybrid score calculation
  const currentScore = useMemo(() => {
    return computeAccurateOutfitScore(equipped, profile, weather, outfit.occasionLabel);
  }, [equipped, profile, weather, outfit.occasionLabel]);

  const [scoreDelta, setScoreDelta] = useState<number | null>(null);
  const [lastEquippedItem, setLastEquippedItem] = useState<OutfitClothingItem | null>(null);
  const prevScoreRef = useRef(currentScore);

  useEffect(() => {
    if (prevScoreRef.current !== currentScore) {
      const delta = currentScore - prevScoreRef.current;
      setScoreDelta(delta);
      prevScoreRef.current = currentScore;
    }
  }, [currentScore]);

  // CIELAB Color Harmony Analysis & Quick Styling Guidance Pills
  const colorHarmony = useMemo(() => {
    const dots = equipped.map((item) => ({
      name: item.name,
      hex: resolveGarmentHex(item),
    }));

    const hexes = dots.map((d) => d.hex.toLowerCase());
    const hasWarmEarth = hexes.some((h) => ['#6e473b', '#c8b696', '#d2b48c', '#4a5d4e'].includes(h));
    const hasNavyBlue = hexes.some((h) => ['#1e2f4d', '#3b6ea5', '#3d5a80'].includes(h));
    const isMono = hexes.length > 0 && hexes.every((h) => ['#f5f5f0', '#1e2022', '#7d8491', '#ffffff', '#000000'].includes(h));

    let tag = 'Balanced Neutral Anchor';
    let pills = ['Layer Jacket Open', 'Sleeves Rolled'];
    if (hasWarmEarth) {
      tag = 'Warm Earth-Tone Match';
      pills = ['Tuck Front Hem', 'Match Leather Accents'];
    } else if (hasNavyBlue) {
      tag = 'Classic Maritime Harmony';
      pills = ['Clean Ankle Break', 'Minimalist Watch'];
    } else if (isMono) {
      tag = 'Monochrome Minimalist';
      pills = ['Contrast Sneaker Soles', 'Clean Lines'];
    }

    return { dots, tag, pills };
  }, [equipped]);

  useEffect(() => {
    if (visible) {
      zoomAnim.setValue(0.94);
      slideRightAnim.setValue(110);
      slideUpAnim.setValue(130);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.spring(zoomAnim, {
          toValue: 1.04,
          useNativeDriver: true,
          friction: 7,
          tension: 65,
        }),
        Animated.spring(slideRightAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 65,
        }),
        Animated.spring(slideUpAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
          tension: 65,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, zoomAnim, slideRightAnim, slideUpAnim, fadeAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(zoomAnim, {
        toValue: 0.94,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideRightAnim, {
        toValue: 110,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 130,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleItemEquip = (item: OutfitClothingItem | null, slot: MannequinSlot) => {
    setLastEquippedItem(item);
    onEquip(item, slot);
  };

  const handleWearToday = () => {
    showToast('✨ Outfit confirmed for today! Looking sharp.');
    handleClose();
  };

  // Filter compatible suggestions for this slot (with strict wardrobe separation)
  const slotSuggestions = useMemo(() => {
    let list = suggestions.filter((item) => toSlot(item) === activeSlot);

    // In strict My Wardrobe mode, ONLY display items from the user's uploaded wardrobe
    if (isWardrobeOnly) {
      list = list.filter((item) => item.isSuggested !== true && !item.id?.startsWith('dataset-'));
    }

    if (activeSlot === 'ACCESSORIES' && accessoryZoneFilter !== 'ALL') {
      return list.filter((item) => inferAccessoryZone(item) === accessoryZoneFilter);
    }
    return list;
  }, [suggestions, activeSlot, accessoryZoneFilter, isWardrobeOnly]);

  let reaction = `Live outfit match score: ${currentScore}%. Tap any piece below to equip on your avatar!`;
  if (scoreDelta !== null && lastEquippedItem) {
    if (scoreDelta > 0) {
      reaction = `+${scoreDelta}% Match (${currentScore}%)! ${lastEquippedItem.name} coordinates cleanly with this look!`;
    } else if (scoreDelta < 0) {
      reaction = `${scoreDelta}% (${currentScore}%). Adds high-contrast variety to your ${outfit.occasionLabel || 'look'}!`;
    } else {
      reaction = `Equipped ${lastEquippedItem.name} (${currentScore}% match). Still well-balanced!`;
    }
  } else if (!activeItem) {
    reaction = `Deselected ${SLOT_LABELS[activeSlot]}. Showing clean inner base layer (${currentScore}% match).`;
  } else if (activeItem) {
    reaction = `Your ${activeItem.name.toLowerCase()} gives this look character (${currentScore}% match). Tap pieces below to swap!`;
  }

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>AI OUTFIT STUDIO</Text>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Customize Outfit</Text>
              <View style={styles.scorePill}>
                <Ionicons name="sparkles" size={12} color="#264C3B" />
                <Text style={styles.scorePillText}>{currentScore}%</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons: Wear Today + Close */}
          <View style={styles.headerRightActions}>
            <Pressable
              onPress={handleWearToday}
              style={styles.wearTodayBtn}
              accessibilityLabel="Wear this outfit today"
            >
              <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
              <Text style={styles.wearTodayText}>Wear Today</Text>
            </Pressable>
            <Pressable onPress={handleClose} style={styles.close} accessibilityLabel="Close customizer">
              <Ionicons name="close" size={20} color="#264C3B" />
            </Pressable>
          </View>
        </View>

        {/* Dedicated Mel Mascot & Speech Bubble Row */}
        <View style={styles.melRow}>
          <MelMascot size={56} outfit="cool_hoodie" />
          <MelSpeechBubble variant="cool_hoodie" message={reaction} position="inline" />
        </View>

        {/* CIELAB Color Harmony Bar & "How to Wear" Styling Guidance */}
        <View style={styles.harmonyBar}>
          <View style={styles.harmonyLeft}>
            <View style={styles.colorDotsRow}>
              {colorHarmony.dots.map((d, i) => (
                <View
                  key={`${d.hex}-${i}`}
                  style={[styles.harmonyDot, { backgroundColor: d.hex }]}
                />
              ))}
            </View>
            <Text style={styles.harmonyTag}>{colorHarmony.tag}</Text>
          </View>
          <View style={styles.stylingPillsRow}>
            {colorHarmony.pills.map((pill, i) => (
              <View key={i} style={styles.stylingPill}>
                <Text style={styles.stylingPillText}>{pill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Split Stage: ALTA Studio Collage on Left + Decomposed 5 Slots on Right */}
        <View style={styles.split}>
          <Animated.View style={[styles.mannequinPane, { transform: [{ scale: zoomAnim }] }]}>
            <AltaOutfitCollage
              items={equipped}
              compact
              interactive
            />
          </Animated.View>

          <Animated.View style={[styles.slotPane, { transform: [{ translateX: slideRightAnim }] }]}>
            <ScrollView contentContainerStyle={styles.slotContent} showsVerticalScrollIndicator={false}>
              {(['TOP', 'OUTERWEAR', 'BOTTOM', 'SHOES', 'ACCESSORIES'] as MannequinSlot[]).map((slot) => {
                const item = equipped.find((entry) => toSlot(entry) === slot);
                const isSelected = activeSlot === slot;
                const imgUrl = resolveGarmentImageUrl(item);
                const isDataset = item?.isSuggested || (item?.id && item.id.startsWith('dataset-'));

                return (
                  <Pressable
                    key={slot}
                    onPress={() => setActiveSlot(slot)}
                    style={[styles.slotCard, isSelected && styles.slotCardActive]}
                  >
                    <View style={styles.slotCardHeader}>
                      <Text style={[styles.slotLabel, isSelected && styles.slotLabelActive]}>
                        {SLOT_LABELS[slot]}
                      </Text>
                      <View style={styles.slotHeaderRight}>
                        {item && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleItemEquip(null, slot);
                            }}
                            hitSlop={8}
                            style={styles.slotUnequipBtn}
                            accessibilityLabel={`Unequip ${SLOT_LABELS[slot]}`}
                          >
                            <Ionicons name="close-circle" size={17} color="#DC2626" />
                          </Pressable>
                        )}
                        {item && (
                          <View
                            style={[
                              styles.slotColorDot,
                              { backgroundColor: resolveGarmentHex(item, '#F5F5F0') },
                            ]}
                          />
                        )}
                      </View>
                    </View>

                    <View style={styles.slotBodyRow}>
                      <View style={styles.slotThumbnail}>
                        {item ? (
                          imgUrl ? (
                            <Image source={{ uri: imgUrl }} style={styles.thumbImage} resizeMode="contain" />
                          ) : (
                            <MiniGarmentSvg
                              slot={slot}
                              name={item.name}
                              color={resolveGarmentHex(item, '#8BAA82')}
                              size={38}
                            />
                          )
                        ) : (
                          <Ionicons name="shirt-outline" size={20} color="#B5BFB7" />
                        )}
                      </View>

                      <View style={styles.slotDetails}>
                        <Text style={styles.slotName} numberOfLines={2}>
                          {item?.name || 'Inner base layer (None)'}
                        </Text>
                        <Text style={[styles.slotSource, isDataset && styles.datasetSourceText]}>
                          {item ? (isDataset ? 'Style Suggestion' : 'My Wardrobe') : 'Tap piece below to add'}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>

        {/* Bottom Drawer: Style Suggestions with Option 0 as "🚫 None (Unequip)" */}
        <Animated.View style={[styles.drawer, { transform: [{ translateY: slideUpAnim }] }]}>
          <View style={styles.drawerHeader}>
            <View>
              <Text style={styles.drawerTitle}>
                {isWardrobeOnly ? 'My Wardrobe' : 'Mix & Match'} · {SLOT_LABELS[activeSlot]}
              </Text>
              <Text style={styles.drawerHint}>
                Swipe cards · Tap to equip or deselect any piece
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {slotSuggestions.length} {slotSuggestions.length === 1 ? 'option' : 'options'}
              </Text>
            </View>
          </View>

          {/* Multi-Zone Accessory Filter Pills */}
          {activeSlot === 'ACCESSORIES' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.zoneFilterRow}
            >
              {ACCESSORY_ZONES.map((zone) => {
                const isActive = accessoryZoneFilter === zone.id;
                return (
                  <Pressable
                    key={zone.id}
                    onPress={() => setAccessoryZoneFilter(zone.id)}
                    style={[
                      styles.zoneFilterPill,
                      isActive && styles.zoneFilterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.zoneFilterText,
                        isActive && styles.zoneFilterTextActive,
                      ]}
                    >
                      {zone.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <FlatList
            horizontal
            data={slotSuggestions}
            keyExtractor={(item, index) => item.id || `sug-${index}-${item.name}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionRow}
            ListHeaderComponent={
              <Pressable
                onPress={() => handleItemEquip(null, activeSlot)}
                style={[
                  styles.suggestionCard,
                  !activeItem && styles.suggestionCardEquipped,
                  styles.noneCard,
                ]}
              >
                <View style={[styles.previewBox, { backgroundColor: '#F8F7F4' }]}>
                  <Ionicons name="ban-outline" size={28} color="#DC2626" />
                  {!activeItem && (
                    <View style={[styles.equippedBadge, { backgroundColor: '#475569' }]}>
                      <Text style={styles.equippedBadgeText}>Base</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.suggestionName} numberOfLines={1}>
                  None (Unequip)
                </Text>
                <View style={[styles.sourcePill, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.sourcePillText, { color: '#DC2626' }]}>Deselect</Text>
                </View>
              </Pressable>
            }
            renderItem={({ item }) => {
              const imageUrl = resolveGarmentImageUrl(item);
              const isDataset = item.isSuggested || (item.id && item.id.startsWith('dataset-'));
              const isEquipped = equipped.some((eq) => eq.id === item.id);
              const hexColor = resolveGarmentHex(item, '#3B414B');

              return (
                <Pressable
                  onPress={() => handleItemEquip(item, activeSlot)}
                  style={[styles.suggestionCard, isEquipped && styles.suggestionCardEquipped]}
                >
                  <View style={styles.previewBox}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.garmentPhoto} resizeMode="contain" />
                    ) : (
                      <MiniGarmentSvg
                        slot={activeSlot}
                        name={item.name}
                        color={hexColor}
                        secondaryColor={item.secondaryColor}
                        size={52}
                      />
                    )}

                    {/* Color Swatch Dot */}
                    <View
                      style={[
                        styles.colorDotBadge,
                        { backgroundColor: hexColor },
                      ]}
                    />

                    {isEquipped && (
                      <View style={styles.equippedBadge}>
                        <Text style={styles.equippedBadgeText}>Equipped</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.suggestionName} numberOfLines={2}>
                    {item.name}
                  </Text>

                  <View
                    style={[
                      styles.sourcePill,
                      isDataset ? styles.sourcePillDataset : styles.sourcePillWardrobe,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourcePillText,
                        isDataset ? styles.sourcePillTextDataset : styles.sourcePillTextWardrobe,
                      ]}
                    >
                      {isDataset ? 'Mix & Match' : 'My Wardrobe'}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F2',
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kicker: {
    color: '#4D9A65',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  title: {
    color: '#264C3B',
    fontSize: 20,
    fontWeight: '900',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EAF3D9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scorePillText: {
    color: '#264C3B',
    fontSize: 10.5,
    fontWeight: '900',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wearTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#264C3B',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  wearTodayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF3D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  melRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 9,
    borderWidth: 1,
    borderColor: '#E1E6DB',
    shadowColor: '#264C3B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  harmonyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#F3F6EC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E7DC',
  },
  harmonyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  harmonyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  harmonyTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#264C3B',
  },
  stylingPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stylingPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#D8E2D2',
  },
  stylingPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 8,
  },
  mannequinPane: {
    flex: 1.18,
    justifyContent: 'center',
    backgroundColor: '#F3F6EC',
    borderRadius: 18,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  slotPane: {
    flex: 0.82,
  },
  slotContent: {
    gap: 6,
    paddingBottom: 8,
  },
  slotCard: {
    borderWidth: 1.5,
    borderColor: '#DCE1D6',
    borderRadius: 13,
    padding: 8,
    backgroundColor: '#FFFFFF',
    minHeight: 64,
  },
  slotCardActive: {
    borderColor: '#F07E57',
    backgroundColor: '#FFF4EE',
  },
  slotCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  slotLabel: {
    color: '#4D9A65',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  slotLabelActive: {
    color: '#F07E57',
  },
  slotHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotUnequipBtn: {
    padding: 2,
  },
  slotColorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  slotBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 7,
    backgroundColor: '#F4F7EF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  slotDetails: {
    flex: 1,
  },
  slotName: {
    color: '#264C3B',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  slotSource: {
    color: '#7D8B81',
    fontSize: 8.5,
    marginTop: 1,
  },
  datasetSourceText: {
    color: '#5554B8',
  },
  drawer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E6DC',
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingBottom: 20,
  },
  drawerHeader: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  drawerTitle: {
    color: '#264C3B',
    fontSize: 14,
    fontWeight: '900',
  },
  drawerHint: {
    color: '#7B887E',
    fontSize: 10,
    marginTop: 1,
  },
  countBadge: {
    backgroundColor: '#EAF3D9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    color: '#264C3B',
    fontSize: 9.5,
    fontWeight: '800',
  },
  suggestionRow: {
    paddingHorizontal: 16,
    gap: CARD_GAP,
  },
  suggestionCard: {
    width: CARD_WIDTH,
    borderWidth: 1.5,
    borderColor: '#DCE1D6',
    borderRadius: 14,
    padding: 8,
    backgroundColor: '#FCFAF5',
  },
  noneCard: {
    marginRight: 6,
    borderColor: '#CBD5E1',
  },
  suggestionCardEquipped: {
    borderColor: '#4D9A65',
    backgroundColor: '#F0F7EB',
  },
  previewBox: {
    height: 70,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7EBE1',
  },
  garmentPhoto: {
    width: '88%',
    height: '88%',
  },
  colorDotBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  equippedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#4D9A65',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  equippedBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  suggestionName: {
    color: '#264C3B',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    minHeight: 28,
  },
  sourcePill: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  sourcePillWardrobe: {
    backgroundColor: '#EAF3D9',
  },
  sourcePillDataset: {
    backgroundColor: '#EDEBF9',
  },
  sourcePillText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  sourcePillTextWardrobe: {
    color: '#2E5B3E',
  },
  sourcePillTextDataset: {
    color: '#4B3AA6',
  },
  zoneFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
  },
  zoneFilterPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8DECE',
  },
  zoneFilterPillActive: {
    backgroundColor: '#264C3B',
    borderColor: '#264C3B',
  },
  zoneFilterText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#657468',
  },
  zoneFilterTextActive: {
    color: '#FFFFFF',
  },
});
