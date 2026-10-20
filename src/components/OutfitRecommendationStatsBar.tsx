import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { GeneratedOutfit } from '../types';

export default function OutfitRecommendationStatsBar({ outfit }: { outfit: GeneratedOutfit }) {
  const theme = useAppTheme();

  const baseScore = outfit.hybridScore ?? outfit.matchPercent;
  const colorHarmony = outfit.contentScore ?? Math.min(99, Math.round(baseScore * 0.96));
  const creativity = outfit.collaborativeScore ?? Math.min(99, Math.round(baseScore * 0.94));
  const styleMatch = Math.round(0.55 * colorHarmony + 0.45 * creativity);

  const stats = [
    { value: `${styleMatch}%`, label: 'Style Match', highlight: true },
    { value: `${colorHarmony}%`, label: 'Color Harmony', highlight: false },
    { value: `${creativity}%`, label: 'Creativity', highlight: false },
  ];

  const isDark = theme.mode === 'dark';
  const accentColor = theme.accentText;

  return (
    <View style={[styles.card, { backgroundColor: theme.aiBannerBg, borderColor: theme.aiBannerBorder }]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Ionicons name="sparkles-outline" size={16} color={accentColor} />
          <Text style={[styles.title, { color: theme.aiBannerText }]}>Making Sense of Your Style</Text>
        </View>
        <Text style={[styles.badgeText, { color: accentColor }]}>Top-3 Look</Text>
      </View>
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[
              styles.statBlock,
              stat.highlight && {
                backgroundColor: isDark ? '#FBF5A718' : '#24152C12',
                borderRadius: 10,
                paddingVertical: 4,
              },
            ]}
          >
            <Text
              style={[
                styles.statValue,
                { color: stat.highlight ? accentColor : theme.aiBannerText },
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
