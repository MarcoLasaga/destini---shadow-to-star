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
import Mannequin2D from './Mannequin2D';
import { CommunityOutfit } from '../services/communityService';
import { OutfitClothingItem } from '../types';
import {
  classifyAnatomicalSlot,
  colorNameToHex,
} from '../services/outfitRecommendationService';
import { formatRelativeTime } from '../utils/timeFormat';
import { resolveGarmentImageUrl, MiniGarmentSvg } from '../utils/garmentImageHelper';

interface CommunityOutfitCardProps {
  outfit: CommunityOutfit;
  onLike: () => void;
  onSave: () => void;
  onDislike?: () => void;
  onRepost?: () => void;
  onFollow?: () => void;
  following?: boolean;
}

export default function CommunityOutfitCard({
  outfit,
  onLike,
  onSave,
  onDislike,
  onRepost,
  onFollow,
  following = false,
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

  const mannequinItems: OutfitClothingItem[] = outfit.items.map((item) => {
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

  const triggerHeartAnimation = () => {
    setHeartVisible(true);
    heartScale.value = 0.3;
    heartOpacity.value = 1;
    heartScale.value = withSpring(1.3, { damping: 6, stiffness: 200 });
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 350 }, () => {
        // finished
      })
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
      // Double Tap detected!
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
      }
      triggerHeartAnimation();
      if (!outfit.liked) {
        onLike();
      }
    } else {
      // Single Tap wait
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
                { backgroundColor: '#DCEFCF', borderColor: theme.border },
              ]}
            >
              {outfit.creatorAvatar ? (
                <Image source={{ uri: outfit.creatorAvatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
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
            <Pressable
              onPress={onFollow}
              style={[styles.followButton, following && styles.followingButton]}
            >
              <Text style={[styles.followText, following && styles.followingText]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setMenuVisible(true)} style={styles.more}>
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Proportional 2D Mannequin Board */}
        <View
          style={[
            styles.mannequinBoard,
            { backgroundColor: theme.mode === 'dark' ? '#231B2C' : '#FAF7F0' },
          ]}
        >
          <Mannequin2D items={mannequinItems} compact staticPreview />

          {/* Occasion / Style pill */}
          <View style={styles.postLabel}>
            <Text style={styles.postLabelText}>
              {outfit.occasion || 'Everyday'} · {outfit.style || 'Casual'}
            </Text>
          </View>

          {/* Floating Heart Animation */}
          {heartVisible && (
            <Animated.View style={[styles.heartOverlay, heartAnimatedStyle]}>
              <Ionicons name="heart" size={90} color="#E5484D" />
            </Animated.View>
          )}

          {/* Tap hint pill */}
          <View style={styles.tapHintPill}>
            <Ionicons name="finger-print-outline" size={12} color="#4D9A65" />
            <Text style={styles.tapHintText}>Tap pieces · 2x Like</Text>
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
        <Pressable onPress={onLike} style={styles.action}>
          <Ionicons
            name={outfit.liked ? 'heart' : 'heart-outline'}
            size={20}
            color={outfit.liked ? '#E5484D' : theme.text}
          />
          <Text style={[styles.count, { color: theme.text }]}>
            {outfit.like_count}
          </Text>
        </Pressable>

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
            color={outfit.saved ? '#A36814' : theme.text}
          />
        </Pressable>
      </View>

      {/* ================= 1. GARMENT BREAKDOWN BOTTOM SHEET MODAL ================= */}
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
            {/* Drag Handle Bar */}
            <View style={styles.dragHandle} />

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
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {/* Garments List with real photos or mini vector svgs */}
            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.breakdownHeading, { color: '#4D9A65' }]}>
                OUTFIT PIECES ({outfit.items.length})
              </Text>

              <View style={styles.garmentItemsList}>
                {outfit.items.map((item, idx) => {
                  const resolvedImg = resolveGarmentImageUrl(item);
                  const slot = classifyAnatomicalSlot(item.name, item.category);
                  const hex = colorNameToHex(item.color || '');

                  return (
                    <View
                      key={item.id || idx}
                      style={[
                        styles.garmentRow,
                        { borderColor: theme.border, backgroundColor: theme.mode === 'dark' ? '#251E2E' : '#FAF7F0' },
                      ]}
                    >
                      {/* Image Thumbnail or MiniGarmentSvg */}
                      <View style={styles.garmentThumbWrap}>
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

                      {/* Info */}
                      <View style={styles.garmentInfo}>
                        <View style={styles.slotBadge}>
                          <Text style={styles.slotBadgeText}>
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
                                { backgroundColor: hex || '#666666' },
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
              style={[styles.cancelBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================= 2. POST OPTIONS (REPORT / NOT INTERESTED) BOTTOM SHEET ================= */}
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
            <View style={styles.dragHandle} />

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
                    style={styles.confirmDestructiveBtn}
                  >
                    <Text style={styles.confirmDestructiveText}>Confirm Report</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => {
                setMenuVisible(false);
                setReportConfirm(false);
              }}
              style={[styles.cancelBtn, { borderColor: theme.border, marginTop: 12 }]}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#264C3B',
    fontWeight: '900',
    fontSize: 16,
  },
  name: {
    fontSize: 14,
    fontWeight: '900',
  },
  time: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followButton: {
    borderRadius: 999,
    backgroundColor: '#264C3B',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  followingButton: {
    backgroundColor: '#EAF3D9',
  },
  followText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  followingText: {
    color: '#264C3B',
  },
  more: {
    padding: 4,
  },
  mannequinBoard: {
    marginHorizontal: 12,
    borderRadius: 18,
    height: 290,
    paddingVertical: 8,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postLabel: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  postLabelText: {
    color: '#264C3B',
    fontSize: 10,
    fontWeight: '800',
  },
  heartOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
  },
  tapHintPill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tapHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#24513B',
  },
  caption: {
    padding: 14,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  captionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    gap: 20,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  saveAction: {
    marginLeft: 'auto',
  },
  count: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  breakdownHeading: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
  },
  garmentItemsList: {
    gap: 10,
    paddingBottom: 14,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  garmentThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  garmentPhoto: {
    width: '100%',
    height: '100%',
  },
  garmentInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  slotBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 3,
  },
  slotBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2E7D32',
  },
  garmentName: {
    fontSize: 14,
    fontWeight: '800',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  garmentColor: {
    fontSize: 11,
    fontWeight: '600',
  },
  cancelBtn: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  menuReason: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmBox: {
    paddingVertical: 12,
    gap: 12,
  },
  confirmQuestion: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  confirmDestructiveBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDestructiveText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
