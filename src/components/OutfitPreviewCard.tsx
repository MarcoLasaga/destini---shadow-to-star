import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import { GeneratedOutfit } from '../types';
import StarRating from './StarRating';

export default function OutfitPreviewCard({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { toggleFavorite, toggleSave, markAsWorn, remixCurrentOutfit } = useOutfit();

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recommended Outfits</Text>
        {outfit.badge && (
          <View style={[styles.badgePill, { backgroundColor: theme.primaryAccent }]}>
            <Text style={styles.badgeText}>{outfit.badge}</Text>
          </View>
        )}
      </View>

      <View style={styles.imageWrap}>
        <Image source={{ uri: outfit.image }} style={styles.image} contentFit="cover" transition={250} />
        <View style={[styles.categoryPill, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
          <Text style={styles.categoryText}>{outfit.occasionLabel}</Text>
        </View>
        <View style={[styles.matchPill, { backgroundColor: theme.secondaryAccent }]}>
          <Text style={styles.matchText}>{outfit.matchPercent}% Match</Text>
        </View>
        {outfit.worn && (
          <View style={styles.wornBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
            <Text style={styles.wornText}>Worn</Text>
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
            {outfit.weatherCondition} · {outfit.weatherTempF}°F
          </Text>
        </View>

        <View style={[styles.statsRow, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{outfit.matchPercent}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Match</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{outfit.sustainPercent}%</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Sustain</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]}>{outfit.comfortRating}★</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Comfort</Text>
          </View>
        </View>

        <Text style={[styles.subHeading, { color: theme.textMuted }]}>CLOTHING ITEMS</Text>
        <View style={styles.itemsGrid}>
          {outfit.clothingItems.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.itemCategory, { color: theme.textMuted }]}>{item.category}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.subHeading, { color: theme.textMuted }]}>WHY THIS OUTFIT</Text>
        <View style={styles.chipsWrap}>
          {outfit.whyReasons.map((reason) => (
            <View key={reason.title} style={[styles.reasonChip, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
              <Text style={[styles.reasonText, { color: theme.text }]}>{reason.title}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.feedbackCard, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
          <Text style={[styles.feedbackTitle, { color: theme.textMuted }]}>Sample User Feedback</Text>
          {outfit.feedback.map((review) => (
            <View key={review.id} style={styles.feedbackRow}>
              <StarRating rating={review.stars} size={13} />
              <Text style={[styles.feedbackQuote, { color: theme.textMuted }]}>"{review.quote}"</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionsGrid}>
          <Pressable
            onPress={() => toggleSave(outfit.id)}
            style={[styles.actionButton, { borderColor: theme.border, backgroundColor: outfit.saved ? theme.primaryAccent : theme.background }]}
          >
            <Ionicons name="bookmark-outline" size={15} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>{outfit.saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
          <Pressable
            onPress={() => toggleFavorite(outfit.id)}
            style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Ionicons name={outfit.favorited ? 'heart' : 'heart-outline'} size={15} color={outfit.favorited ? '#E5484D' : theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>Like</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Ionicons name="share-social-outline" size={15} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>Share</Text>
          </Pressable>
          <Pressable
            onPress={remixCurrentOutfit}
            style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Ionicons name="sync-outline" size={15} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>Remix</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('OutfitDetails', { outfitId: outfit.id })}
            style={[styles.actionButton, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Ionicons name="eye-outline" size={15} color={theme.text} />
            <Text style={[styles.actionLabel, { color: theme.text }]}>Details</Text>
          </Pressable>
          <Pressable
            onPress={() => markAsWorn(outfit.id)}
            style={[
              styles.actionButton,
              { borderColor: theme.border, backgroundColor: outfit.worn ? theme.secondaryAccent : theme.background },
            ]}
          >
            <Ionicons name="checkmark-outline" size={15} color={outfit.worn ? '#FFFFFF' : theme.text} />
            <Text style={[styles.actionLabel, { color: outfit.worn ? '#FFFFFF' : theme.text }]}>{outfit.worn ? 'Worn' : 'Worn'}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  badgePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#3D2E10' },
  imageWrap: { width: '100%', aspectRatio: 0.85, position: 'relative' },
  image: { width: '100%', height: '100%' },
  categoryPill: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  categoryText: { fontSize: 11.5, fontWeight: '700', color: '#2B2B2B' },
  matchPill: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  matchText: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },
  wornBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2F8F5B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  wornText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  infoBlock: { padding: 16, gap: 14 },
  outfitName: { fontSize: 19, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  occasionChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  occasionChipText: { fontSize: 11.5, fontWeight: '600' },
  weatherText: { fontSize: 12.5 },
  statsRow: { flexDirection: 'row', borderRadius: 14, paddingVertical: 14 },
  statBlock: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  subHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '47%' },
  itemImage: { width: 40, height: 40, borderRadius: 20 },
  itemName: { fontSize: 13, fontWeight: '600' },
  itemCategory: { fontSize: 11.5 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  reasonText: { fontSize: 12, fontWeight: '600' },
  feedbackCard: { borderRadius: 14, padding: 14, gap: 8 },
  feedbackTitle: { fontSize: 11.5, fontWeight: '700' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackQuote: { fontSize: 12.5, fontStyle: 'italic', flex: 1 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 11,
    width: '31%',
  },
  actionLabel: { fontSize: 12, fontWeight: '600' },
});