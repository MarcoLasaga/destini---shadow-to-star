import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';
import { CLOTHING_CATEGORIES } from '../constants/wardrobeMockData';

export default function CategoryFilterBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (value: string) => void;
}) {
  const theme = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CLOTHING_CATEGORIES.map((category) => {
        const isActive = category === active;
        return (
          <Pressable
            key={category}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(category);
            }}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? theme.secondaryAccent : theme.surface,
                borderColor: isActive ? theme.secondaryAccent : theme.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: isActive ? '#FFFFFF' : theme.textMuted }]}>{category}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 8, paddingBottom: 4 },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  label: { fontSize: 13.5, fontWeight: '600' },
});