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
  normalizeHexCode,
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

function getOccasionMeta(occasion?: string): { icon: keyof typeof Ionicons.glyphMap; label: string } {
  const occ = (occasion || 'Casual').toLowerCase();
  if (occ.includes('school') || occ.includes('campus') || occ.includes('college') || occ.includes('academic')) {
    return { icon: 'school-outline', label: 'School' };
  }
  if (occ.includes('office') || occ.includes('work') || occ.includes('formal') || occ.includes('business')) {
    return { icon: 'briefcase-outline', label: 'Office' };
  }
  if (occ.includes('party') || occ.includes('night') || occ.includes('date')) {
    return { icon: 'sparkles-outline', label: 'Party' };
  }
  if (occ.includes('workout') || occ.includes('sport') || occ.includes('gym') || occ.includes('active')) {
    return { icon: 'barbell-outline', label: 'Workout' };
  }
  return { icon: 'cafe-outline', label: occasion || 'Casual' };
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
  const isDark = theme.mode === 'dark';
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportConfirm, setReportConfirm] = useState(false);
  const [heartVisible, setHeartVisible] = useState(false);
  const [passedLook, setPassedLook] = useState(false);
  const [repostedLook, setRepostedLook] = useState(false);

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
      hexColor: normalizeHexCode((item as any).colorHex || (item as any).hexColor, item.color || 'Neutral'),
      slotType: slot,
    };
  });

  // Extract unique hex colors for Color Palette Swatch Bar
  const harmonyHexSwatches = Array.from(
    new Set(
      outfitPieces.map((it) => normalizeHexCode(it.hexColor, it.color || 'Neutral'))
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
  const occasionMeta = getOccasionMeta(outfit.occasion);

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
                { backgroundColor: '#364536', borderColor: theme.border },
              ]}
            >
              {outfit.creatorAvatar ? (
                <Image source={{ uri: outfit.creatorAvatar }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: '#F3F1EF' }]}>
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
                  {
                    backgroundColor: following ? theme.surfaceSecondary : '#364536',
                    borderColor: following ? theme.border : '#364536',
                    borderWidth: 1,
                  },
                ]}
              >
                <Ionicons
                  name={following ? 'checkmark' : 'person-add-outline'}
                  size={11}
                  color={following ? (isDark ? '#98C4A4' : '#364536') : '#F3F1EF'}
                />
                <Text
                  style={[
                    styles.followText,
                    { color: following ? theme.text : '#F3F1EF' },
                  ]}
                >
                  {following ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setMenuVisible(true)}
              style={[
                styles.more,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={17} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Structured Studio Outfit Collage Canvas */}
        <View style={styles.collageStageWrap}>
          <AltaOutfitCollage items={outfit.items} interactive={false} />

          {/* Floating Heart Animation */}
          {heartVisible && (
            <Animated.View style={[styles.heartOverlay, heartAnimatedStyle]}>
              <Ionicons name="heart" size={88} color="#E84A42" />
            </Animated.View>
          )}
        </View>

        {/* Color Palette Swatch Bar + Style/Occasion Badges */}
        <View style={[styles.harmonyMetadataBar, { borderTopColor: theme.border }]}>
          <View style={styles.swatchRow}>
            {harmonyHexSwatches.map((hex) => (
              <View
                key={hex}
                style={[
                  styles.swatchChip,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.swatchDot,
                    {
                      backgroundColor: hex,
                      borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)',
                    },
                  ]}
                />
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
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name={occasionMeta.icon}
                size={11}
                color={isDark ? '#8AB896' : '#364536'}
              />
              <Text style={[styles.occasionBadgeText, { color: theme.text }]}>
                {occasionMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Caption & Title + Unified Social Action Footer Inside Card */}
        <View style={styles.caption}>
          <Text style={[styles.title, { color: theme.text }]}>{outfit.name}</Text>
          {outfit.caption ? (
            <Text style={[styles.captionText, { color: theme.textMuted }]}>
              {outfit.caption}
            </Text>
          ) : null}
        </View>

        <View style={[styles.actions, { borderTopColor: theme.border }]}>
          <View style={styles.leftActionCluster}>
            <View
              style={[
                styles.actionPill,
                {
                  backgroundColor: outfit.liked
                    ? 'rgba(232, 74, 66, 0.14)'
                    : theme.surfaceSecondary,
                  borderColor: outfit.liked ? '#E84A42' : theme.border,
                },
              ]}
            >
              <Pressable onPress={onLike} style={styles.actionHit} hitSlop={6} accessibilityLabel="Like post">
                <Ionicons
                  name={outfit.liked ? 'heart' : 'heart-outline'}
                  size={17}
                  color={outfit.liked ? '#E84A42' : theme.text}
                />
              </Pressable>
              <Pressable onPress={onViewLikes} style={styles.countBtn} hitSlop={6} accessibilityLabel="View likes">
                <Text
                  style={[
                    styles.count,
                    { color: outfit.liked ? '#E84A42' : theme.text },
                  ]}
                >
                  {outfit.like_count}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                setPassedLook((prev) => !prev);
                onDislike?.();
              }}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: passedLook
                    ? 'rgba(232, 74, 66, 0.14)'
                    : theme.surfaceSecondary,
                  borderColor: passedLook ? '#E84A42' : theme.border,
                },
              ]}
              hitSlop={6}
              accessibilityLabel="Not for me"
            >
              <Ionicons
                name={passedLook ? 'heart-dislike' : 'heart-dislike-outline'}
                size={17}
                color={passedLook ? '#E84A42' : theme.textMuted}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                setRepostedLook((prev) => !prev);
                onRepost?.();
              }}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: repostedLook
                    ? isDark
                      ? 'rgba(152, 196, 164, 0.18)'
                      : '#EBF0EB'
                    : theme.surfaceSecondary,
                  borderColor: repostedLook
                    ? isDark
                      ? '#98C4A4'
                      : '#364536'
                    : theme.border,
                },
              ]}
              hitSlop={6}
              accessibilityLabel="Share or repost look"
            >
              <Ionicons
                name={repostedLook ? 'paper-plane' : 'paper-plane-outline'}
                size={16.5}
                color={
                  repostedLook
                    ? isDark
                      ? '#98C4A4'
                      : '#364536'
                    : theme.textMuted
                }
              />
            </Pressable>
          </View>

          <View style={styles.rightActionCluster}>
            <Pressable
              onPress={() => setDetailModalVisible(true)}
              style={[
                styles.inspectHintBtn,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons name="layers-outline" size={13} color={theme.textMuted} />
              <Text style={[styles.inspectHintText, { color: theme.textMuted }]}>
                {canonicalItems.length} pieces
              </Text>
            </Pressable>

            <Pressable
              onPress={onSave}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: outfit.saved
                    ? isDark
                      ? 'rgba(152, 196, 164, 0.18)'
                      : '#EBF0EB'
                    : theme.surfaceSecondary,
                  borderColor: outfit.saved
                    ? isDark
                      ? '#98C4A4'
                      : '#364536'
                    : theme.border,
                },
              ]}
              hitSlop={6}
              accessibilityLabel="Save look"
            >
              <Ionicons
                name={outfit.saved ? 'bookmark' : 'bookmark-outline'}
                size={17}
                color={outfit.saved ? (isDark ? '#98C4A4' : '#364536') : theme.text}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>

      {/* ================= 1. GARMENT BREAKDOWN + COLOR PALETTE STRIP MODAL ================= */}
      <Modal statusBarTranslucent={true}
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

            {/* Clean Outfit Color Palette Strip */}
            <View
              style={[
                styles.harmonyStripCard,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.harmonyStripLabel, { color: theme.textMuted }]}>
                OUTFIT COLOR PALETTE
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
                    <View
                      style={[
                        styles.swatchDot,
                        {
                          backgroundColor: hex,
                          borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)',
                        },
                      ]}
                    />
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
                  const hex = normalizeHexCode((item as any).colorHex || (item as any).hexColor, item.color || 'Neutral');

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
                                {
                                  backgroundColor: hex || '#52525B',
                                  borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
                                  borderWidth: 0.8,
                                },
                              ]}
                            />
                            <Text
                              style={[styles.garmentColor, { color: theme.textMuted }]}
                            >
                              {item.color} · {hex}
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
      <Modal statusBarTranslucent={true}
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
                  <Ionicons name="flag-outline" size={20} color="#E84A42" />
                  <Text style={[styles.menuText, { color: '#E84A42' }]}>
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
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 20,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
    fontWeight: '800',
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
  },
  time: {
    fontSize: 11,
    marginTop: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  followText: {
    fontSize: 11,
    fontWeight: '800',
  },
  more: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collageStageWrap: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    position: 'relative',
  },
  heartOverlay: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    zIndex: 20,
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
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  swatchHexText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  contextBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  occasionBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  occasionBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  caption: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  captionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  leftActionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rightActionCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    gap: 5,
  },
  actionHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inspectHintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    borderWidth: 1,
    gap: 4,
  },
  inspectHintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countBtn: {
    paddingHorizontal: 1,
  },
  count: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 16, 15, 0.68)',
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
    fontWeight: '800',
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
    fontSize: 9.5,
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
    backgroundColor: '#E84A42',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F3F1EF',
  },
});
