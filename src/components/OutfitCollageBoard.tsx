import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useWeather } from '../hooks/useWeather';
import { useToast } from '../contexts/ToastContext';
import { AnatomicalSlotType, ClothingRole, GeneratedOutfit, OutfitClothingItem } from '../types';
import {
  buildColorHarmonyExplanation,
  buildHowToWearBullets,
  classifyAnatomicalSlot,
  colorNameToHex,
  getBodyPlacementBadge,
  styleAroundPinnedSlots,
} from '../services/outfitRecommendationService';
import { getDatasetPicksForSlot, resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';

const SLOT_LABELS: Record<AnatomicalSlotType, { title: string; role: ClothingRole }> = {
  innerTop: { title: 'Base Top', role: 'Top' },
  outerLayer: { title: 'Outerwear / Layer', role: 'Outerwear' },
  bottom: { title: 'Bottom / Pants', role: 'Bottom' },
  shoes: { title: 'Shoes', role: 'Shoes' },
  accessory: { title: 'Accessory', role: 'Accessory' },
};

export default function OutfitCollageBoard({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();
  const { items: wardrobeItems } = useWardrobe();
  const { occasion, noNewClothesMode, updateOutfitEverywhere } = useOutfit();
  const { weather } = useWeather();
  const { showToast } = useToast();

  const [selectedSlot, setSelectedSlot] = useState<AnatomicalSlotType | null>(null);
  const [trayTab, setTrayTab] = useState<'closet' | 'dataset'>('closet');

  const isDark = theme.mode === 'dark';
  const boardBg = isDark ? '#23172B' : '#FAF7F0';
  const activeSlotBorder = isDark ? '#FBF5A7' : '#4B1D6F';

  const baseScore = outfit.hybridScore ?? outfit.matchPercent;
  const colorHarmony = outfit.contentScore ?? Math.min(99, Math.round(baseScore * 0.96));
  const creativity = outfit.collaborativeScore ?? Math.min(99, Math.round(baseScore * 0.94));
  const styleMatch = Math.round(0.55 * colorHarmony + 0.45 * creativity);

  // Map current outfit items into the 5 spatial flat-lay slots (preserving exact wardrobe names, colors, and photos!)
  const slotItemsMap = useMemo(() => {
    const map: Partial<Record<AnatomicalSlotType, OutfitClothingItem>> = {};
    outfit.clothingItems.forEach((item) => {
      const detectedSlot = item.slotType || classifyAnatomicalSlot(item.name, item.category);
      if (!map[detectedSlot]) {
        const realPhoto = resolveDatasetGarmentPhoto(item.name, item.category, item.image);
        map[detectedSlot] = {
          ...item,
          image: realPhoto,
          slotType: detectedSlot,
          color: item.color || 'Neutral',
          hexColor: item.hexColor || colorNameToHex(item.color),
          placementBadge:
            item.placementBadge ||
            getBodyPlacementBadge(item, detectedSlot, outfit.occasionLabel || occasion),
        };
      }
    });

    // Ensure Base Top (innerTop) is always populated — prefer user's actual clean wardrobe top first!
    if (!map.innerTop) {
      const userTop =
        wardrobeItems.find(
          (w) => w.status === 'clean' && classifyAnatomicalSlot(w.name, w.category) === 'innerTop'
        ) || wardrobeItems.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'innerTop');

      if (userTop) {
        map.innerTop = {
          id: userTop.id,
          name: userTop.name,
          category: 'Top',
          image: resolveDatasetGarmentPhoto(userTop.name, userTop.category, userTop.image),
          color: userTop.color || 'Neutral',
          hexColor: colorNameToHex(userTop.color),
          slotType: 'innerTop',
          isSuggested: false,
        };
      } else {
        const dsPick = getDatasetPicksForSlot('innerTop', outfit.occasionLabel || occasion)[0];
        map.innerTop = {
          id: dsPick.id,
          name: dsPick.name,
          category: 'Top',
          image: dsPick.imageUri,
          color: dsPick.color,
          hexColor: dsPick.colorHex,
          slotType: 'innerTop',
          isSuggested: true,
          suggestedLabel: 'Dataset Pick',
        };
      }
    }

    return map;
  }, [outfit.clothingItems, outfit.occasionLabel, occasion, wardrobeItems]);

  // Build candidate lists for the selected slot: (1) My Closet vs (2) Dataset Picks
  const closetCandidates = useMemo(() => {
    if (!selectedSlot) return [];
    const role = SLOT_LABELS[selectedSlot].role;
    return wardrobeItems
      .filter((w) => {
        const slot = classifyAnatomicalSlot(w.name, w.category);
        if (slot !== selectedSlot) return false;
        return slot === 'accessory' || w.status === 'clean';
      })
      .map(
        (w): OutfitClothingItem => ({
          id: w.id,
          name: w.name,
          category: role,
          image: resolveDatasetGarmentPhoto(w.name, w.category, w.image),
          color: w.color || 'Neutral',
          hexColor: colorNameToHex(w.color),
          slotType: selectedSlot,
          status: 'clean',
          isSuggested: false,
        })
      );
  }, [selectedSlot, wardrobeItems]);

  const datasetCandidates = useMemo(() => {
    if (!selectedSlot) return [];
    const picks = getDatasetPicksForSlot(selectedSlot, outfit.occasionLabel || occasion);
    return picks.map(
      (p): OutfitClothingItem => ({
        id: p.id,
        name: p.name,
        category: p.category,
        image: p.imageUri,
        color: p.color,
        hexColor: p.colorHex,
        slotType: selectedSlot,
        status: 'clean',
        isSuggested: true,
        suggestedLabel: 'Dataset Pick',
      })
    );
  }, [selectedSlot, outfit.occasionLabel, occasion]);

  const applyUpdatedMap = (nextMap: Partial<Record<AnatomicalSlotType, OutfitClothingItem>>) => {
    const orderedSlots: AnatomicalSlotType[] = ['accessory', 'innerTop', 'outerLayer', 'bottom', 'shoes'];
    const nextItems = orderedSlots.map((s) => nextMap[s]).filter(Boolean) as OutfitClothingItem[];
    const nextPalette = nextItems.slice(0, 4).map((it) => ({
      name: `${it.color || 'Neutral'} (${it.category})`,
      hex: it.hexColor || colorNameToHex(it.color),
    }));
    const nextBullets = buildHowToWearBullets(nextItems, outfit.occasionLabel || occasion);
    const nextHarmony = buildColorHarmonyExplanation(nextPalette);

    const inner = nextMap.innerTop;
    const outer = nextMap.outerLayer;
    const bottom = nextMap.bottom;
    const occPrefix = `${outfit.occasionLabel || 'Curated'} Look`;
    let nextName = outfit.name;
    if (inner && outer) {
      nextName = `${occPrefix} · ${inner.name} + ${outer.name}`;
    } else if (inner && bottom) {
      nextName = `${occPrefix} · ${inner.name} & ${bottom.name}`;
    } else if (inner) {
      nextName = `${occPrefix} · ${inner.name}`;
    }

    updateOutfitEverywhere(outfit.id, {
      name: nextName,
      image: inner?.image || outer?.image || outfit.image,
      clothingItems: nextItems,
      colorPalette: nextPalette,
      howToWearBullets: nextBullets,
      colorHarmonyExplanation: nextHarmony,
    });
  };

  const handleSelectTrayItem = (candidate: OutfitClothingItem) => {
    if (!selectedSlot) return;
    const nextMap = { ...slotItemsMap, [selectedSlot]: candidate };
    applyUpdatedMap(nextMap);
    showToast(`Swapped ${SLOT_LABELS[selectedSlot].title} to ${candidate.name}`);
  };

  const handleAutoMatchRest = () => {
    const lockedMap: Partial<Record<AnatomicalSlotType, OutfitClothingItem>> = {};
    if (selectedSlot && slotItemsMap[selectedSlot]) {
      lockedMap[selectedSlot] = slotItemsMap[selectedSlot];
    } else if (slotItemsMap.innerTop) {
      lockedMap.innerTop = slotItemsMap.innerTop;
    }

    const styled = styleAroundPinnedSlots(
      outfit,
      lockedMap,
      wardrobeItems,
      outfit.occasionLabel || occasion,
      weather,
      noNewClothesMode
    );

    updateOutfitEverywhere(outfit.id, {
      name: styled.name,
      image: styled.image,
      clothingItems: styled.clothingItems,
      colorPalette: styled.colorPalette,
      howToWearBullets: styled.howToWearBullets,
      colorHarmonyExplanation: styled.colorHarmonyExplanation,
      hybridScore: styled.hybridScore,
      contentScore: styled.contentScore,
      collaborativeScore: styled.collaborativeScore,
      matchPercent: styled.matchPercent,
      whyReasons: styled.whyReasons,
    });

    const anchorName =
      (selectedSlot && slotItemsMap[selectedSlot]?.name) || slotItemsMap.innerTop?.name || 'your piece';
    showToast(`✨ Auto-matched rest of outfit around ${anchorName}!`);
  };

  const handleTapSlot = (slot: AnatomicalSlotType) => {
    if (selectedSlot === slot) {
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot(slot);
    // Default to 'closet' tab if user has clean closet items for this slot, otherwise 'dataset'
    const hasClosetForSlot = wardrobeItems.some(
      (w) =>
        classifyAnatomicalSlot(w.name, w.category) === slot &&
        (slot === 'accessory' || w.status === 'clean')
    );
    setTrayTab(hasClosetForSlot ? 'closet' : 'dataset');
  };

  const activePalette = useMemo(
    () =>
      outfit.colorPalette && outfit.colorPalette.length > 0
        ? outfit.colorPalette
        : (Object.values(slotItemsMap).filter(Boolean) as OutfitClothingItem[]).slice(0, 4).map((it) => ({
            name: `${it.color || 'Neutral'} (${it.category})`,
            hex: it.hexColor || colorNameToHex(it.color),
          })),
    [outfit.colorPalette, slotItemsMap]
  );

  const innerTop = slotItemsMap.innerTop;
  const outerLayer = slotItemsMap.outerLayer;
  const bottom = slotItemsMap.bottom;
  const shoes = slotItemsMap.shoes;
  const accessory = slotItemsMap.accessory;

  const activeTrayItems = trayTab === 'closet' ? closetCandidates : datasetCandidates;

  const renderCollageTile = (
    slot: AnatomicalSlotType,
    item: OutfitClothingItem | undefined,
    extraBadge?: string,
    compact = false
  ) => {
    const isSelected = selectedSlot === slot;
    const fallbackPick = getDatasetPicksForSlot(slot, outfit.occasionLabel || occasion)[0];
    const displayItem = item || {
      id: fallbackPick.id,
      name: fallbackPick.name,
      category: fallbackPick.category,
      image: fallbackPick.imageUri,
      color: fallbackPick.color,
      hexColor: fallbackPick.colorHex,
      isSuggested: true,
      suggestedLabel: 'Dataset Pick',
    };

    return (
      <Pressable
        onPress={() => handleTapSlot(slot)}
        style={[
          styles.collageCard,
          compact && styles.collageCardCompact,
          {
            backgroundColor: theme.surface,
            borderColor: isSelected ? activeSlotBorder : theme.border,
            borderWidth: isSelected ? 2.5 : 1,
          },
        ]}
      >
        <View style={[styles.tileImageWrap, compact && styles.tileImageWrapCompact]}>
          <Image
            source={{ uri: displayItem.image }}
            style={styles.tileImage}
            contentFit="cover"
            transition={200}
          />
          {extraBadge && (
            <View style={[styles.layerOverlayBadge, { backgroundColor: theme.secondaryAccent }]}>
              <Text style={[styles.layerOverlayBadgeText, { color: theme.onAccent }]}>
                {extraBadge}
              </Text>
            </View>
          )}
          {displayItem.isSuggested && (
            <View style={[styles.datasetPickPill, { backgroundColor: theme.aiPillBg }]}>
              <Text style={[styles.datasetPickPillText, { color: theme.aiPillText }]}>
                Dataset Pick
              </Text>
            </View>
          )}
        </View>
        <View style={styles.tileFooter}>
          <Text style={[styles.tileCategoryLabel, { color: theme.accentText }]}>
            {SLOT_LABELS[slot].title}
          </Text>
          <Text style={[styles.tileItemName, { color: theme.text }]} numberOfLines={1}>
            {displayItem.name}
          </Text>
          <View style={styles.tileColorRow}>
            <View
              style={[
                styles.colorDot,
                { backgroundColor: displayItem.hexColor || colorNameToHex(displayItem.color) },
              ]}
            />
            <Text style={[styles.tileColorText, { color: theme.textMuted }]} numberOfLines={1}>
              {displayItem.color || 'Neutral'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* EDITORIAL FLAT-LAY OUTFIT COLLAGE CANVAS */}
      <View
        style={[
          styles.collageBoard,
          {
            backgroundColor: boardBg,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Top Bar inside Moodboard: Floating Swatch Dots + 94% Style Match Badge */}
        <View style={styles.boardTopBar}>
          <View style={[styles.swatchFloatingPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {activePalette.map((swatch, idx) => (
              <View
                key={`${swatch.name}-${idx}`}
                style={[styles.floatingSwatchCircle, { backgroundColor: swatch.hex }]}
              />
            ))}
            <Text style={[styles.swatchPillLabel, { color: theme.textMuted }]}>Palette</Text>
          </View>

          <View
            style={[
              styles.matchCornerBadge,
              { backgroundColor: isDark ? '#FBF5A7' : '#24152C' },
            ]}
          >
            <Ionicons
              name="sparkles"
              size={12}
              color={isDark ? '#24152C' : '#FBF5A7'}
            />
            <Text
              style={[
                styles.matchCornerBadgeText,
                { color: isDark ? '#24152C' : '#FBF5A7' },
              ]}
            >
              {styleMatch}% Style Match
            </Text>
          </View>
        </View>

        {/* Upper Row: Upper-Left Base Top + Upper-Right Overlapping Outerwear/Layer */}
        <View style={styles.upperCollageRow}>
          <View style={styles.upperLeftCol}>
            {renderCollageTile('innerTop', innerTop, 'Wear 1st')}
          </View>
          <View style={styles.upperRightOverlapCol}>
            {renderCollageTile('outerLayer', outerLayer, 'Layered Over Top')}
          </View>
        </View>

        {/* Lower Row: Lower-Left Bottom/Pants + Lower-Right Shoes */}
        <View style={styles.lowerCollageRow}>
          <View style={styles.lowerLeftCol}>
            {renderCollageTile('bottom', bottom)}
          </View>
          <View style={styles.lowerRightCol}>
            {renderCollageTile('shoes', shoes)}
          </View>
        </View>

        {/* Side Floating Accessory Badge + Tap-to-Swap Hint */}
        <View style={styles.accessoryFloatingRow}>
          <Pressable
            onPress={() => handleTapSlot('accessory')}
            style={[
              styles.accessoryBadgeCard,
              {
                backgroundColor: theme.surface,
                borderColor: selectedSlot === 'accessory' ? activeSlotBorder : theme.border,
                borderWidth: selectedSlot === 'accessory' ? 2.5 : 1,
              },
            ]}
          >
            <Image
              source={{
                uri:
                  accessory?.image ||
                  getDatasetPicksForSlot('accessory', outfit.occasionLabel || occasion)[0].imageUri,
              }}
              style={styles.accessoryThumb}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <View style={styles.accTitleRow}>
                <Text style={[styles.tileCategoryLabel, { color: theme.accentText }]}>
                  ⌚ Accessory
                </Text>
                {(accessory?.isSuggested || !accessory) && (
                  <View style={[styles.miniDatasetPill, { backgroundColor: theme.aiPillBg }]}>
                    <Text style={[styles.miniDatasetPillText, { color: theme.aiPillText }]}>
                      Dataset Pick
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tileItemName, { color: theme.text }]} numberOfLines={1}>
                {accessory?.name ||
                  getDatasetPicksForSlot('accessory', outfit.occasionLabel || occasion)[0].name}
              </Text>
              <Text style={[styles.tileColorText, { color: theme.textMuted }]}>
                {accessory?.color || 'Gray'} · Tap to swap
              </Text>
            </View>
            <Ionicons name="swap-horizontal-outline" size={16} color={theme.accentText} />
          </Pressable>
        </View>

        <Text style={[styles.tapHintText, { color: theme.textMuted }]}>
          👆 Tap any garment card on the moodboard to swap pieces
        </Text>
      </View>

      {/* INTERACTIVE TAP-TO-SWAP BOTTOM CLOSET TRAY (CO-STYLIST) */}
      {selectedSlot && (
        <View
          style={[
            styles.swapperTray,
            {
              backgroundColor: theme.surface,
              borderColor: activeSlotBorder,
            },
          ]}
        >
          <View style={styles.trayHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trayTitle, { color: theme.text }]}>
                Swap {SLOT_LABELS[selectedSlot].title}
              </Text>
              <Text style={[styles.traySubtitle, { color: theme.textMuted }]}>
                Tap a thumbnail to swap onto the board
              </Text>
            </View>

            <Pressable
              onPress={handleAutoMatchRest}
              style={[styles.autoMatchBtn, { backgroundColor: theme.secondaryAccent }]}
            >
              <Text style={[styles.autoMatchBtnText, { color: theme.onAccent }]}>
                ✨ Auto-Match Rest
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedSlot(null)}
              style={[styles.closeTrayBtn, { backgroundColor: theme.background }]}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={theme.text} />
            </Pressable>
          </View>

          {/* 2 Small Pill Tabs: 👕 My Closet vs ✨ Dataset Picks */}
          <View style={styles.trayTabsRow}>
            <Pressable
              onPress={() => setTrayTab('closet')}
              style={[
                styles.trayTabPill,
                {
                  backgroundColor: trayTab === 'closet' ? theme.secondaryAccent : theme.background,
                  borderColor: trayTab === 'closet' ? theme.secondaryAccent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.trayTabPillText,
                  { color: trayTab === 'closet' ? theme.onAccent : theme.text },
                ]}
              >
                👕 My Closet ({closetCandidates.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTrayTab('dataset')}
              style={[
                styles.trayTabPill,
                {
                  backgroundColor: trayTab === 'dataset' ? theme.secondaryAccent : theme.background,
                  borderColor: trayTab === 'dataset' ? theme.secondaryAccent : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.trayTabPillText,
                  { color: trayTab === 'dataset' ? theme.onAccent : theme.text },
                ]}
              >
                ✨ Dataset Picks ({datasetCandidates.length})
              </Text>
            </Pressable>
          </View>

          {activeTrayItems.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trayScrollContent}
            >
              {activeTrayItems.map((candidate) => {
                const isCurrent = slotItemsMap[selectedSlot]?.id === candidate.id;
                return (
                  <Pressable
                    key={candidate.id}
                    onPress={() => handleSelectTrayItem(candidate)}
                    style={[
                      styles.trayItemCard,
                      {
                        backgroundColor: theme.background,
                        borderColor: isCurrent ? activeSlotBorder : theme.border,
                        borderWidth: isCurrent ? 2 : 1,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: candidate.image }}
                      style={styles.trayItemImage}
                      contentFit="cover"
                    />
                    {candidate.isSuggested && (
                      <View style={[styles.trayDatasetTag, { backgroundColor: theme.aiPillBg }]}>
                        <Text style={[styles.trayDatasetTagText, { color: theme.aiPillText }]}>
                          Dataset Pick
                        </Text>
                      </View>
                    )}
                    <Text
                      style={[styles.trayItemName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {candidate.name}
                    </Text>
                    <Text
                      style={[styles.trayItemColor, { color: theme.textMuted }]}
                      numberOfLines={1}
                    >
                      {candidate.color}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyClosetTray}>
              <Text style={[styles.emptyClosetText, { color: theme.textMuted }]}>
                No clean {SLOT_LABELS[selectedSlot].title.toLowerCase()} in your closet yet.
              </Text>
              <Pressable
                onPress={() => setTrayTab('dataset')}
                style={[styles.switchDatasetBtn, { backgroundColor: theme.aiPillBg }]}
              >
                <Text style={[styles.switchDatasetBtnText, { color: theme.aiPillText }]}>
                  Browse ✨ Dataset Picks
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  collageBoard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  boardTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swatchFloatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  floatingSwatchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  swatchPillLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginLeft: 2,
  },
  matchCornerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  matchCornerBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  upperCollageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  upperLeftCol: {
    flex: 1,
    zIndex: 1,
    marginRight: -8,
  },
  upperRightOverlapCol: {
    flex: 1,
    zIndex: 2,
    marginTop: 12,
    marginLeft: -6,
  },
  lowerCollageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  lowerLeftCol: {
    flex: 1,
  },
  lowerRightCol: {
    flex: 1,
  },
  collageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  collageCardCompact: {
    borderRadius: 14,
  },
  tileImageWrap: {
    width: '100%',
    height: 132,
    position: 'relative',
    backgroundColor: '#E5E0D8',
  },
  tileImageWrapCompact: {
    height: 100,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  layerOverlayBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  layerOverlayBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  datasetPickPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  datasetPickPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tileFooter: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  tileCategoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tileItemName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  tileColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  tileColorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  accessoryFloatingRow: {
    marginTop: 2,
  },
  accessoryBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
  },
  accessoryThumb: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#E5E0D8',
  },
  accTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDatasetPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 999,
  },
  miniDatasetPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tapHintText: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  swapperTray: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 12,
    gap: 10,
  },
  trayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trayTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  traySubtitle: {
    fontSize: 11,
  },
  autoMatchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  autoMatchBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeTrayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  trayTabPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  trayTabPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  trayScrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  trayItemCard: {
    width: 106,
    borderRadius: 12,
    padding: 6,
    gap: 3,
  },
  trayItemImage: {
    width: '100%',
    height: 82,
    borderRadius: 8,
    backgroundColor: '#E5E0D8',
  },
  trayDatasetTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  trayDatasetTagText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  trayItemName: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  trayItemColor: {
    fontSize: 10.5,
  },
  emptyClosetTray: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  emptyClosetText: {
    fontSize: 12,
    textAlign: 'center',
  },
  switchDatasetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  switchDatasetBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});

