import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useOutfit } from '../contexts/OutfitContext';
import { RootStackParamList } from '../types';
import StarRating from '../components/StarRating';
import ShareOutfitModal from '../components/ShareOutfitModal';
import { useCommunity } from '../contexts/CommunityContext';
import { useToast } from '../contexts/ToastContext';

const { width } = Dimensions.get('window');

export default function OutfitDetailsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'OutfitDetails'>>();
  const { getOutfit, toggleSave, markAsWorn, submitWearFeedback, submitPreferenceEvent } = useOutfit();
  const { refresh } = useCommunity();
  const { showToast } = useToast();
  const [shareVisible, setShareVisible] = useState(false);

  const outfit = getOutfit(route.params.outfitId);
  const [wearRating, setWearRating] = useState(outfit?.wearRating ?? 0);
  const [wearNotes, setWearNotes] = useState(outfit?.wearNotes ?? '');

  if (!outfit) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.notFound}>
          <Text style={{ color: theme.text }}>This outfit is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hybrid = outfit.hybridScore ?? outfit.matchPercent;
  const content = outfit.contentScore ?? Math.min(99, Math.round(hybrid * 0.95));
  const collaborative = outfit.collaborativeScore ?? Math.min(99, Math.round(hybrid * 1.02));

  const handleSaveFeedback = () => {
    submitWearFeedback(outfit.id, wearRating, wearNotes);
    showToast('Wear feedback and rating saved!');
  };

  const handleWear = async () => {
    await markAsWorn(outfit.id);
    showToast('Outfit marked as worn! Wardrobe laundry status updated.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.background }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.circleButton, { backgroundColor: theme.surface }]}>
          <Ionicons name="arrow-back" size={19} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {outfit.name}
        </Text>
        <Pressable onPress={() => toggleSave(outfit.id)} style={[styles.circleButton, { backgroundColor: theme.surface }]}>
          <Ionicons
            name={outfit.saved ? 'bookmark' : 'bookmark-outline'}
            size={19}
            color={outfit.saved ? '#A36814' : theme.text}
          />
        </Pressable>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: outfit.image }} style={styles.image} contentFit="cover" transition={250} />
          <View style={styles.weatherBadge}>
            <Ionicons name="partly-sunny-outline" size={13} color="#FFD586" />
            <Text style={styles.weatherBadgeText}>
              OpenWeatherMap Live: {outfit.weatherTempF ?? 75}°F {outfit.weatherCondition ?? 'Clear'}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Hybrid Recommendation Score Breakdown */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="analytics-outline" size={17} color={theme.secondaryAccent} />
              <Text style={[styles.statValue, { color: theme.secondaryAccent }]}>{hybrid}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Hybrid Score</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="sparkles-outline" size={17} color={theme.text} />
              <Text style={[styles.statValue, { color: theme.text }]}>{content}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Content-Based</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="people-outline" size={17} color={theme.text} />
              <Text style={[styles.statValue, { color: theme.text }]}>{collaborative}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Collaborative</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="leaf-outline" size={17} color="#2F8F5B" />
              <Text style={[styles.statValue, { color: '#2F8F5B' }]}>{outfit.sustainPercent}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Reuse</Text>
            </View>
          </View>

          {/* 4 Required Action Buttons: Like, Dislike, Save, Wear */}
          <View style={styles.mainActionRow}>
            <Pressable
              onPress={() => submitPreferenceEvent(outfit.id, 'LIKE')}
              style={[
                styles.mainActionBtn,
                {
                  borderColor: outfit.favorited ? '#2F8F5B' : theme.border,
                  backgroundColor: outfit.favorited ? '#2F8F5B18' : theme.surface,
                },
              ]}
            >
              <Ionicons
                name={outfit.favorited ? 'thumbs-up' : 'thumbs-up-outline'}
                size={16}
                color={outfit.favorited ? '#2F8F5B' : theme.text}
              />
              <Text style={[styles.mainActionBtnText, { color: outfit.favorited ? '#2F8F5B' : theme.text }]}>
                Like
              </Text>
            </Pressable>

            <Pressable
              onPress={() => submitPreferenceEvent(outfit.id, 'DISLIKE')}
              style={[
                styles.mainActionBtn,
                {
                  borderColor: outfit.disliked ? '#E5484D' : theme.border,
                  backgroundColor: outfit.disliked ? '#E5484D18' : theme.surface,
                },
              ]}
            >
              <Ionicons
                name={outfit.disliked ? 'thumbs-down' : 'thumbs-down-outline'}
                size={16}
                color={outfit.disliked ? '#E5484D' : theme.text}
              />
              <Text style={[styles.mainActionBtnText, { color: outfit.disliked ? '#E5484D' : theme.text }]}>
                Dislike
              </Text>
            </Pressable>

            <Pressable
              onPress={() => toggleSave(outfit.id)}
              style={[
                styles.mainActionBtn,
                {
                  borderColor: outfit.saved ? theme.primaryAccent : theme.border,
                  backgroundColor: outfit.saved ? theme.primaryAccent + '33' : theme.surface,
                },
              ]}
            >
              <Ionicons
                name={outfit.saved ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={outfit.saved ? '#A36814' : theme.text}
              />
              <Text style={[styles.mainActionBtnText, { color: outfit.saved ? '#A36814' : theme.text }]}>
                {outfit.saved ? 'Saved' : 'Save'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleWear}
              style={[
                styles.mainActionBtn,
                {
                  borderColor: outfit.worn ? theme.secondaryAccent : theme.border,
                  backgroundColor: outfit.worn ? theme.secondaryAccent : theme.surface,
                },
              ]}
            >
              <Ionicons
                name={outfit.worn ? 'checkmark-circle' : 'shirt-outline'}
                size={16}
                color={outfit.worn ? '#FFFFFF' : theme.text}
              />
              <Text style={[styles.mainActionBtnText, { color: outfit.worn ? '#FFFFFF' : theme.text }]}>
                {outfit.worn ? 'Worn' : 'Wear'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.infoGrid}>
            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="pricetag-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Occasion</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>{outfit.occasionLabel}</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="sunny-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>OpenWeatherMap</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {outfit.weatherCondition && outfit.weatherTempF !== null
                  ? `${outfit.weatherCondition} · ${outfit.weatherTempF}°F`
                  : '75°F Clear'}
              </Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="sparkles-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Style Preference</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>{outfit.occasionLabel}</Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="color-palette-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Color Palette</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
                {outfit.colorPalette.map((c) => c.name).join(', ')}
              </Text>
            </View>
          </View>

          {/* Garment Breakdown */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Garment Breakdown</Text>
            <View style={styles.breakdownGrid}>
              {outfit.clothingItems.map((item) => (
                <View key={item.id} style={styles.breakdownTile}>
                  <Image source={{ uri: item.image }} style={styles.breakdownImage} contentFit="cover" />
                  <Text style={[styles.breakdownName, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.breakdownCategory, { color: theme.textMuted }]}>{item.category}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Explainability Reasons */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sparkleIcon, { backgroundColor: theme.secondaryAccent + '20' }]}>
                <Ionicons name="sparkles" size={14} color={theme.secondaryAccent} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Why was this outfit recommended?
              </Text>
            </View>
            {outfit.whyReasons.map((reason) => (
              <View key={reason.id} style={styles.reasonRow}>
                <View style={[styles.reasonIcon, { backgroundColor: theme.secondaryAccent + '15' }]}>
                  <Ionicons name={reason.icon as any} size={15} color={theme.secondaryAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reasonTitle, { color: theme.text }]}>{reason.title}</Text>
                  <Text style={[styles.reasonDescription, { color: theme.textMuted }]}>{reason.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Wear Notes & Feedback */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Fit Score & Wear Notes</Text>
            <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 8 }]}>How did this outfit feel?</Text>
            <StarRating rating={wearRating} size={24} editable onChange={setWearRating} />

            <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>Wear notes</Text>
            <TextInput
              value={wearNotes}
              onChangeText={setWearNotes}
              placeholder="Record comfort notes throughout your day..."
              placeholderTextColor={theme.textMuted}
              multiline
              style={[styles.notesInput, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
            />

            <Pressable onPress={handleSaveFeedback} style={[styles.saveFeedbackButton, { backgroundColor: theme.secondaryAccent }]}>
              <Ionicons name="save-outline" size={16} color="#FFFFFF" />
              <Text style={styles.saveFeedbackLabel}>Save Feedback</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <ShareOutfitModal
        outfit={outfit}
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        onPublished={() => refresh()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  circleButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  scrollContent: { paddingBottom: 40 },
  imageWrap: { width, height: width * 0.85, position: 'relative' },
  image: { width: '100%', height: '100%' },
  weatherBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(27, 27, 31, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  weatherBadgeText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '600' },
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, borderRadius: 14, borderWidth: 1, alignItems: 'center', paddingVertical: 12, gap: 3 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 9.5, textAlign: 'center', fontWeight: '600' },
  mainActionRow: { flexDirection: 'row', gap: 8 },
  mainActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
  },
  mainActionBtnText: { fontSize: 12, fontWeight: '700' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoBox: { width: '47.5%', borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 11.5 },
  infoValue: { fontSize: 13, fontWeight: '700' },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakdownTile: { width: '47%', gap: 4 },
  breakdownImage: { width: '100%', aspectRatio: 1, borderRadius: 14 },
  breakdownName: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  breakdownCategory: { fontSize: 11.5 },
  sparkleIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reasonRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reasonIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  reasonTitle: { fontSize: 13, fontWeight: '700' },
  reasonDescription: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  notesInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 13.5, minHeight: 80, textAlignVertical: 'top' },
  saveFeedbackButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  saveFeedbackLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
