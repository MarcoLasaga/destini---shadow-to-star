import React, { useState } from 'react';
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

interface OutfitPreviewCardProps {
  outfit: GeneratedOutfit;
  index?: number;
  totalCount?: number;
}

export default function OutfitPreviewCard({
  outfit,
  index = 0,
  totalCount = 3,
}: OutfitPreviewCardProps) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { toggleSave, markAsWorn, submitPreferenceEvent } = useOutfit();
  const { refresh } = useCommunity();
  const { showToast } = useToast();
  const [shareVisible, setShareVisible] = useState(false);
  const [editTrigger, setEditTrigger] = useState(0);

  const handleWear = async () => {
    const wasWorn = !!outfit.worn;
    await markAsWorn(outfit.id);
    showToast(
      wasWorn
        ? 'Outfit unmarked as worn. Garments restored to clean.'
        : 'Outfit marked as worn! Laundry & wear count updated.'
    );
  };

  const handleLikeOrSave = () => {
    const wasSaved = !!outfit.saved;
    toggleSave(outfit.id);
    submitPreferenceEvent(outfit.id, 'LIKE');
    showToast(wasSaved ? 'Removed from saved outfits.' : '♡ Liked & saved to your outfits!');
  };

  return (
    <Animated.View entering={FadeInDown.duration(350)} style={styles.cardWrapper}>
      {/* 2-COLUMN TOP-TO-BOTTOM SPATIAL OUTFIT BOARD CARD */}
      <OutfitCollageBoard
        outfit={outfit}
        index={index}
        totalCount={totalCount}
        editTrigger={editTrigger}
      />

      {/* d) Social & Edit Action Bar Directly Below the Card */}
      <View
        style={[
          styles.actionBarContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.leftIconRow}>
          {/* ♡ Like / Save */}
          <Pressable
            onPress={handleLikeOrSave}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: outfit.saved || outfit.favorited ? '#FEE2E2' : theme.background,
                borderColor: outfit.saved || outfit.favorited ? '#EF4444' : theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons
              name={outfit.saved || outfit.favorited ? 'heart' : 'heart-outline'}
              size={19}
              color={outfit.saved || outfit.favorited ? '#EF4444' : theme.text}
            />
          </Pressable>

          {/* ✏️ Edit / Swap pieces */}
          <Pressable
            onPress={() => setEditTrigger((prev) => prev + 1)}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons name="pencil-outline" size={18} color={theme.text} />
          </Pressable>

          {/* 👎 Dislike */}
          <Pressable
            onPress={() => {
              submitPreferenceEvent(outfit.id, 'DISLIKE');
              showToast('👎 Preference saved!');
            }}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: outfit.disliked ? '#FEE2E2' : theme.background,
                borderColor: outfit.disliked ? '#EF4444' : theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons
              name={outfit.disliked ? 'thumbs-down' : 'thumbs-down-outline'}
              size={18}
              color={outfit.disliked ? '#EF4444' : theme.text}
            />
          </Pressable>

          {/* ✈️ Share to Community */}
          <Pressable
            onPress={() => setShareVisible(true)}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons name="paper-plane-outline" size={18} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.rightCtaColumn}>
          <Pressable
            onPress={handleWear}
            style={({ pressed }) => [
              styles.wearThisLookPill,
              {
                backgroundColor: outfit.worn ? '#2F8F5B' : theme.secondaryAccent,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              name={outfit.worn ? 'checkmark-circle' : 'shirt-outline'}
              size={15}
              color={outfit.worn ? '#FFFFFF' : theme.onAccent}
            />
            <Text
              style={[
                styles.wearThisLookText,
                { color: outfit.worn ? '#FFFFFF' : theme.onAccent },
              ]}
            >
              {outfit.worn ? 'Worn Today' : 'Wear This Look'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('OutfitDetails', { outfitId: outfit.id })}
            style={styles.viewDetailsTap}
            hitSlop={6}
          >
            <Text style={[styles.viewDetailsText, { color: theme.accentText }]}>
              View Details ›
            </Text>
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
  cardWrapper: {
    marginBottom: 18,
    gap: 10,
  },
  actionBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  leftIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightCtaColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  wearThisLookPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  wearThisLookText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  viewDetailsTap: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  viewDetailsText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
