import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useWeather } from '../hooks/useWeather';
import { useToast } from '../contexts/ToastContext';
import { AnatomicalSlotType, ClothingRole, GeneratedOutfit, OutfitClothingItem } from '../types';
import ShareOutfitModal from './ShareOutfitModal';
import { useCommunity } from '../contexts/CommunityContext';
import {
  buildColorHarmonyExplanation,
  buildHowToWearBullets,
  classifyAnatomicalSlot,
  colorNameToHex,
  getBodyPlacementBadge,
  styleAroundPinnedSlots,
} from '../services/outfitRecommendationService';

interface SlotMeta {
  slot: AnatomicalSlotType;
  zoneTitle: string;
  bodyZoneLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  roleCategory: ClothingRole;
}

const ANATOMICAL_SLOTS: SlotMeta[] = [
  {
    slot: 'accessory',
    zoneTitle: 'HEAD / NECK / WRIST ZONE',
    bodyZoneLabel: 'Accessory',
    icon: 'watch-outline',
    roleCategory: 'Accessory',
  },
  {
    slot: 'innerTop',
    zoneTitle: 'UPPER TORSO · SLOT 1 (INNER BASE TOP)',
    bodyZoneLabel: '1st Layer · Inside First',
    icon: 'shirt-outline',
    roleCategory: 'Top',
  },
  {
    slot: 'outerLayer',
    zoneTitle: 'UPPER TORSO · SLOT 2 (OUTER LAYER)',
    bodyZoneLabel: '2nd Layer · Over Base Top',
    icon: 'layers-outline',
    roleCategory: 'Outerwear',
  },
  {
    slot: 'bottom',
    zoneTitle: 'LOWER BODY / LEGS ZONE',
    bodyZoneLabel: 'Bottom',
    icon: 'walk-outline',
    roleCategory: 'Bottom',
  },
  {
    slot: 'shoes',
    zoneTitle: 'FOOTWEAR ANCHOR ZONE',
    bodyZoneLabel: 'Shoes',
    icon: 'footsteps-outline',
    roleCategory: 'Shoes',
  },
];

