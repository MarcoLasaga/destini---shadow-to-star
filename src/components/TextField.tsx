import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, gap: 6 },
  label: { fontSize: 13.5, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
});