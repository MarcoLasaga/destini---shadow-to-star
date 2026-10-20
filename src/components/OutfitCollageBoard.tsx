import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useWeather } from '../hooks/useWeather';
import { useToast } from '../contexts/ToastContext';
import {
  AnatomicalSlotType,
  ClothingRole,
  GeneratedOutfit,
  OutfitClothingItem,
} from '../types';
import {
  buildColorHarmonyExplanation,
  buildHowToWearBullets,
  classifyAnatomicalSlot,
  colorNameToHex,
  getBodyPlacementBadge,
  styleAroundPinnedSlots,
} from '../services/outfitRecommendationService';
import {
  getDatasetPicksForSlot,
  resolveDatasetGarmentPhoto,
} from '../data/datasetGarmentCatalog';

const SLOT_LABELS: Record<AnatomicalSlotType, { title: string; shortTab: string; role: ClothingRole }> = {
  innerTop: { title: 'Inner Shirt / Top', shortTab: 'Top', role: 'Top' },
  bottom: { title: 'Pants / Bottom', shortTab: 'Bottom', role: 'Bottom' },
  outerLayer: { title: 'Outerwear / Layer', shortTab: 'Outerwear', role: 'Outerwear' },
  accessory: { title: 'Accessory', shortTab: 'Accessory', role: 'Accessory' },
  shoes: { title: 'Shoes / Footwear', shortTab: 'Shoes', role: 'Shoes' },
};

const SLOT_ORDER: AnatomicalSlotType[] = ['innerTop', 'bottom', 'outerLayer', 'accessory', 'shoes'];

interface OutfitCollageBoardProps {
  outfit: GeneratedOutfit;
  index?: number;
  totalCount?: number;
  editTrigger?: number;
  readOnly?: boolean;
}