export default function OutfitPreviewCard({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const {
    occasion,
    noNewClothesMode,
    toggleSave,
    markAsWorn,
    remixCurrentOutfit,
    submitPreferenceEvent,
    updateOutfitEverywhere,
  } = useOutfit();
  const { items: wardrobeItems } = useWardrobe();
  const { weather } = useWeather();
  const { refresh } = useCommunity();
  const { showToast } = useToast();
  const [shareVisible, setShareVisible] = useState(false);
  const [pinnedSlots, setPinnedSlots] = useState<Partial<Record<AnatomicalSlotType, boolean>>>({});

  const baseScore = outfit.hybridScore ?? outfit.matchPercent;
  const content = outfit.contentScore ?? Math.min(99, Math.round(baseScore * 0.95));
  const collaborative = outfit.collaborativeScore ?? Math.min(99, Math.round(baseScore * 1.02));
  const hybrid = Math.round(0.55 * content + 0.45 * collaborative);

  // Organize current outfit's items into the 5 anatomical slots (never putting a Hoodie/Jacket in innerTop)
  const slotItemsMap = useMemo(() => {
    const map: Partial<Record<AnatomicalSlotType, OutfitClothingItem>> = {};
    outfit.clothingItems.forEach((item) => {
      const detectedSlot = item.slotType || classifyAnatomicalSlot(item.name, item.category);
      if (!map[detectedSlot]) {
        map[detectedSlot] = {
          ...item,
          slotType: detectedSlot,
          color: item.color || 'Neutral',
          hexColor: item.hexColor || colorNameToHex(item.color),
          placementBadge:
            item.placementBadge ||
            getBodyPlacementBadge(item, detectedSlot, outfit.occasionLabel || occasion),
        };
      }
    });

    // Guarantee Slot 1 (innerTop) is ALWAYS populated ("What's Inside First" rule)
    if (!map.innerTop) {
      const cleanInnerFromWardrobe = wardrobeItems.find(
        (w) => w.status === 'clean' && classifyAnatomicalSlot(w.name, w.category) === 'innerTop'
      ) || wardrobeItems.find((w) => classifyAnatomicalSlot(w.name, w.category) === 'innerTop');

      const fallbackName = cleanInnerFromWardrobe?.name || 'Crisp Collared Base Shirt';
      const fallbackColor = cleanInnerFromWardrobe?.color || 'White';
      map.innerTop = {
        id: cleanInnerFromWardrobe?.id || 'inner-base-default',
        name: fallbackName,
        category: 'Top',
        image: cleanInnerFromWardrobe?.image || 'https://picsum.photos/seed/striped-button-down/800/900',
        color: fallbackColor,
        hexColor: colorNameToHex(fallbackColor),
        slotType: 'innerTop',
        placementBadge: getBodyPlacementBadge(
          { name: fallbackName, category: 'Top', color: fallbackColor },
          'innerTop',
          outfit.occasionLabel || occasion
        ),
      };
    }

    return map;
  }, [outfit.clothingItems, outfit.occasionLabel, occasion, wardrobeItems]);

  // Candidate pools per anatomical slot from the user's wardrobe (clean items prioritized first)
  const slotCandidatePools = useMemo(() => {
    const pools: Record<AnatomicalSlotType, OutfitClothingItem[]> = {
      accessory: [],
      innerTop: [],
      outerLayer: [],
      bottom: [],
      shoes: [],
    };

    const sortedWardrobe = [...wardrobeItems].sort((a, b) =>
      a.status === 'clean' && b.status !== 'clean' ? -1 : a.status !== 'clean' && b.status === 'clean' ? 1 : 0
    );

    sortedWardrobe.forEach((w) => {
      const slot = classifyAnatomicalSlot(w.name, w.category);
      const roleCat: ClothingRole =
        slot === 'outerLayer'
          ? 'Outerwear'
          : slot === 'innerTop'
          ? 'Top'
          : slot === 'bottom'
          ? 'Bottom'
          : slot === 'shoes'
          ? 'Shoes'
          : 'Accessory';
      pools[slot].push({
        id: w.id,
        name: w.name,
        category: roleCat,
        image: w.image,
        color: w.color,
        hexColor: colorNameToHex(w.color),
        slotType: slot,
        status: w.status,
        placementBadge: getBodyPlacementBadge(
          { name: w.name, category: roleCat, color: w.color },
          slot,
          outfit.occasionLabel || occasion
        ),
      });
    });

    // Ensure current slot item is in the pool so cycling works smoothly
    (Object.keys(pools) as AnatomicalSlotType[]).forEach((slot) => {
      const current = slotItemsMap[slot];
      if (current && !pools[slot].some((p) => p.id === current.id)) {
        pools[slot].unshift(current);
      }
    });

    return pools;
  }, [wardrobeItems, slotItemsMap, outfit.occasionLabel, occasion]);

  const rebuildAndSaveOutfit = (nextMap: Partial<Record<AnatomicalSlotType, OutfitClothingItem>>, customBoost?: number) => {
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
    const occPrefix = `${outfit.occasionLabel || 'Curated'} Look`;
    const nextName =
      inner && outer
        ? `${occPrefix} · ${inner.name} + ${outer.name}`
        : inner
        ? `${occPrefix} · ${inner.name}`
        : outfit.name;

    const nextHybrid = customBoost ?? Math.min(97, Math.max(82, hybrid + 1));

    updateOutfitEverywhere(outfit.id, {
      name: nextName,
      image: inner?.image || outer?.image || outfit.image,
      clothingItems: nextItems,
      colorPalette: nextPalette,
      howToWearBullets: nextBullets,
      colorHarmonyExplanation: nextHarmony,
      hybridScore: nextHybrid,
      matchPercent: nextHybrid,
    });
  };

  const handleCycleSlot = (slot: AnatomicalSlotType, direction: -1 | 1) => {
    const pool = slotCandidatePools[slot];
    if (!pool || pool.length <= 1) {
      showToast(`Only 1 item available for this ${slot === 'innerTop' ? 'Inner Base Top' : slot} slot in your closet.`);
      return;
    }
    const current = slotItemsMap[slot];
    const currentIndex = current ? pool.findIndex((i) => i.id === current.id) : 0;
    const nextIndex = (Math.max(0, currentIndex) + direction + pool.length) % pool.length;
    const nextItem = pool[nextIndex];

    const nextMap = { ...slotItemsMap, [slot]: nextItem };
    rebuildAndSaveOutfit(nextMap);
  };

  const handleTogglePin = (slot: AnatomicalSlotType) => {
    setPinnedSlots((prev) => {
      const nextVal = !prev[slot];
      return { ...prev, [slot]: nextVal };
    });
  };

  const handleStyleAroundPinned = () => {
    const lockedMap: Partial<Record<AnatomicalSlotType, OutfitClothingItem>> = {};
    (Object.keys(pinnedSlots) as AnatomicalSlotType[]).forEach((slot) => {
      if (pinnedSlots[slot] && slotItemsMap[slot]) {
        lockedMap[slot] = slotItemsMap[slot];
      }
    });

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

    const pinnedCount = Object.values(lockedMap).filter(Boolean).length;
    showToast(
      pinnedCount > 0
        ? `✨ Styled around ${pinnedCount} pinned piece${pinnedCount > 1 ? 's' : ''} using 0.55·S_cb + 0.45·S_cf!`
        : '✨ Re-optimized all 5 anatomical body zones for maximum Hybrid Match!'
    );
  };

  const handleWear = async () => {
    const wasWorn = !!outfit.worn;
    await markAsWorn(outfit.id);
    showToast(wasWorn ? 'Outfit unmarked as worn. Garments restored to clean.' : 'Outfit marked as worn! Laundry & wear count updated.');
  };

  const activeBullets = useMemo(
    () =>
      outfit.howToWearBullets && outfit.howToWearBullets.length > 0
        ? outfit.howToWearBullets
        : buildHowToWearBullets(Object.values(slotItemsMap).filter(Boolean) as OutfitClothingItem[], outfit.occasionLabel || occasion),
    [outfit.howToWearBullets, slotItemsMap, outfit.occasionLabel, occasion]
  );

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

  const activeHarmonyText =
    outfit.colorHarmonyExplanation || buildColorHarmonyExplanation(activePalette);

  const pinnedCount = Object.values(pinnedSlots).filter(Boolean).length;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Outfit Recommendation</Text>
          {outfit.badge && (
            <View style={[styles.badgePill, { backgroundColor: theme.primaryAccent }]}>
              <Text style={styles.badgeText}>{outfit.badge}</Text>
            </View>
          )}
        </View>
        <View style={[styles.hybridPill, { backgroundColor: theme.mode === 'dark' ? '#FBF5A7' : '#24152C' }]}>
          <Text style={[styles.hybridPillText, { color: theme.mode === 'dark' ? '#24152C' : '#FBF5A7' }]}>{hybrid}% Hybrid</Text>
        </View>
      </View>

      <View style={styles.imageWrap}>
        <Image source={{ uri: outfit.image }} style={styles.image} contentFit="cover" transition={250} />
        
        {/* Live OpenWeatherMap Badge */}
        <View style={styles.weatherBadge}>
          <Ionicons name="partly-sunny-outline" size={13} color="#FFD586" />
          <Text style={styles.weatherBadgeText}>
            OpenWeatherMap: {outfit.weatherTempF != null ? Math.round((outfit.weatherTempF - 32) * (5 / 9)) : 27}°C {outfit.weatherCondition ?? 'Clear'}
          </Text>
        </View>

        <View style={[styles.categoryPill, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
          <Text style={styles.categoryText}>{outfit.occasionLabel}</Text>
        </View>

        {outfit.worn && (
          <View style={styles.wornBadge}>
            <Ionicons name="checkmark-circle" size={14} color={theme.onAccent} />
            <Text style={styles.wornText}>Marked as Worn</Text>
          </View>
        )}
      </View>

      <View style={styles.infoBlock}>
        <Text style={[styles.outfitName, { color: theme.text }]}>{outfit.name}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.occasionChip, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
            <Text style={[styles.occasionChipText, { color: theme.textMuted }]}>{outfit.occasionLabel}</Text>
          </View>
          <Text style={[styles.weatherText, { color: theme.textMuted }]}>
            {outfit.location || 'Local Weather'} · Live Conditions
          </Text>
        </View>

        {/* Hybrid Recommendation Breakdown (Hybrid, Content, Collaborative, Reuse) */}
        <View style={[styles.statsRow, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.mode === 'dark' ? '#FBF5A7' : '#24152C' }]}>{hybrid}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Hybrid Score</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{content}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Content-Based</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{collaborative}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Collaborative</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: '#2F8F5B' }]}>{outfit.sustainPercent}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Wardrobe Reuse</Text>
          </View>
        </View>

        {/* 4 Required Action Buttons: Like, Dislike, Save, Wear */}
        <View style={styles.mainActionsRow}>
          {/* Like Button */}
          <Pressable
            onPress={() => submitPreferenceEvent(outfit.id, 'LIKE')}
            style={({ pressed }) => [
              styles.mainActionButton,
              {
                borderColor: outfit.favorited ? '#2F8F5B' : theme.border,
                backgroundColor: outfit.favorited ? '#2F8F5B18' : theme.background,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name={outfit.favorited ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={outfit.favorited ? '#2F8F5B' : theme.text}
            />
            <Text
              style={[
                styles.mainActionText,
                { color: outfit.favorited ? '#2F8F5B' : theme.text, fontWeight: '700' },
              ]}
            >
              Like
            </Text>
          </Pressable>

          {/* Dislike Button */}
          <Pressable
            onPress={() => submitPreferenceEvent(outfit.id, 'DISLIKE')}
            style={({ pressed }) => [
              styles.mainActionButton,
              {
                borderColor: outfit.disliked ? '#E5484D' : theme.border,
                backgroundColor: outfit.disliked ? '#E5484D18' : theme.background,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name={outfit.disliked ? 'thumbs-down' : 'thumbs-down-outline'}
              size={16}
              color={outfit.disliked ? '#E5484D' : theme.text}
            />
            <Text
              style={[
                styles.mainActionText,
                { color: outfit.disliked ? '#E5484D' : theme.text, fontWeight: '700' },
              ]}
            >
              Dislike
            </Text>
          </Pressable>

          {/* Save Button */}
          <Pressable
            onPress={() => toggleSave(outfit.id)}
            style={({ pressed }) => [
              styles.mainActionButton,
              {
                borderColor: outfit.saved ? theme.primaryAccent : theme.border,
                backgroundColor: outfit.saved ? theme.primaryAccent + '33' : theme.background,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name={outfit.saved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={outfit.saved ? '#A36814' : theme.text}
            />
            <Text
              style={[
                styles.mainActionText,
                { color: outfit.saved ? '#A36814' : theme.text, fontWeight: '700' },
              ]}
            >
              {outfit.saved ? 'Saved' : 'Save'}
            </Text>
          </Pressable>

          {/* Wear Button */}
          <Pressable
            onPress={handleWear}
            style={({ pressed }) => [
              styles.mainActionButton,
              {
                borderColor: outfit.worn ? theme.secondaryAccent : theme.border,
                backgroundColor: outfit.worn ? theme.secondaryAccent : theme.background,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name={outfit.worn ? 'checkmark-circle' : 'shirt-outline'}
              size={16}
              color={outfit.worn ? theme.onAccent : theme.text}
            />
            <Text
              style={[
                styles.mainActionText,
                { color: outfit.worn ? theme.onAccent : theme.text, fontWeight: '700' },
              ]}
            >
              {outfit.worn ? 'Worn' : 'Wear'}
            </Text>
          </Pressable>
        </View>

        {/* 2D ANATOMICAL MANNEQUIN SILHOUETTE STACK & CO-STYLIST SLOT PINNING */}
        <View style={styles.mannequinHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subHeading, { color: theme.accentText, marginTop: 0 }]}>
              2D ANATOMICAL MANNEQUIN · WHAT DO YOU WANT TO WEAR TODAY?
            </Text>
            <Text style={[styles.mannequinSubtitle, { color: theme.textMuted }]}>
              Head-to-toe body placement · Tap ◀ ▶ to swap or 📌 Pin any piece
            </Text>
          </View>
        </View>

        <View style={styles.mannequinStack}>
          {ANATOMICAL_SLOTS.map((slotMeta, idx) => {
            const item = slotItemsMap[slotMeta.slot];
            const isPinned = !!pinnedSlots[slotMeta.slot];
            const poolSize = slotCandidatePools[slotMeta.slot]?.length || 0;
            const badgeLabel =
              item?.placementBadge ||
              getBodyPlacementBadge(
                item || { name: slotMeta.bodyZoneLabel, category: slotMeta.roleCategory },
                slotMeta.slot,
                outfit.occasionLabel || occasion
              );

            return (
              <View key={slotMeta.slot} style={styles.mannequinZoneWrap}>
                {idx > 0 && (
                  <View style={[styles.mannequinSpineLine, { backgroundColor: theme.border }]} />
                )}
                <View
                  style={[
                    styles.mannequinSlotCard,
                    {
                      backgroundColor: isPinned ? theme.aiBannerBg : theme.background,
                      borderColor: isPinned ? theme.aiBannerBorder : theme.border,
                      borderWidth: isPinned ? 1.5 : 1,
                    },
                  ]}
                >
                  {/* Top Zone Header + Pin Button */}
                  <View style={styles.slotTopBar}>
                    <View style={styles.slotZoneTitleRow}>
                      <Ionicons name={slotMeta.icon} size={13} color={theme.accentText} />
                      <Text style={[styles.slotZoneTitle, { color: theme.accentText }]}>
                        {slotMeta.zoneTitle}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => handleTogglePin(slotMeta.slot)}
                      style={[
                        styles.pinButton,
                        {
                          backgroundColor: isPinned ? theme.secondaryAccent : theme.surface,
                          borderColor: isPinned ? theme.aiBannerBorder : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isPinned ? 'pin' : 'pin-outline'}
                        size={12}
                        color={isPinned ? theme.onAccent : theme.text}
                      />
                      <Text
                        style={[
                          styles.pinButtonText,
                          { color: isPinned ? theme.onAccent : theme.text },
                        ]}
                      >
                        {isPinned ? 'Pinned' : 'Pin'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Main Item Row with ◀ / ▶ Cycle Controls */}
                  <View style={styles.slotMainRow}>
                    <Pressable
                      onPress={() => handleCycleSlot(slotMeta.slot, -1)}
                      style={[
                        styles.cycleBtn,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      hitSlop={6}
                    >
                      <Text style={[styles.cycleBtnText, { color: theme.text }]}>◀</Text>
                    </Pressable>

                    {item ? (
                      <View style={styles.slotItemInfo}>
                        <Image
                          source={{ uri: item.image }}
                          style={styles.slotItemImage}
                          contentFit="cover"
                        />
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={styles.slotItemNameRow}>
                            <View
                              style={[
                                styles.colorDot,
                                { backgroundColor: item.hexColor || colorNameToHex(item.color) },
                              ]}
                            />
                            <Text style={[styles.slotItemName, { color: theme.text }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.placementBadgePill,
                              { backgroundColor: theme.aiPillBg },
                            ]}
                          >
                            <Text
                              style={[styles.placementBadgeText, { color: theme.aiPillText }]}
                              numberOfLines={1}
                            >
                              {badgeLabel}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.slotItemInfo}>
                        <View
                          style={[
                            styles.slotItemImage,
                            {
                              backgroundColor: theme.surface,
                              borderColor: theme.border,
                              borderWidth: 1,
                              alignItems: 'center',
                              justifyContent: 'center',
                            },
                          ]}
                        >
                          <Ionicons name={slotMeta.icon} size={18} color={theme.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.slotItemName, { color: theme.textMuted }]}>
                            Optional {slotMeta.bodyZoneLabel} (None in clean closet)
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.textMuted }}>
                            Add {slotMeta.bodyZoneLabel.toLowerCase()} in Wardrobe to layer here
                          </Text>
                        </View>
                      </View>
                    )}

                    <Pressable
                      onPress={() => handleCycleSlot(slotMeta.slot, 1)}
                      style={[
                        styles.cycleBtn,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                      hitSlop={6}
                    >
                      <Text style={[styles.cycleBtnText, { color: theme.text }]}>▶</Text>
                    </Pressable>
                  </View>

                  {poolSize > 1 && (
                    <Text style={[styles.poolHintText, { color: theme.textMuted }]}>
                      {poolSize} {slotMeta.bodyZoneLabel.toLowerCase()} options in closet
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* "✨ Style Around Pinned Piece(s)" Action Button */}
        <Pressable
          onPress={handleStyleAroundPinned}
          style={({ pressed }) => [
            styles.styleAroundBtn,
            {
              backgroundColor: theme.secondaryAccent,
              borderColor: theme.aiBannerBorder,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="sparkles" size={16} color={theme.onAccent} />
          <Text style={[styles.styleAroundBtnText, { color: theme.onAccent }]}>
            {pinnedCount > 0
              ? `✨ Style Around ${pinnedCount} Pinned Piece${pinnedCount > 1 ? 's' : ''} (0.55·S_cb + 0.45·S_cf)`
              : '✨ Style Around Pinned Piece(s)'}
          </Text>
        </Pressable>

        {/* LIVE CIELAB COLOR HARMONY SWATCH BAR */}
        <View
          style={[
            styles.harmonyCard,
            { backgroundColor: theme.aiBannerBg, borderColor: theme.aiBannerBorder },
          ]}
        >
          <View style={styles.harmonyHeader}>
            <Ionicons name="color-palette-outline" size={15} color={theme.accentText} />
            <Text style={[styles.harmonyTitle, { color: theme.aiBannerText }]}>
              LIVE CIELAB COLOR HARMONY SWATCH BAR
            </Text>
          </View>
          <View style={styles.swatchRow}>
            {activePalette.map((swatch, idx) => (
              <View
                key={`${swatch.name}-${idx}`}
                style={[
                  styles.swatchChip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={[styles.swatchCircle, { backgroundColor: swatch.hex }]} />
                <Text style={[styles.swatchLabel, { color: theme.text }]} numberOfLines={1}>
                  {swatch.name}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.harmonyDesc, { color: theme.aiBannerText }]}>
            {activeHarmonyText}
          </Text>
        </View>

        {/* ACTIONABLE "HOW TO WEAR & STYLE THIS LOOK" GUIDE */}
        <View
          style={[
            styles.howToWearCard,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <View style={styles.harmonyHeader}>
            <Ionicons name="body-outline" size={15} color={theme.accentText} />
            <Text style={[styles.harmonyTitle, { color: theme.text }]}>
              HOW TO WEAR & STYLE THIS LOOK
            </Text>
          </View>
          {activeBullets.map((bullet, idx) => (
            <View key={`how-${idx}`} style={styles.bulletRow}>
              <View style={[styles.bulletBadge, { backgroundColor: theme.aiPillBg }]}>
                <Text style={[styles.bulletBadgeText, { color: theme.aiPillText }]}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={[styles.bulletText, { color: theme.text }]}>{bullet}</Text>
            </View>
          ))}
        </View>

        {/* Explainability Reasons */}
        <Text style={[styles.subHeading, { color: theme.textMuted }]}>EXPLAINABILITY REASONS</Text>
        <View style={styles.reasonsList}>
          {outfit.whyReasons.map((reason) => (
            <View
              key={reason.id}
              style={[
                styles.reasonRow,
                {
                  backgroundColor: theme.aiBannerBg,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Ionicons name={reason.icon as any} size={15} color={theme.accentText} />
              <Text style={[styles.reasonText, { color: theme.aiBannerText }]}>{reason.description}</Text>
            </View>
          ))}
        </View>

        {/* Secondary Actions (Share, Remix, Details) */}
        <View style={styles.secondaryActionsRow}>
          <Pressable
            onPress={() => setShareVisible(true)}
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Ionicons name="share-social-outline" size={14} color={theme.text} />
            <Text style={[styles.secondaryText, { color: theme.text }]}>Share to Feed</Text>
          </Pressable>
          <Pressable
            onPress={remixCurrentOutfit}
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Ionicons name="sync-outline" size={14} color={theme.text} />
            <Text style={[styles.secondaryText, { color: theme.text }]}>Remix</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('OutfitDetails', { outfitId: outfit.id })}
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Ionicons name="eye-outline" size={14} color={theme.text} />
            <Text style={[styles.secondaryText, { color: theme.text }]}>Full Details</Text>
          </Pressable>
        </View>
      </View>
      <ShareOutfitModal
        outfit={outfit}
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        onPublished={() => refresh()}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerLeft: { flex: 1, gap: 4, marginRight: 8 },
  sectionTitle: { fontSize: 15.5, fontWeight: '800' },
  badgePill: { paddingHorizontal: 13, paddingVertical: 3.5, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#3D2E10' },
  hybridPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  hybridPillText: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },
  imageWrap: { width: '100%', aspectRatio: 0.88, position: 'relative' },
  image: { width: '100%', height: '100%' },
  weatherBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(27, 27, 31, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  weatherBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  categoryPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryText: { fontSize: 11.5, fontWeight: '700', color: '#2B2B2B' },
  wornBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2F8F5B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  wornText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '700' },
  infoBlock: { padding: 16, gap: 14 },
  outfitName: { fontSize: 19, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  occasionChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  occasionChipText: { fontSize: 11.5, fontWeight: '600' },
  weatherText: { fontSize: 12.5 },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 26, backgroundColor: '#DDD' },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  mainActionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  mainActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  mainActionText: { fontSize: 12 },
  subHeading: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginTop: 6,
  },
  mannequinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  mannequinSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  mannequinStack: {
    gap: 0,
  },
  mannequinZoneWrap: {
    alignItems: 'center',
  },
  mannequinSpineLine: {
    width: 2,
    height: 10,
  },
  mannequinSlotCard: {
    width: '100%',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  slotTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotZoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  slotZoneTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pinButtonText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  slotMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cycleBtn: {
    width: 30,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  slotItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slotItemImage: {
    width: 46,
    height: 46,
    borderRadius: 10,
  },
  slotItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  slotItemName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  placementBadgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  placementBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  poolHintText: {
    fontSize: 10,
    textAlign: 'right',
  },
  styleAroundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  styleAroundBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  harmonyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  harmonyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  harmonyTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  swatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  swatchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  swatchLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  harmonyDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  howToWearCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  bulletBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  reasonsList: { gap: 6 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reasonText: { fontSize: 12, flex: 1, lineHeight: 16, fontWeight: '600' },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
  },
  secondaryText: { fontSize: 11.5, fontWeight: '600' },
});
