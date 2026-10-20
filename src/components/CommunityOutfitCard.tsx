import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { CommunityOutfit } from '../services/communityService';
import StarRating from './StarRating';
import { resolveDatasetGarmentPhoto } from '../data/datasetGarmentCatalog';

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

  const coverUri =
    outfit.cover_image &&
    !outfit.cover_image.startsWith('illustration://') &&
    !outfit.cover_image.includes('picsum.photos')
      ? outfit.cover_image
      : outfit.items[0]?.image
      ? resolveDatasetGarmentPhoto(outfit.items[0].name, outfit.items[0].category, outfit.items[0].image)
      : null;

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
        <View>
          <Text style={[styles.creatorName, { color: theme.text }]}>{outfit.creatorName}</Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {outfit.occasion.toUpperCase()} · {outfit.style}
          </Text>
        </View>
      </View>

      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" />
      ) : (
        <View style={[styles.cover, styles.noImage, { backgroundColor: theme.background }]}>
          <Ionicons name="shirt-outline" size={30} color={theme.textMuted} />
        </View>
      )}

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
                contentFit="cover"
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
  cover: { width: '100%', height: 240 },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  caption: { fontSize: 13, lineHeight: 19 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  item: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemImage: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EEE' },
  itemName: { fontSize: 12, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 12, fontWeight: '600' },
  rating: { flex: 1, alignItems: 'flex-end', gap: 2 },
});
