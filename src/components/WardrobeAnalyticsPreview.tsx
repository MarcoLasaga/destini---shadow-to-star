import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';

export default function WardrobeAnalyticsPreview() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(260)} style={styles.wrapper}>
      <Pressable
        onPress={() => navigation.navigate('Analytics')}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F1EFEA', opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: theme.surface }]}>
          <Ionicons name="bar-chart-outline" size={20} color={theme.text} />
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: theme.text }]}>Wardrobe Analytics</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            See your clothing habits & sustainability
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, marginTop: 16, marginBottom: 24 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  textBlock: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 2 },
});