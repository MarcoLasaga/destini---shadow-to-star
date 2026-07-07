import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';
import { STATUS_FILTERS } from '../constants/wardrobeMockData';

export default function StatusFilterBar({
  active,
  onChange,
}: {
  active: (typeof STATUS_FILTERS)[number];
  onChange: (value: (typeof STATUS_FILTERS)[number]) => void;
}) {
  const theme = useAppTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {STATUS_FILTERS.map((status) => {
        const isActive = status === active;
        return (
          <Pressable
            key={status}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(status);
            }}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? theme.primaryAccent : theme.surface,
                borderColor: isActive ? theme.primaryAccent : theme.border,
              },
            ]}
          >
            <Text style={[styles.label, { color: isActive ? '#3D2E10' : theme.textMuted }]}>{status}</Text>
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