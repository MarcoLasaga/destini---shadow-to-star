import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { GeneratedOutfit } from '../types';

export default function OutfitRecommendationStatsBar({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();

  const stats = [
    { value: `${outfit.matchPercent}%`, label: 'Match' },
    { value: outfit.weatherTempF < 65 ? 'Cool' : outfit.weatherTempF > 82 ? 'Warm' : 'Excellent', label: 'Weather' },
    { value: outfit.occasionLabel, label: 'Style' },
    { value: `${outfit.sustainPercent}%`, label: 'Sustain' },
    { value: outfit.sustainPercent > 80 ? 'High' : 'Moderate', label: 'Reuse' },
  ];

  return (
    <View style={[styles.card, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#FBEFD2', borderColor: theme.border }]}>
      <View style={styles.header}>
        <Ionicons name="bar-chart-outline" size={16} color={theme.text} />
        <Text style={[styles.title, { color: theme.text }]}>Recommendation Stats</Text>
      </View>
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statBlock}>
            <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14.5, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBlock: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: { fontSize: 13, fontWeight: '800' },
  statLabel: { fontSize: 10.5 },
});