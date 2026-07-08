import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function HorizontalBarList({ data }: { data: { label: string; value: number }[] }) {
  const theme = useAppTheme();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={{ gap: 12 }}>
      {data.map((item) => (
        <View key={item.label} style={styles.row}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{item.label}</Text>
          <View style={[styles.track, { backgroundColor: theme.border }]}>
            <View
              style={[
                styles.fill,
                { width: `${(item.value / max) * 100}%`, backgroundColor: theme.secondaryAccent },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { width: 46, fontSize: 12, textAlign: 'right' },
  track: { flex: 1, height: 18, borderRadius: 9, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 9 },
});