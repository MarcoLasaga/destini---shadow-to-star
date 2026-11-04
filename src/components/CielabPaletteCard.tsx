import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { normalizeHexCode } from '../services/outfitRecommendationService';

export interface CielabCluster {
  color_name: string;
  hex_code?: string;
  proportion: number;
  lab?: [number, number, number] | Tuple3;
}

type Tuple3 = [number, number, number];

export interface CielabPaletteCardProps {
  palette?: CielabCluster[] | {
    clusters?: CielabCluster[];
    palette?: CielabCluster[];
    dominant_color?: string;
    dominant_hex?: string;
    secondary_color?: string;
    secondary_hex?: string;
  } | null;
  primaryColor?: string;
  primaryHex?: string;
  secondaryColor?: string;
  secondaryHex?: string | null;
  harmonyNote?: string | null;
  compact?: boolean;
  title?: string;
}

export default function CielabPaletteCard({
  palette,
  primaryColor,
  primaryHex,
  secondaryColor,
  secondaryHex,
  harmonyNote,
  compact = false,
  title = 'Outfit Color Palette',
}: CielabPaletteCardProps) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';

  // Normalize clusters array
  let clusters: CielabCluster[] = [];
  if (Array.isArray(palette)) {
    clusters = palette;
  } else if (palette && typeof palette === 'object') {
    if (Array.isArray(palette.clusters)) {
      clusters = palette.clusters;
    } else if (Array.isArray(palette.palette)) {
      clusters = palette.palette;
    }
  }

  // Primary cluster (Cluster 0)
  const c0 = clusters[0];
  const c0Name = c0?.color_name || primaryColor || 'Primary';
  const c0Hex = normalizeHexCode(c0?.hex_code || primaryHex, c0Name);
  const c0Prop = typeof c0?.proportion === 'number' ? Math.round(c0.proportion * 100) : 82;

  // Secondary cluster (Cluster 1, shown if proportion >= 8% or explicitly provided)
  const c1 = clusters[1];
  const c1Prop = typeof c1?.proportion === 'number' ? Math.round(c1.proportion * 100) : null;
  const showSecondary =
    (c1 && typeof c1Prop === 'number' && c1Prop >= 8) ||
    Boolean(secondaryColor && secondaryColor !== primaryColor);
  const c1Name = c1?.color_name || secondaryColor || 'Secondary';
  const c1Hex = normalizeHexCode(c1?.hex_code || secondaryHex, c1Name);
  const finalC1Prop = c1Prop ?? Math.max(12, 100 - c0Prop);

  const cleanedHarmonyNote = harmonyNote
    ? harmonyNote.replace(/CIELAB\s*K\s*=\s*2\s*:?\s*/gi, '').replace(/L\*=\d+/gi, '').trim()
    : '';

  const resolvedHarmonyNote =
    cleanedHarmonyNote ||
    (showSecondary
      ? `Dual-tone palette (${c0Name} ${c0Hex} base with ${c1Name} ${c1Hex} accent)`
      : `Dominant ${c0Name.toLowerCase()} tone (${c0Hex})`);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface || '#FFFFFF',
          borderColor: theme.border || '#E5E7EB',
        },
        compact && styles.containerCompact,
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {title}
        </Text>
      </View>

      {/* Cluster Pills Row with #RRGGBB HEX codes */}
      <View style={styles.pillsRow}>
        {/* Primary Cluster Pill */}
        <View
          style={[
            styles.pill,
            { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
          ]}
        >
          <View
            style={[
              styles.colorSwatch,
              {
                backgroundColor: c0Hex,
                borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)',
              },
            ]}
          />
          <Text style={[styles.pillText, { color: theme.text }]}>
            {c0Name}
          </Text>
          <View
            style={[
              styles.hexCodeBadge,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.hexCodeText, { color: theme.text }]}>{c0Hex}</Text>
          </View>
          <Text style={[styles.propText, { color: theme.textMuted }]}>{c0Prop}%</Text>
        </View>

        {/* Secondary Cluster Pill */}
        {showSecondary && (
          <View
            style={[
              styles.pill,
              { borderColor: theme.border, backgroundColor: theme.surfaceSecondary },
            ]}
          >
            <View
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: c1Hex,
                  borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)',
                },
              ]}
            />
            <Text style={[styles.pillText, { color: theme.text }]}>
              {c1Name}
            </Text>
            <View
              style={[
                styles.hexCodeBadge,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.hexCodeText, { color: theme.text }]}>{c1Hex}</Text>
            </View>
            <Text style={[styles.propText, { color: theme.textMuted }]}>{finalC1Prop}%</Text>
          </View>
        )}
      </View>

      {/* Harmony Note Subtitle */}
      <Text style={[styles.harmonyNoteText, { color: theme.textMuted || '#6B7280' }]} numberOfLines={2}>
        {resolvedHarmonyNote}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  containerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  colorSwatch: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  hexCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  hexCodeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  propText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  harmonyNoteText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
});
