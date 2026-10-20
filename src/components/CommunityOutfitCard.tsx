import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { CommunityOutfit } from '../services/communityService';
import StarRating from './StarRating';
import { resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';
import { classifyAnatomicalSlot } from '../services/outfitRecommendationService';
import { AnatomicalSlotType } from '../types';

export default function CommunityOutfitCard({
  outfit,
  onLike,
  onSave,
  onRate,
}: {
  outfit: CommunityOutfit;
  onLike: () => void;
  onSave: () => void;
  onRate: (rating: number) => void;
}) {
  const theme = useAppTheme();

  // Map community post's items into the 2-Column Spatial Outfit Board slots
  const spatialSlots = useMemo(() => {
    const map: Partial<Record<AnatomicalSlotType, { id: string; name: string; category: string; image: string }>> = {};
    outfit.items.forEach((item) => {
      const slot = classifyAnatomicalSlot(item.name, item.category);
      const photo = resolveDatasetGarmentPhoto(item.name, item.category, item.image);
      if (!map[slot]) {
        map[slot] = { ...item, image: photo };
      }
    });
    return map;
  }, [outfit.items]);

  const renderSlotImage = (
    slot: AnatomicalSlotType,
    heightPercent: `${number}%`
  ) => {
    const slotItem = spatialSlots[slot];
    return (
      <View style={[styles.spatialSlot, { height: heightPercent }]}>
        {slotItem?.image ? (
          <Image
            source={{ uri: slotItem.image }}
            style={styles.cutoutImage}
            contentFit="contain"
          />
        ) : (
          <View style={styles.emptySlotBox}>
            <Ionicons name="shirt-outline" size={18} color="#CBD5E1" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.creator}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.primaryAccent + '40', borderColor: theme.border, borderWidth: 1 },
          ]}
        >
          {outfit.creatorAvatar ? (
            <Image source={{ uri: outfit.creatorAvatar }} style={styles.avatarImage} />
          ) : (
            <Text style={{ color: theme.text, fontWeight: '700' }}>
              {outfit.creatorName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.creatorName, { color: theme.text }]}>{outfit.creatorName}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {outfit.occasion.toUpperCase()} · {outfit.style}
          </Text>
        </View>
      </View>

      {/* 2-Column Spatial Outfit Board inside Community Post */}
      <View style={styles.spatialBoardWrap}>
        <View style={styles.whiteSpatialBoard}>
          <View style={styles.boardTopHeader}>
            <Text style={styles.boardOccasionText}>
              {outfit.occasion.charAt(0).toUpperCase() + outfit.occasion.slice(1).toLowerCase()}
            </Text>
            <View style={styles.boardBadge}>
              <Text style={styles.boardBadgeText}>{outfit.items.length} Pieces</Text>
            </View>
          </View>

          <View style={styles.spatialCanvas}>
            <View style={styles.leftColumn}>
              {renderSlotImage('innerTop', '44%')}
              {renderSlotImage('bottom', '54%')}
            </View>
            <View style={styles.rightColumn}>
              {renderSlotImage('outerLayer', '42%')}
              {renderSlotImage('accessory', '26%')}
              {renderSlotImage('shoes', '30%')}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>{outfit.name}</Text>
        {outfit.caption ? (
          <Text style={[styles.caption, { color: theme.textMuted }]}>{outfit.caption}</Text>
        ) : null}

        <View style={styles.items}>
          {outfit.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Image
                source={{ uri: resolveDatasetGarmentPhoto(item.name, item.category, item.image) }}
                style={styles.itemImage}
                contentFit="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>{item.category}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.footer, { borderTopWidth: 1, borderTopColor: theme.border }]}>
          <Pressable
            onPress={onLike}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons
              name={outfit.liked ? 'heart' : 'heart-outline'}
              size={19}
              color={outfit.liked ? '#E5484D' : theme.text}
            />
            <Text style={[styles.actionText, { color: theme.text }]}>{outfit.like_count}</Text>
          </Pressable>

          <Pressable
            onPress={onSave}
            style={({ pressed }) => [styles.action, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons
              name={outfit.saved ? 'bookmark' : 'bookmark-outline'}
              size={19}
              color={outfit.saved ? '#A36814' : theme.text}
            />
            <Text style={[styles.actionText, { color: theme.text }]}>{outfit.save_count}</Text>
          </Pressable>

          <View style={styles.rating}>
            <StarRating
              rating={outfit.myRating ?? outfit.rating_avg}
              size={15}
              editable
              onChange={onRate}
            />
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {outfit.rating_avg ? outfit.rating_avg.toFixed(1) : '—'} ({outfit.rating_count})
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  creator: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  creatorName: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, letterSpacing: 0.3 },
  spatialBoardWrap: {
    paddingHorizontal: 14,
  },
  whiteSpatialBoard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    height: 300,
    borderWidth: 1,
    borderColor: '#ECE8DF',
  },
  boardTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  boardOccasionText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#1E1B24',
  },
  boardBadge: {
    backgroundColor: '#F4F1EA',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  boardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B1D6F',
  },
  spatialCanvas: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
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
    padding: 3,
  },
  cutoutImage: {
    width: '100%',
    height: '100%',
  },
  emptySlotBox: {
    width: '84%',
    height: '84%',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  caption: { fontSize: 13, lineHeight: 19 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECE8DF',
  },
  itemName: { fontSize: 12, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '600' },
  rating: { flex: 1, alignItems: 'flex-end', gap: 2 },
});
