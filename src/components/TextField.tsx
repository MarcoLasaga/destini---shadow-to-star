import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

interface TextFieldProps extends TextInputProps {
  label: string;
}

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  ...props
}: TextFieldProps) {
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
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, gap: 6 },
  label: { fontSize: 13.5, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
});