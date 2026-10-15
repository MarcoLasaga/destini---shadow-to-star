import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.border, true: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' }}
        thumbColor={theme.mode === 'dark' ? '#24152C' : '#FBF5A7'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 14 },
});