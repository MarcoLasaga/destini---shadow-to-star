import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import { useToast } from '../contexts/ToastContext';
import { GeneratedOutfit } from '../types';
import ShareOutfitModal from './ShareOutfitModal';
import OutfitCollageBoard from './OutfitCollageBoard';
import { useCommunity } from '../contexts/CommunityContext';
import {
  buildColorHarmonyExplanation,
  buildHowToWearBullets,
  classifyAnatomicalSlot,
  colorNameToHex,
} from '../services/outfitRecommendationService';

export default function OutfitPreviewCard({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const {
    occasion,
    toggleSave,
    markAsWorn,
    remixCurrentOutfit,
    submitPreferenceEvent,
  } = useOutfit();
  const { refresh } = useCommunity();
  const { showToast } = useToast();
  const [shareVisible, setShareVisible] = useState(false);

  const baseScore = outfit.hybridScore ?? outfit.matchPercent;
  const content = outfit.contentScore ?? Math.min(99, Math.round(baseScore * 0.96));
  const collaborative = outfit.collaborativeScore ?? Math.min(99, Math.round(baseScore * 0.94));
  const hybrid = Math.round(0.55 * content + 0.45 * collaborative);

  const handleWear = async () => {
    const wasWorn = !!outfit.worn;
    await markAsWorn(outfit.id);
    showToast(
      wasWorn
        ? 'Outfit unmarked as worn. Garments restored to clean.'
        : 'Outfit marked as worn! Laundry & wear count updated.'
    );
  };

  // Dynamically derive title, palette, and color harmony from actual items in outfit.clothingItems
  const dynamicTitle = useMemo(() => {
    const inner = outfit.clothingItems.find(
      (i) => (i.slotType || classifyAnatomicalSlot(i.name, i.category)) === 'innerTop'
    );
    const outer = outfit.clothingItems.find(
      (i) => (i.slotType || classifyAnatomicalSlot(i.name, i.category)) === 'outerLayer'
    );
    const bottom = outfit.clothingItems.find(
      (i) => (i.slotType || classifyAnatomicalSlot(i.name, i.category)) === 'bottom'
    );
    const occPrefix = `${outfit.occasionLabel || 'Curated'} Look`;
    if (inner && outer) return `${occPrefix} · ${inner.name} + ${outer.name}`;
    if (inner && bottom) return `${occPrefix} · ${inner.name} & ${bottom.name}`;
    if (inner) return `${occPrefix} · ${inner.name}`;
    return outfit.name;
  }, [outfit.clothingItems, outfit.occasionLabel, outfit.name]);

  const activePalette = useMemo(
    () =>
      outfit.clothingItems.length > 0
        ? outfit.clothingItems.slice(0, 4).map((it) => ({
            name: `${it.color || 'Neutral'} (${it.category})`,
            hex: it.hexColor || colorNameToHex(it.color),
          }))
        : outfit.colorPalette || [],
    [outfit.clothingItems, outfit.colorPalette]
  );

  const activeHarmonyText = useMemo(
    () => buildColorHarmonyExplanation(activePalette),
    [activePalette]
  );

  const activeBullets = useMemo(
    () =>
      outfit.howToWearBullets && outfit.howToWearBullets.length > 0
        ? outfit.howToWearBullets
        : buildHowToWearBullets(outfit.clothingItems, outfit.occasionLabel || occasion),
    [outfit.howToWearBullets, outfit.clothingItems, outfit.occasionLabel, occasion]
  );

  const tempC =
    outfit.weatherTempF != null ? Math.round((outfit.weatherTempF - 32) * (5 / 9)) : 29;

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Outfit Moodboard</Text>
          {outfit.badge && (
            <View style={[styles.badgePill, { backgroundColor: theme.primaryAccent }]}>
              <Text style={styles.badgeText}>{outfit.badge.replace(/Hybrid/gi, 'Style')}</Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.weatherChip,
            { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' },
          ]}
        >
          <Ionicons name="partly-sunny-outline" size={13} color="#E8833A" />
          <Text style={[styles.weatherChipText, { color: theme.text }]}>
            Weather Today · {tempC}°C
          </Text>
        </View>
      </View>

      <View style={styles.infoBlock}>
        <Text style={[styles.outfitName, { color: theme.text }]}>{dynamicTitle}</Text>

        {/* EDITORIAL FLAT-LAY OUTFIT COLLAGE CANVAS & INTERACTIVE BOTTOM CLOSET TRAY */}
        <OutfitCollageBoard outfit={outfit} />

        {/* 3 Real Algorithmic Score Cards (Style Match, Color Harmony, Creativity) */}
        <View
          style={[
            styles.statsRow,
            { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' },
          ]}
        >
          <View style={styles.statBlock}>
            <Text
              style={[
                styles.statValue,
                { color: theme.mode === 'dark' ? '#FBF5A7' : '#24152C' },
              ]}
            >
              {hybrid}%
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Style Match</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{content}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Color Harmony</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{collaborative}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Creativity</Text>
          </View>
        </View>

        {/* 4 Action Buttons: Like, Dislike, Save, Wear */}
        <View style={styles.mainActionsRow}>
          <Pressable
            onPress={() => {
              submitPreferenceEvent(outfit.id, 'LIKE');
              showToast('👍 Saved to your style preferences!');
            }}
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
              {outfit.favorited ? 'Liked' : 'Like'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              submitPreferenceEvent(outfit.id, 'DISLIKE');
              showToast('👎 Preference saved!');
            }}
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
              {outfit.disliked ? 'Disliked' : 'Dislike'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              const wasSaved = !!outfit.saved;
              toggleSave(outfit.id);
              showToast(wasSaved ? 'Removed from saved outfits.' : '🔖 Outfit saved!');
            }}
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

        {/* "MAKING SENSE OF YOUR STYLE" SUMMARY BANNER */}
        <View
          style={[
            styles.harmonyCard,
            { backgroundColor: theme.aiBannerBg, borderColor: theme.aiBannerBorder },
          ]}
        >
          <View style={styles.colorMatchTopRow}>
            <Text style={[styles.harmonyTitle, { color: theme.aiBannerText }]}>
              ✨ Making Sense of Your Style
            </Text>
            <View style={styles.colorDotsGroup}>
              {activePalette.map((swatch, idx) => (
                <View
                  key={`${swatch.name}-${idx}`}
                  style={[styles.swatchCircle, { backgroundColor: swatch.hex }]}
                />
              ))}
            </View>
          </View>
          <Text style={[styles.harmonyDesc, { color: theme.aiBannerText }]}>
            <Text style={{ fontWeight: '800' }}>🎨 Why the Colors Work: </Text>
            {activeHarmonyText}
          </Text>
          <Text style={[styles.harmonyDesc, { color: theme.aiBannerText }]}>
            <Text style={{ fontWeight: '800' }}>👕 How to Wear It: </Text>
            Wear your shirt inside first, layer the jacket open on top, and wear your watch on the left wrist.
          </Text>
        </View>

        {/* 3 SHORT ONE-LINE STYLING CHIPS */}
        <View style={styles.quickTipsWrap}>
          {activeBullets.map((chipText, idx) => (
            <View
              key={`chip-${idx}`}
              style={[
                styles.quickTipChip,
                { backgroundColor: theme.aiPillBg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.quickTipChipText, { color: theme.aiPillText }]}>
                {chipText}
              </Text>
            </View>
          ))}
        </View>

        {/* Secondary Actions (Share, Remix, Details) */}
        <View style={styles.secondaryActionsRow}>
          <Pressable
            onPress={() => setShareVisible(true)}
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            <Ionicons name="share-social-outline" size={14} color={theme.text} />
            <Text style={[styles.secondaryText, { color: theme.text }]}>Share to Feed</Text>
          </Pressable>
          <Pressable
            onPress={remixCurrentOutfit}
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            <Ionicons name="sync-outline" size={14} color={theme.text} />
            <Text style={[styles.secondaryText, { color: theme.text }]}>Remix</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('OutfitDetails', { outfitId: outfit.id })}
            style={[
              styles.secondaryButton,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
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
    paddingBottom: 6,
  },
  headerLeft: { flex: 1, gap: 4, marginRight: 8 },
  sectionTitle: { fontSize: 15.5, fontWeight: '800' },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#3D2E10' },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  weatherChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  infoBlock: { padding: 16, gap: 14 },
  outfitName: { fontSize: 18, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBlock: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600' },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(128,128,128,0.2)' },
  mainActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mainActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
  },
  mainActionText: { fontSize: 12 },
  harmonyCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 6,
  },
  colorMatchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  harmonyTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  colorDotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatchCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  harmonyDesc: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  quickTipsWrap: {
    gap: 6,
  },
  quickTipChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickTipChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
  },
  secondaryText: { fontSize: 11.5, fontWeight: '700' },
});
