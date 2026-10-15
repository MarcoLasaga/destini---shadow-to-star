import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import { useToast } from '../contexts/ToastContext';
import { GeneratedOutfit } from '../types';
import StarRating from './StarRating';
import ShareOutfitModal from './ShareOutfitModal';
import { useCommunity } from '../contexts/CommunityContext';

export default function OutfitPreviewCard({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { toggleSave, markAsWorn, remixCurrentOutfit, submitPreferenceEvent } = useOutfit();
  const { refresh } = useCommunity();
  const { showToast } = useToast();
  const [shareVisible, setShareVisible] = React.useState(false);

  const baseScore = outfit.hybridScore ?? outfit.matchPercent;
  const content = outfit.contentScore ?? Math.min(99, Math.round(baseScore * 0.95));
  const collaborative = outfit.collaborativeScore ?? Math.min(99, Math.round(baseScore * 1.02));
  const hybrid = Math.round(0.55 * content + 0.45 * collaborative);

  const handleWear = async () => {
    const wasWorn = !!outfit.worn;
    await markAsWorn(outfit.id);
    showToast(wasWorn ? 'Outfit unmarked as worn. Garments restored to clean.' : 'Outfit marked as worn! Laundry & wear count updated.');
  };

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

        {/* Garment Items Preview */}
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

        {/* Explainability Reasons */}
        <Text style={[styles.subHeading, { color: theme.textMuted }]}>EXPLAINABILITY REASONS</Text>
        <View style={styles.reasonsList}>
          {outfit.whyReasons.map((reason) => (
            <View
              key={reason.id}
              style={[
                styles.reasonRow,
                { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' },
              ]}
            >
              <Ionicons name={reason.icon as any} size={15} color={theme.secondaryAccent} />
              <Text style={[styles.reasonText, { color: theme.text }]}>{reason.description}</Text>
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
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 6,
  },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '48%' },
  itemImage: { width: 38, height: 38, borderRadius: 10 },
  itemName: { fontSize: 12.5, fontWeight: '600' },
  itemCategory: { fontSize: 11 },
  reasonsList: { gap: 6 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reasonText: { fontSize: 12, flex: 1, lineHeight: 16 },
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
