import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';

export default function SelectField({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: theme.text }]}>
        {label} {required && <Text style={{ color: '#E5484D' }}>*</Text>}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surface }]}
      >
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  style={styles.option}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: item === value ? theme.secondaryAccent : theme.text,
                        fontWeight: item === value ? '700' : '400',
                      },
                    ]}
                  >
                    {item}
                  </Text>
                  {item === value && <Ionicons name="checkmark" size={18} color={theme.secondaryAccent} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, gap: 6 },
  label: { fontSize: 13.5, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  value: { fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '60%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  option: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  optionText: { fontSize: 15 },
});