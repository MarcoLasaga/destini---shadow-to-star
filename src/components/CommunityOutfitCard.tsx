import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { CommunityOutfit } from '../services/communityService';
import { OutfitClothingItem } from '../types';
import {
  classifyAnatomicalSlot,
  colorNameToHex,
} from '../services/outfitRecommendationService';
import { formatRelativeTime } from '../utils/timeFormat';
import {
  resolveGarmentImageUrl,
  MiniGarmentSvg,
} from '../utils/garmentImageHelper';
import AltaOutfitCollage from './AltaOutfitCollage';

interface CommunityOutfitCardProps {
  outfit: CommunityOutfit;
  onLike: () => void;
  onSave: () => void;
  onDislike?: () => void;
  onRepost?: () => void;
  onFollow?: () => void;
  following?: boolean;
  isOwnPost?: boolean;
  onViewLikes?: () => void;
}

function getOccasionEmojiLabel(occasion?: string): string {
  const occ = (occasion || 'Casual').toLowerCase();
  if (occ.includes('school') || occ.includes('campus') || occ.includes('college') || occ.includes('academic')) return '🎓 School';
  if (occ.includes('office') || occ.includes('work') || occ.includes('formal') || occ.includes('business')) return '💼 Office';
  if (occ.includes('party') || occ.includes('night') || occ.includes('date')) return '✨ Party';
  if (occ.includes('workout') || occ.includes('sport') || occ.includes('gym') || occ.includes('active')) return '🏃 Workout';
  return `☕ ${occasion || 'Casual'}`;
}

