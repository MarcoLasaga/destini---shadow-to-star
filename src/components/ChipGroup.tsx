import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const isActive = selected.includes(option);
          return (
            <Pressable
              key={option}
              onPress={() => onToggle(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.secondaryAccent : theme.surface,
                  borderColor: isActive ? theme.secondaryAccent : theme.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: isActive ? '#FFFFFF' : theme.textMuted }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { fontSize: 13.5, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontWeight: '600' },
});