export default function OutfitCollageBoard({
  outfit,
  index = 0,
  totalCount = 3,
  editTrigger = 0,
  readOnly = false,
}: OutfitCollageBoardProps) {
  const theme = useAppTheme();
  const { items: wardrobeItems } = useWardrobe();
  const { occasion, noNewClothesMode, updateOutfitEverywhere } = useOutfit();
  const { weather } = useWeather();
  const { showToast } = useToast();

  const [selectedSlot, setSelectedSlot] = useState<AnatomicalSlotType | null>(null);
  const [drawerSourceTab, setDrawerSourceTab] = useState<'closet' | 'suggestions'>('closet');

  // Open drawer when parent triggers edit button (✏️)
  useEffect(() => {
    if (editTrigger > 0 && !readOnly) {
      openSlotDrawer('innerTop');
    }
  }, [editTrigger]);

  const tempC =
    outfit.weatherTempF != null
      ? Math.round((outfit.weatherTempF - 32) * (5 / 9))
      : weather?.tempC ?? 29;
  const isWarmWeather = tempC >= 27;

  // Map current outfit items into the 5 spatial slots (strictly binding each item's real name, color, hexColor, and image)
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
          suggestedLabel: item.isSuggested ? 'Style Suggestion' : undefined,
          placementBadge:
            item.placementBadge ||
            getBodyPlacementBadge(item, detectedSlot, outfit.occasionLabel || occasion),
        };
      }
    });

    // Ensure Inner Shirt / Top (innerTop) is populated from user's clean closet first
    if (!map.innerTop && !readOnly) {
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
          suggestedLabel: 'Style Suggestion',
        };
      }
    }

    // Ensure Bottom is populated
    if (!map.bottom && !readOnly) {
      const userBottom =
        wardrobeItems.find(
          (w) => w.status === 'clean' && classifyAnatomicalSlot(w.name, w.category) === 'bottom'
        ) || wardrobeItems.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'bottom');

      if (userBottom) {
        map.bottom = {
          id: userBottom.id,
          name: userBottom.name,
          category: 'Bottom',
          image: resolveDatasetGarmentPhoto(userBottom.name, userBottom.category, userBottom.image),
          color: userBottom.color || 'Neutral',
          hexColor: colorNameToHex(userBottom.color),
          slotType: 'bottom',
          isSuggested: false,
        };
      } else {
        const dsPick = getDatasetPicksForSlot('bottom', outfit.occasionLabel || occasion)[0];
        map.bottom = {
          id: dsPick.id,
          name: dsPick.name,
          category: 'Bottom',
          image: dsPick.imageUri,
          color: dsPick.color,
          hexColor: dsPick.colorHex,
          slotType: 'bottom',
          isSuggested: true,
          suggestedLabel: 'Style Suggestion',
        };
      }
    }

    // Ensure Shoes is populated
    if (!map.shoes && !readOnly) {
      const userShoes =
        wardrobeItems.find(
          (w) => w.status === 'clean' && classifyAnatomicalSlot(w.name, w.category) === 'shoes'
        ) || wardrobeItems.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'shoes');

      if (userShoes) {
        map.shoes = {
          id: userShoes.id,
          name: userShoes.name,
          category: 'Shoes',
          image: resolveDatasetGarmentPhoto(userShoes.name, userShoes.category, userShoes.image),
          color: userShoes.color || 'Neutral',
          hexColor: colorNameToHex(userShoes.color),
          slotType: 'shoes',
          isSuggested: false,
        };
      } else {
        const dsPick = getDatasetPicksForSlot('shoes', outfit.occasionLabel || occasion)[0];
        map.shoes = {
          id: dsPick.id,
          name: dsPick.name,
          category: 'Shoes',
          image: dsPick.imageUri,
          color: dsPick.color,
          hexColor: dsPick.colorHex,
          slotType: 'shoes',
          isSuggested: true,
          suggestedLabel: 'Style Suggestion',
        };
      }
    }

    // Ensure Accessory is populated
    if (!map.accessory && !readOnly) {
      const userAcc = wardrobeItems.find(
        (w) => classifyAnatomicalSlot(w.name, w.category) === 'accessory'
      );
      if (userAcc) {
        map.accessory = {
          id: userAcc.id,
          name: userAcc.name,
          category: 'Accessory',
          image: resolveDatasetGarmentPhoto(userAcc.name, userAcc.category, userAcc.image),
          color: userAcc.color || 'Neutral',
          hexColor: colorNameToHex(userAcc.color),
          slotType: 'accessory',
          isSuggested: false,
        };
      } else {
        const dsPick = getDatasetPicksForSlot('accessory', outfit.occasionLabel || occasion)[0];
        map.accessory = {
          id: dsPick.id,
          name: dsPick.name,
          category: 'Accessory',
          image: dsPick.imageUri,
          color: dsPick.color,
          hexColor: dsPick.colorHex,
          slotType: 'accessory',
          isSuggested: true,
          suggestedLabel: 'Style Suggestion',
        };
      }
    }

    // For Outerwear: if not warm weather and no outerwear in outfit, populate from user's closet or suggestion
    if (!map.outerLayer && !isWarmWeather && !readOnly) {
      const userOuter = wardrobeItems.find(
        (w) => w.status === 'clean' && classifyAnatomicalSlot(w.name, w.category) === 'outerLayer'
      );
      if (userOuter) {
        map.outerLayer = {
          id: userOuter.id,
          name: userOuter.name,
          category: 'Outerwear',
          image: resolveDatasetGarmentPhoto(userOuter.name, userOuter.category, userOuter.image),
          color: userOuter.color || 'Neutral',
          hexColor: colorNameToHex(userOuter.color),
          slotType: 'outerLayer',
          isSuggested: false,
        };
      }
    }

    return map;
  }, [outfit.clothingItems, outfit.occasionLabel, occasion, wardrobeItems, isWarmWeather, readOnly]);

  // All clean garments uploaded by the user for the currently selected slot
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

  // Optional Style Suggestions for the selected slot
  const suggestionCandidates = useMemo(() => {
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
        suggestedLabel: 'Style Suggestion',
      })
    );
  }, [selectedSlot, outfit.occasionLabel, occasion]);

  const openSlotDrawer = (slot: AnatomicalSlotType) => {
    if (readOnly) return;
    setSelectedSlot(slot);
    const hasClosetForSlot = wardrobeItems.some(
      (w) =>
        classifyAnatomicalSlot(w.name, w.category) === slot &&
        (slot === 'accessory' || w.status === 'clean')
    );
    setDrawerSourceTab(hasClosetForSlot ? 'closet' : 'suggestions');
  };

  // Recalculate match scores in real time when any garment is swapped
  const applyUpdatedMap = (nextMap: Partial<Record<AnatomicalSlotType, OutfitClothingItem>>) => {
    const orderedSlots: AnatomicalSlotType[] = [
      'accessory',
      'innerTop',
      'outerLayer',
      'bottom',
      'shoes',
    ];
    const nextItems = orderedSlots.map((s) => nextMap[s]).filter(Boolean) as OutfitClothingItem[];
    const nextPalette = nextItems.map((it) => ({
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

    // Real-time score recalculation based on color harmony + closet ownership
    const hasNeutralAnchor = nextItems.some((i) =>
      /black|white|navy|gray|grey|beige|khaki|cream|denim/i.test(i.color || '')
    );
    const closetOwnedCount = nextItems.filter((i) => !i.isSuggested).length;
    const nextContentScore = Math.min(
      98,
      Math.max(78, 82 + (hasNeutralAnchor ? 7 : 3) + closetOwnedCount * 2)
    );
    const nextCollabScore = Math.min(96, Math.max(75, nextContentScore - 2));
    const nextHybridScore = Math.round(0.55 * nextContentScore + 0.45 * nextCollabScore);

    updateOutfitEverywhere(outfit.id, {
      name: nextName,
      image: inner?.image || outer?.image || outfit.image,
      clothingItems: nextItems,
      colorPalette: nextPalette,
      howToWearBullets: nextBullets,
      colorHarmonyExplanation: nextHarmony,
      contentScore: nextContentScore,
      collaborativeScore: nextCollabScore,
      hybridScore: nextHybridScore,
      matchPercent: nextHybridScore,
    });
  };

  const handleSelectDrawerItem = (candidate: OutfitClothingItem) => {
    if (!selectedSlot) return;
    const nextMap = { ...slotItemsMap, [selectedSlot]: candidate };
    applyUpdatedMap(nextMap);
    showToast(`Swapped ${SLOT_LABELS[selectedSlot].shortTab} to ${candidate.name}`);
    setSelectedSlot(null);
  };

  const handleRemoveOuterLayer = () => {
    const nextMap = { ...slotItemsMap };
    delete nextMap.outerLayer;
    applyUpdatedMap(nextMap);
    showToast('Removed outer layer for warm weather');
    setSelectedSlot(null);
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
      (selectedSlot && slotItemsMap[selectedSlot]?.name) ||
      slotItemsMap.innerTop?.name ||
      'your piece';
    showToast(`✨ Auto-matched outfit around ${anchorName}!`);
    setSelectedSlot(null);
  };

  const innerTop = slotItemsMap.innerTop;
  const bottom = slotItemsMap.bottom;
  const outerLayer = slotItemsMap.outerLayer;
  const accessory = slotItemsMap.accessory;
  const shoes = slotItemsMap.shoes;

  const displayOccasionTitle = useMemo(() => {
    const raw = outfit.occasionLabel || occasion || 'Casual';
    if (raw === 'Any occasion') return 'Casual';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [outfit.occasionLabel, occasion]);

  const activeDrawerItems =
    drawerSourceTab === 'closet' ? closetCandidates : suggestionCandidates;

  const renderSpatialCutoutSlot = (
    slot: AnatomicalSlotType,
    item: OutfitClothingItem | undefined,
    heightPercent: `${number}%`
  ) => {
    if (!item && slot === 'outerLayer') {
      return (
        <Pressable
          onPress={() => openSlotDrawer('outerLayer')}
          disabled={readOnly}
          style={[styles.spatialSlot, { height: heightPercent }]}
        >
          <View style={styles.emptyLayerPlaceholder}>
            <Ionicons name="add-circle-outline" size={18} color="#94A3B8" />
            <Text style={styles.emptyLayerText}>+ Layer</Text>
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={() => openSlotDrawer(slot)}
        disabled={readOnly}
        style={({ pressed }) => [
          styles.spatialSlot,
          { height: heightPercent, opacity: pressed && !readOnly ? 0.82 : 1 },
        ]}
      >
        {item?.image ? (
          <Image
            source={{ uri: item.image }}
            style={styles.cutoutImage}
            contentFit="contain"
            transition={180}
          />
        ) : (
          <View style={styles.emptyLayerPlaceholder}>
            <Ionicons name="shirt-outline" size={22} color="#CBD5E1" />
          </View>
        )}

        {item?.isSuggested && (
          <View style={styles.styleSuggestionCornerPill}>
            <Text style={styles.styleSuggestionCornerText}>Style Suggestion</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* WHITE SPATIAL OUTFIT BOARD CARD (Advisor Target Output Visualization) */}
      <View style={styles.whiteBoardCard}>
        {/* a) Card Header Above the Board */}
        <View style={styles.boardHeaderRow}>
          <Text style={styles.occasionHeaderTitle}>{displayOccasionTitle}</Text>

          <View style={styles.boardHeaderRight}>
            {!readOnly && (
              <Pressable
                onPress={() => openSlotDrawer(outerLayer ? 'outerLayer' : 'innerTop')}
                style={styles.quickAddSwapButton}
                hitSlop={6}
              >
                <Text style={styles.quickAddSwapText}>🧥+</Text>
              </Pressable>
            )}
            <View style={styles.countBadgePill}>
              <Text style={styles.countBadgeText}>
                {index + 1}/{Math.max(1, totalCount)}
              </Text>
            </View>
          </View>
        </View>

        {/* b) 2-Column Spatial Garment Cutout Canvas (Exact Top-to-Bottom Body Proportions) */}
        <View style={styles.spatialCanvas}>
          {/* Left Column (flex: 1.05): Top-Left (44%) Inner Shirt/Top + Bottom-Left (54%) Pants/Bottom */}
          <View style={styles.leftColumn}>
            {renderSpatialCutoutSlot('innerTop', innerTop, '44%')}
            {renderSpatialCutoutSlot('bottom', bottom, '54%')}
          </View>

          {/* Right Column (flex: 0.95): Top-Right (42%) Outerwear + Middle-Right (26%) Accessory + Bottom-Right (30%) Shoes */}
          <View style={styles.rightColumn}>
            {renderSpatialCutoutSlot('outerLayer', outerLayer, '42%')}
            {renderSpatialCutoutSlot('accessory', accessory, '26%')}
            {renderSpatialCutoutSlot('shoes', shoes, '30%')}
          </View>
        </View>

        {/* c) Pagination Dots (• • •) centered at the bottom of the white card */}
        <View style={styles.paginationDotsRow}>
          {Array.from({ length: Math.max(1, totalCount) }).map((_, dotIdx) => (
            <View
              key={`dot-${dotIdx}`}
              style={[
                styles.paginationDot,
                dotIdx === index ? styles.paginationDotActive : styles.paginationDotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* TAP-TO-SWAP BOTTOM CLOSET DRAWER MODAL */}
      <Modal
        visible={!!selectedSlot && !readOnly}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSlot(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropDismissArea} onPress={() => setSelectedSlot(null)} />
          <View
            style={[
              styles.bottomDrawerSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.drawerHandleBar} />

            {/* Drawer Header */}
            <View style={styles.drawerHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.drawerTitle, { color: theme.text }]}>
                  Swap {selectedSlot ? SLOT_LABELS[selectedSlot].title : 'Garment'}
                </Text>
                <Text style={[styles.drawerSubtitle, { color: theme.textMuted }]}>
                  Tap any garment below to swap onto the Spatial Outfit Board
                </Text>
              </View>

              <Pressable
                onPress={handleAutoMatchRest}
                style={[styles.autoMatchButton, { backgroundColor: theme.secondaryAccent }]}
              >
                <Text style={[styles.autoMatchButtonText, { color: theme.onAccent }]}>
                  ✨ Auto-Match
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSelectedSlot(null)}
                style={[styles.drawerCloseButton, { backgroundColor: theme.background }]}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>

            {/* Category Slot Switcher Pills (Top · Bottom · Outerwear · Accessory · Shoes) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slotCategoryTabsRow}
            >
              {SLOT_ORDER.map((slotKey) => {
                const active = selectedSlot === slotKey;
                return (
                  <Pressable
                    key={slotKey}
                    onPress={() => openSlotDrawer(slotKey)}
                    style={[
                      styles.slotCategoryChip,
                      {
                        backgroundColor: active ? theme.secondaryAccent : theme.background,
                        borderColor: active ? theme.secondaryAccent : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotCategoryChipText,
                        { color: active ? theme.onAccent : theme.text },
                      ]}
                    >
                      {SLOT_LABELS[slotKey].shortTab}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Source Toggle: My Closet vs Style Suggestions */}
            <View style={styles.sourceSwitchRow}>
              <Pressable
                onPress={() => setDrawerSourceTab('closet')}
                style={[
                  styles.sourceSwitchPill,
                  {
                    backgroundColor:
                      drawerSourceTab === 'closet' ? theme.aiPillBg : theme.background,
                    borderColor:
                      drawerSourceTab === 'closet' ? theme.secondaryAccent : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sourceSwitchText,
                    { color: drawerSourceTab === 'closet' ? theme.aiPillText : theme.textMuted },
                  ]}
                >
                  👕 My Closet ({closetCandidates.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setDrawerSourceTab('suggestions')}
                style={[
                  styles.sourceSwitchPill,
                  {
                    backgroundColor:
                      drawerSourceTab === 'suggestions' ? theme.aiPillBg : theme.background,
                    borderColor:
                      drawerSourceTab === 'suggestions' ? theme.secondaryAccent : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sourceSwitchText,
                    {
                      color:
                        drawerSourceTab === 'suggestions' ? theme.aiPillText : theme.textMuted,
                    },
                  ]}
                >
                  ✨ Style Suggestions ({suggestionCandidates.length})
                </Text>
              </Pressable>

              {selectedSlot === 'outerLayer' && outerLayer && (
                <Pressable
                  onPress={handleRemoveOuterLayer}
                  style={[styles.removeLayerPill, { borderColor: theme.border }]}
                >
                  <Text style={[styles.removeLayerPillText, { color: theme.textMuted }]}>
                    No Layer
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Garment Grid / Horizontal Scroller */}
            {activeDrawerItems.length === 0 ? (
              <View style={styles.emptyDrawerState}>
                <Text style={[styles.emptyDrawerText, { color: theme.textMuted }]}>
                  No clean {selectedSlot ? SLOT_LABELS[selectedSlot].shortTab.toLowerCase() : ''}{' '}
                  items in your closet yet.
                </Text>
                <Pressable
                  onPress={() => setDrawerSourceTab('suggestions')}
                  style={[styles.trySuggestionBtn, { backgroundColor: theme.secondaryAccent }]}
                >
                  <Text style={[styles.trySuggestionBtnText, { color: theme.onAccent }]}>
                    Browse Style Suggestions
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.drawerItemsScroll}
              >
                {activeDrawerItems.map((candidate) => {
                  const currentInSlot = selectedSlot ? slotItemsMap[selectedSlot] : undefined;
                  const isCurrent =
                    currentInSlot?.id === candidate.id ||
                    currentInSlot?.name === candidate.name;
                  return (
                    <Pressable
                      key={candidate.id}
                      onPress={() => handleSelectDrawerItem(candidate)}
                      style={[
                        styles.drawerItemCard,
                        {
                          backgroundColor: theme.background,
                          borderColor: isCurrent ? theme.secondaryAccent : theme.border,
                          borderWidth: isCurrent ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.drawerItemImageBox}>
                        <Image
                          source={{ uri: candidate.image }}
                          style={styles.drawerItemImage}
                          contentFit="contain"
                        />
                        {isCurrent && (
                          <View
                            style={[
                              styles.activeCheckBadge,
                              { backgroundColor: theme.secondaryAccent },
                            ]}
                          >
                            <Ionicons name="checkmark" size={11} color={theme.onAccent} />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.drawerItemName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {candidate.name}
                      </Text>
                      <View style={styles.drawerItemColorRow}>
                        <View
                          style={[
                            styles.drawerColorDot,
                            {
                              backgroundColor:
                                candidate.hexColor || colorNameToHex(candidate.color),
                            },
                          ]}
                        />
                        <Text
                          style={[styles.drawerItemColor, { color: theme.textMuted }]}
                          numberOfLines={1}
                        >
                          {candidate.color || 'Neutral'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  whiteBoardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    height: 375,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#ECE8DF',
  },
  boardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  occasionHeaderTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1E1B24',
    letterSpacing: -0.3,
  },
  boardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickAddSwapButton: {
    backgroundColor: '#F4F1EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2DDD3',
  },
  quickAddSwapText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#24152C',
  },
  countBadgePill: {
    backgroundColor: '#F4F1EA',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#4B1D6F',
  },
  spatialCanvas: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  leftColumn: {
    flex: 1.05,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightColumn: {
    flex: 0.95,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spatialSlot: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 4,
  },
  cutoutImage: {
    width: '100%',
    height: '100%',
  },
  emptyLayerPlaceholder: {
    width: '88%',
    height: '88%',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  emptyLayerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  styleSuggestionCornerPill: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(36, 21, 44, 0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  styleSuggestionCornerText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  paginationDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 6,
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#24152C',
  },
  paginationDotInactive: {
    width: 6,
    backgroundColor: '#D4CFC7',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdropDismissArea: {
    flex: 1,
  },
  bottomDrawerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 12,
  },
  drawerHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  drawerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  drawerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  autoMatchButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  autoMatchButtonText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  drawerCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotCategoryTabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  slotCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  slotCategoryChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sourceSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceSwitchPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  sourceSwitchText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  removeLayerPill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  removeLayerPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  drawerItemsScroll: {
    gap: 10,
    paddingVertical: 6,
  },
  drawerItemCard: {
    width: 116,
    borderRadius: 14,
    padding: 8,
    gap: 4,
  },
  drawerItemImageBox: {
    width: '100%',
    height: 92,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  drawerItemImage: {
    width: '100%',
    height: '100%',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemName: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  drawerItemColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  drawerColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  drawerItemColor: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  emptyDrawerState: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyDrawerText: {
    fontSize: 12.5,
    textAlign: 'center',
  },
  trySuggestionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  trySuggestionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
