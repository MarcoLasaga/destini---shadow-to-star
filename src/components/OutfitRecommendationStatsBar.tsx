import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { GeneratedOutfit } from '../types';

export default function OutfitRecommendationStatsBar({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();

  const baseScore = outfit.hybridScore ?? outfit.matchPercent;
  const content = outfit.contentScore ?? Math.min(99, Math.round(baseScore * 0.95));
  const collaborative = outfit.collaborativeScore ?? Math.min(99, Math.round(baseScore * 1.02));
  const hybrid = Math.round(0.55 * content + 0.45 * collaborative);

  const stats = [
    { value: `${hybrid}%`, label: 'Hybrid Score', highlight: true },
    { value: `${content}%`, label: 'Content', highlight: false },
    { value: `${collaborative}%`, label: 'Collab', highlight: false },
    { value: `${outfit.sustainPercent}%`, label: 'Reuse', highlight: false },
  ];

  const isDark = theme.mode === 'dark';
  const accentColor = isDark ? '#FBF5A7' : '#24152C';

  return (
    <View style={[styles.card, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#FBEFD2', borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Ionicons name="analytics-outline" size={16} color={accentColor} />
          <Text style={[styles.title, { color: theme.text }]}>Hybrid Recommendation Breakdown</Text>
        </View>
        <Text style={[styles.badgeText, { color: accentColor }]}>Top-3 Outfit</Text>
      </View>
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[
              styles.statBlock,
              stat.highlight && { backgroundColor: isDark ? '#FBF5A718' : '#24152C12', borderRadius: 10, paddingVertical: 4 },
            ]}
          >
            <Text
              style={[
                styles.statValue,
                { color: stat.highlight ? accentColor : theme.text },
              ]}
              numberOfLines={1}
            >
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
  card: { borderRadius: 16, padding: 14, gap: 10, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 13.5, fontWeight: '700' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statBlock: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10.5, fontWeight: '600' },
});
