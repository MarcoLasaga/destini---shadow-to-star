import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

export default function StatBox({
  icon,
  value,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  tone?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name={icon} size={17} color={tone ?? theme.secondaryAccent} />
      <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, minWidth: '47%', borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  value: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 12 },
});