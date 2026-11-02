import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

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
}

export default function CielabPaletteCard({
  palette,
  primaryColor,
  primaryHex,
  secondaryColor,
  secondaryHex,
  harmonyNote,
  compact = false,
}: CielabPaletteCardProps) {
  const theme = useAppTheme();

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
  const c0Hex = c0?.hex_code || primaryHex || '#364536';
  const c0Name = c0?.color_name || primaryColor || 'Primary';
  const c0Prop = typeof c0?.proportion === 'number' ? Math.round(c0.proportion * 100) : 82;

  // Secondary cluster (Cluster 1, shown if proportion >= 8% or explicitly provided)
  const c1 = clusters[1];
  const c1Prop = typeof c1?.proportion === 'number' ? Math.round(c1.proportion * 100) : null;
  const showSecondary =
    (c1 && typeof c1Prop === 'number' && c1Prop >= 8) ||
    Boolean(secondaryColor && secondaryColor !== primaryColor);
  const c1Hex = c1?.hex_code || secondaryHex || '#E5E7EB';
  const c1Name = c1?.color_name || secondaryColor || 'Secondary';
  const finalC1Prop = c1Prop ?? Math.max(12, 100 - c0Prop);

  const cleanedHarmonyNote = harmonyNote
    ? harmonyNote.replace(/CIELAB\s*K\s*=\s*2\s*:?\s*/gi, '').replace(/L\*=\d+/gi, '').trim()
    : '';

  const resolvedHarmonyNote =
    cleanedHarmonyNote ||
    (showSecondary
      ? `Dual-tone palette (${c0Name} base with ${c1Name} accent)`
      : `Dominant ${c0Name.toLowerCase()} tone`);

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
          Detected Color Palette
        </Text>
      </View>

      {/* Cluster Pills Row */}
      <View style={styles.pillsRow}>
        {/* Primary Cluster Pill */}
        <View style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <View
            style={[
              styles.colorSwatch,
              {
                backgroundColor: c0Hex,
                borderColor: c0Hex.toUpperCase() === '#FFFFFF' ? '#CBD5E1' : 'transparent',
              },
            ]}
          />
          <Text style={[styles.pillText, { color: theme.text }]}>
            {c0Name} · {c0Prop}%
          </Text>
        </View>

        {/* Secondary Cluster Pill */}
        {showSecondary && (
          <View style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <View
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: c1Hex,
                  borderColor: c1Hex.toUpperCase() === '#FFFFFF' ? '#CBD5E1' : 'transparent',
                },
              ]}
            />
            <Text style={[styles.pillText, { color: theme.text }]}>
              {c1Name} · {finalC1Prop}%
            </Text>
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
    gap: 6,
    marginBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  colorSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  harmonyNoteText: {
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
});
