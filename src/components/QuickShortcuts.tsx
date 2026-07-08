import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';

const SHORTCUTS = [
  { key: 'AddClothes', label: 'Add Clothes', icon: 'add', bg: '#FFE7BE', fg: '#C9852B' },
  { key: 'GenerateOutfit', label: 'Generate Outfit', icon: 'sparkles', bg: '#E3DEF2', fg: '#756E9E' },
  { key: 'PlanDay', label: 'Plan Day', icon: 'calendar', bg: '#D8EEE4', fg: '#3F9C77' },
  { key: 'Packing', label: 'Pack Trip', icon: 'briefcase', bg: '#F7DAD6', fg: '#D4674F' },
] as const;

export default function QuickShortcuts() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(140)} style={styles.row}>
      {SHORTCUTS.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(item.key);
          }}
          style={({ pressed }) => [styles.item, { opacity: pressed ? 0.75 : 1 }]}
        >
          <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
            <Ionicons name={item.icon as any} size={22} color={item.fg} />
          </View>
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 22 },
  item: { alignItems: 'center', width: 74 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  label: { fontSize: 11.5, textAlign: 'center', fontWeight: '500' },
});