export default function CommunityOutfitCard({
  outfit,
  onLike,
  onSave,
  onDislike,
  onRepost,
  onFollow,
  following = false,
  isOwnPost = false,
  onViewLikes,
}: CommunityOutfitCardProps) {
  const theme = useAppTheme();
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportConfirm, setReportConfirm] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const lastTap = useRef<number>(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getSlotRank = (item?: { category?: string; slotType?: string; name?: string } | null): number => {
    if (!item) return 99;
    const slot = (item.slotType || classifyAnatomicalSlot(item.name || '', item.category)).toLowerCase();
    const cat = (item.category || '').toUpperCase();
    if (slot === 'innertop' || cat === 'TOP' || cat.includes('TOP')) return 1;
    if (slot === 'outerlayer' || cat === 'OUTERWEAR' || cat.includes('OUTER')) return 2;
    if (slot === 'bottom' || cat === 'BOTTOM' || cat.includes('BOTTOM')) return 3;
    if (slot === 'shoes' || cat === 'SHOES' || cat.includes('SHOE')) return 4;
    if (slot === 'accessory' || cat === 'ACCESSORIES' || cat.includes('ACCESSOR')) return 5;
    return 3;
  };

  const sortedRawItems = [...outfit.items].sort((a, b) => getSlotRank(a) - getSlotRank(b));
  const nonAccessories = sortedRawItems.filter((p) => getSlotRank(p) !== 5);
  const accessories = sortedRawItems.filter((p) => getSlotRank(p) === 5);
  const canonicalItems = [...nonAccessories, ...accessories.slice(0, 2)];

  const outfitPieces: OutfitClothingItem[] = canonicalItems.map((item) => {
    const slot = classifyAnatomicalSlot(item.name, item.category);
    return {
      id: item.id,
      name: item.name,
      category: (item.category as any) || 'Top',
      image: item.image,
      color: item.color,
      hexColor: colorNameToHex(item.color || ''),
      slotType: slot,
    };
  });

  // Extract unique hex colors for CIELAB K=2 Color Harmony Swatch Bar
  const harmonyHexSwatches = Array.from(
    new Set(
      outfitPieces.map((it) => (it.hexColor || colorNameToHex(it.color || 'Black')).toUpperCase())
    )
  ).slice(0, 4);

  const triggerHeartAnimation = () => {
    setHeartVisible(true);
    heartScale.value = 0.3;
    heartOpacity.value = 1;
    heartScale.value = withSpring(1.3, { damping: 6, stiffness: 200 });
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 350 })
    );
    setTimeout(() => setHeartVisible(false), 800);
  };

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const handleCardPress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
      }
      triggerHeartAnimation();
      if (!outfit.liked) {
        onLike();
      }
    } else {
      tapTimeout.current = setTimeout(() => {
        setDetailModalVisible(true);
      }, DOUBLE_TAP_DELAY);
    }
    lastTap.current = now;
  };

  const formattedTime = formatRelativeTime(outfit.created_at);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handleCardPress}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {/* Creator Header */}
        <View style={styles.header}>
          <View style={styles.identity}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: theme.badgeBg, borderColor: theme.border },
              ]}
            >
              {outfit.creatorAvatar ? (
                <Image source={{ uri: outfit.creatorAvatar }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: theme.text }]}>
                  {outfit.creatorName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text style={[styles.name, { color: theme.text }]}>
                {outfit.creatorName}
              </Text>
              <Text style={[styles.time, { color: theme.textMuted }]}>
                {formattedTime}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {isOwnPost ? (
              <View style={[styles.youBadge, { backgroundColor: theme.badgeBg }]}>
                <Ionicons name="person" size={10} color={theme.text} />
                <Text style={[styles.youBadgeText, { color: theme.text }]}>You</Text>
              </View>
            ) : (
              <Pressable
                onPress={onFollow}
                style={[
                  styles.followButton,
                  { backgroundColor: following ? theme.badgeBg : theme.secondaryAccent },
                ]}
              >
                <Text
                  style={[
                    styles.followText,
                    { color: following ? theme.text : theme.onAccent },
                  ]}
                >
                  {following ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            )}
            <Pressable onPress={() => setMenuVisible(true)} style={styles.more}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* ALTA-Style Compact Editorial Outfit Collage Canvas */}
        <View style={styles.collageStageWrap}>
          <AltaOutfitCollage items={outfit.items} interactive={false} />

          {/* Top-Left Style Pill */}
          <View
            style={[
              styles.postLabel,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.postLabelText, { color: theme.text }]}>
              {outfit.style || 'Casual'}
            </Text>
          </View>

          {/* Floating Heart Animation */}
          {heartVisible && (
            <Animated.View style={[styles.heartOverlay, heartAnimatedStyle]}>
              <Ionicons name="heart" size={88} color="#DC2626" />
            </Animated.View>
          )}

          {/* Tap hint pill */}
          <View
            style={[
              styles.tapHintPill,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="layers-outline" size={12} color={theme.textMuted} />
            <Text style={[styles.tapHintText, { color: theme.textMuted }]}>
              Tap breakdown · 2x Like
            </Text>
          </View>
        </View>

        {/* CIELAB K=2 Color Harmony Swatch Bar + Occasion Badge */}
        <View style={[styles.harmonyMetadataBar, { borderTopColor: theme.border }]}>
          <View style={styles.swatchRow}>
            {harmonyHexSwatches.map((hex) => (
              <View
                key={hex}
                style={[
                  styles.swatchChip,
                  { backgroundColor: theme.badgeBg, borderColor: theme.border },
                ]}
              >
                <View style={[styles.swatchDot, { backgroundColor: hex }]} />
                <Text style={[styles.swatchHexText, { color: theme.textMuted }]}>
                  {hex}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.contextBadgesRow}>
            <View
              style={[
                styles.occasionBadgePill,
                { backgroundColor: theme.badgeBg, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.occasionBadgeText, { color: theme.text }]}>
                {getOccasionEmojiLabel(outfit.occasion)}
              </Text>
            </View>
          </View>
        </View>

        {/* Caption & Title */}
        <View style={styles.caption}>
          <Text style={[styles.title, { color: theme.text }]}>{outfit.name}</Text>
          {outfit.caption ? (
            <Text style={[styles.captionText, { color: theme.textMuted }]}>
              {outfit.caption}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Social Actions Row */}
      <View style={[styles.actions, { borderBottomColor: theme.border }]}>
        <View style={styles.likeActionGroup}>
          <Pressable onPress={onLike} style={styles.action}>
            <Ionicons
              name={outfit.liked ? 'heart' : 'heart-outline'}
              size={20}
              color={outfit.liked ? '#DC2626' : theme.text}
            />
          </Pressable>
          <Pressable onPress={onViewLikes} style={styles.countBtn}>
            <Text style={[styles.count, { color: theme.text }]}>
              {outfit.like_count}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={onDislike} style={styles.action}>
          <Ionicons name="thumbs-down-outline" size={18} color={theme.text} />
        </Pressable>

        <Pressable onPress={onRepost} style={styles.action}>
          <Ionicons name="repeat-outline" size={20} color={theme.text} />
        </Pressable>

        <Pressable onPress={onSave} style={[styles.action, styles.saveAction]}>
          <Ionicons
            name={outfit.saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={outfit.saved ? theme.secondaryAccent : theme.text}
          />
        </Pressable>
      </View>

      {/* ================= 1. GARMENT BREAKDOWN + K=2 CIELAB COLOR HARMONY STRIP MODAL ================= */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDetailModalVisible(false)}
        >
          <Pressable
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {outfit.name}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: theme.textMuted }]}>
                  By {outfit.creatorName} · {formattedTime}
                </Text>
              </View>
              <Pressable
                onPress={() => setDetailModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: theme.badgeBg }]}
              >
                <Ionicons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Extracted K = 2 CIELAB Color Harmony Strip */}
            <View
              style={[
                styles.harmonyStripCard,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.harmonyStripLabel, { color: theme.textMuted }]}>
                EXTRACTED K = 2 CIELAB COLOR HARMONY
              </Text>
              <View style={styles.swatchRow}>
                {harmonyHexSwatches.map((hex) => (
                  <View
                    key={hex}
                    style={[
                      styles.swatchChip,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={[styles.swatchDot, { backgroundColor: hex }]} />
                    <Text style={[styles.swatchHexText, { color: theme.text }]}>
                      {hex}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Garments List */}
            <ScrollView
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.breakdownHeading, { color: theme.textMuted }]}>
                OUTFIT PIECES ({canonicalItems.length})
              </Text>

              <View style={styles.garmentItemsList}>
                {canonicalItems.map((item, idx) => {
                  const resolvedImg = resolveGarmentImageUrl(item);
                  const slot = classifyAnatomicalSlot(item.name, item.category);
                  const hex = colorNameToHex(item.color || '');

                  return (
                    <View
                      key={item.id || idx}
                      style={[
                        styles.garmentRow,
                        { borderColor: theme.border, backgroundColor: theme.background },
                      ]}
                    >
                      <View
                        style={[
                          styles.garmentThumbWrap,
                          { backgroundColor: theme.collageCanvas, borderColor: theme.border },
                        ]}
                      >
                        {resolvedImg ? (
                          <Image
                            source={{ uri: resolvedImg }}
                            style={styles.garmentPhoto}
                            contentFit="contain"
                          />
                        ) : (
                          <MiniGarmentSvg
                            slot={slot as any}
                            name={item.name}
                            color={hex}
                            size={44}
                          />
                        )}
                      </View>

                      <View style={styles.garmentInfo}>
                        <View
                          style={[
                            styles.slotBadge,
                            { backgroundColor: theme.badgeBg },
                          ]}
                        >
                          <Text style={[styles.slotBadgeText, { color: theme.text }]}>
                            {(item.category || slot || 'Piece').toUpperCase()}
                          </Text>
                        </View>
                        <Text
                          style={[styles.garmentName, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        {item.color ? (
                          <View style={styles.colorRow}>
                            <View
                              style={[
                                styles.colorDot,
                                { backgroundColor: hex || '#52525B' },
                              ]}
                            />
                            <Text
                              style={[styles.garmentColor, { color: theme.textMuted }]}
                            >
                              {item.color}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setDetailModalVisible(false)}
              style={[
                styles.cancelBtn,
                { borderColor: theme.border, backgroundColor: theme.background },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 2. POST OPTIONS BOTTOM SHEET ================= */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setMenuVisible(false);
          setReportConfirm(false);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setMenuVisible(false);
            setReportConfirm(false);
          }}
        >
          <Pressable
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />

            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              Post Options
            </Text>
            <Text style={[styles.menuReason, { color: theme.textMuted }]}>
              {outfit.genderProfile === 'unisex'
                ? 'Curated on For You matching your style preferences.'
                : `Curated for your ${outfit.style || 'everyday'} preference.`}
            </Text>

            {!reportConfirm ? (
              <>
                <Pressable
                  onPress={() => setMenuVisible(false)}
                  style={styles.menuRow}
                >
                  <Ionicons name="eye-off-outline" size={20} color={theme.text} />
                  <Text style={[styles.menuText, { color: theme.text }]}>
                    Not Interested in this look
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setReportConfirm(true)}
                  style={styles.menuRow}
                >
                  <Ionicons name="flag-outline" size={20} color="#DC2626" />
                  <Text style={[styles.menuText, { color: '#DC2626' }]}>
                    Report Post
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.confirmBox}>
                <Text style={[styles.confirmQuestion, { color: theme.text }]}>
                  Report this post for violating community standards?
                </Text>
                <View style={styles.confirmBtnRow}>
                  <Pressable
                    onPress={() => setReportConfirm(false)}
                    style={[styles.confirmSecondaryBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.confirmSecondaryText, { color: theme.text }]}>
                      Back
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setReportConfirm(false);
                      setMenuVisible(false);
                    }}
                    style={styles.confirmDangerBtn}
                  >
                    <Text style={styles.confirmDangerText}>Submit Report</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  time: {
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  followText: {
    fontSize: 11,
    fontWeight: '700',
  },
  more: {
    padding: 4,
  },
  collageStageWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    position: 'relative',
  },
  postLabel: {
    position: 'absolute',
    top: 10,
    left: 22,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  postLabelText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heartOverlay: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    zIndex: 20,
  },
  tapHintPill: {
    position: 'absolute',
    bottom: 18,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tapHintText: {
    fontSize: 10,
    fontWeight: '600',
  },
  harmonyMetadataBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  swatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  swatchDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  swatchHexText: {
    fontSize: 9,
    fontWeight: '600',
  },
  contextBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  occasionBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  occasionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  caption: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  captionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 18,
  },
  likeActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  action: {
    padding: 2,
  },
  saveAction: {
    marginLeft: 'auto',
  },
  countBtn: {
    paddingHorizontal: 2,
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 20, 0.65)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  harmonyStripCard: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  harmonyStripLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  breakdownHeading: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  garmentItemsList: {
    gap: 8,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  garmentThumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  garmentPhoto: {
    width: '90%',
    height: '90%',
  },
  garmentInfo: {
    flex: 1,
    gap: 3,
  },
  slotBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  garmentName: {
    fontSize: 13,
    fontWeight: '700',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  garmentColor: {
    fontSize: 11,
  },
  cancelBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  menuReason: {
    fontSize: 12,
    lineHeight: 17,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBox: {
    gap: 12,
    paddingVertical: 8,
  },
  confirmQuestion: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmSecondaryBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmDangerBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
