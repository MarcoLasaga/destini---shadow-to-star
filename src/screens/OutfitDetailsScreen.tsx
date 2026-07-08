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

const { width } = Dimensions.get('window');

export default function OutfitDetailsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'OutfitDetails'>>();
  const { getOutfit, toggleFavorite, markAsWorn, submitWearFeedback } = useOutfit();

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

  const handleSaveFeedback = () => {
    submitWearFeedback(outfit.id, wearRating, wearNotes);
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
        <Pressable onPress={() => toggleFavorite(outfit.id)} style={[styles.circleButton, { backgroundColor: theme.surface }]}>
          <Ionicons name={outfit.favorited ? 'heart' : 'heart-outline'} size={19} color={outfit.favorited ? '#E5484D' : theme.text} />
        </Pressable>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: outfit.image }} style={styles.image} contentFit="cover" transition={250} />
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="sparkles-outline" size={17} color={theme.secondaryAccent} />
              <Text style={[styles.statValue, { color: theme.text }]}>{outfit.matchPercent}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Match Score</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="leaf-outline" size={17} color="#2F8F5B" />
              <Text style={[styles.statValue, { color: theme.text }]}>{outfit.sustainPercent}%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Sustainability</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="thermometer-outline" size={17} color="#E8833A" />
              <Text style={[styles.statValue, { color: theme.text }]}>{outfit.comfortRating}/5</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Comfort</Text>
            </View>
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
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Weather</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {outfit.weatherCondition} · {outfit.weatherTempF}°F
              </Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.infoLabelRow}>
                <Ionicons name="sparkles-outline" size={14} color={theme.textMuted} />
                <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Style</Text>
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

          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="color-palette-outline" size={16} color={theme.secondaryAccent} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Color Palette</Text>
            </View>
            <View style={styles.paletteRow}>
              {outfit.colorPalette.map((color) => (
                <View key={color.name} style={styles.paletteItem}>
                  <View style={[styles.swatch, { backgroundColor: color.hex, borderColor: theme.border }]} />
                  <Text style={[styles.swatchLabel, { color: theme.textMuted }]}>{color.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Clothing Breakdown</Text>
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

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => markAsWorn(outfit.id)}
              style={[
                styles.markWornButton,
                { backgroundColor: outfit.worn ? theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' : theme.secondaryAccent },
              ]}
            >
              <Ionicons name="checkmark" size={16} color={outfit.worn ? theme.text : '#FFFFFF'} />
              <Text style={[styles.markWornLabel, { color: outfit.worn ? theme.text : '#FFFFFF' }]}>
                {outfit.worn ? 'Marked as Worn' : 'Mark as Worn'}
              </Text>
            </Pressable>
            <Pressable style={[styles.shareButton, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Ionicons name="share-social-outline" size={16} color={theme.text} />
              <Text style={[styles.shareLabel, { color: theme.text }]}>Share</Text>
            </Pressable>
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sparkleIcon, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
                <Ionicons name="sparkles" size={14} color={theme.secondaryAccent} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Why was this outfit recommended?</Text>
            </View>
            {outfit.whyReasons.map((reason) => (
              <View key={reason.title} style={styles.reasonRow}>
                <View style={[styles.reasonIcon, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
                  <Ionicons name={reason.icon as any} size={15} color={theme.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reasonTitle, { color: theme.text }]}>{reason.title}</Text>
                  <Text style={[styles.reasonDescription, { color: theme.textMuted }]}>{reason.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>User Feedback</Text>
            <Text style={[styles.sampleDataLabel, { color: theme.textMuted }]}>Sample data</Text>
            {outfit.feedback.map((review) => (
              <View key={review.id} style={styles.feedbackRow}>
                <StarRating rating={review.stars} size={14} />
                <Text style={[styles.feedbackQuote, { color: theme.textMuted }]}>"{review.quote}"</Text>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Fit Score & Wear Notes</Text>
            <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 8 }]}>How did this outfit feel?</Text>
            <StarRating rating={wearRating} size={24} editable onChange={setWearRating} />

            <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>Wear notes</Text>
            <TextInput
              value={wearNotes}
              onChangeText={setWearNotes}
              placeholder="How did this outfit feel throughout the day?"
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
  imageWrap: { width, height: width * 0.85 },
  image: { width: '100%', height: '100%' },
  body: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: { flex: 1, borderRadius: 16, borderWidth: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 10.5, textAlign: 'center' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoBox: { width: '47.5%', borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel: { fontSize: 11.5 },
  infoValue: { fontSize: 13.5, fontWeight: '700' },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  paletteRow: { flexDirection: 'row', gap: 20 },
  paletteItem: { alignItems: 'center', gap: 6 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1 },
  swatchLabel: { fontSize: 11.5 },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  breakdownTile: { width: '47%', gap: 4 },
  breakdownImage: { width: '100%', aspectRatio: 1, borderRadius: 14 },
  breakdownName: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  breakdownCategory: { fontSize: 11.5 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  markWornButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  markWornLabel: { fontWeight: '700', fontSize: 14 },
  shareButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  shareLabel: { fontWeight: '700', fontSize: 14 },
  sparkleIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reasonRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reasonIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  reasonTitle: { fontSize: 13.5, fontWeight: '700' },
  reasonDescription: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  sampleDataLabel: { fontSize: 11.5, marginTop: -8 },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackQuote: { fontSize: 12.5, fontStyle: 'italic', flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  notesInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 13.5, minHeight: 80, textAlignVertical: 'top' },
  saveFeedbackButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  saveFeedbackLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});