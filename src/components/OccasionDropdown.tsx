import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { OCCASION_OPTIONS } from '../constants/outfitMockData';

export default function OccasionDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.background }]}
      >
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        <Ionicons name="chevron-down" size={17} color={theme.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>What's the occasion?</Text>
            <FlatList
              data={OCCASION_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isActive = item === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[styles.option, isActive && { backgroundColor: theme.primaryAccent }]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isActive ? '#3D2E10' : theme.text, fontWeight: isActive ? '700' : '400' },
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  value: { fontSize: 14.5, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '65%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  option: { paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4 },
  optionText: { fontSize: 15 },
});