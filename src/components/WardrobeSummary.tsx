import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { WardrobeStats } from '../types';

export default function WardrobeSummary({ stats }: { stats: WardrobeStats }) {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();

  const items = [
    { icon: 'shirt-outline' as const, value: stats.items, label: 'Items' },
    { icon: 'heart-outline' as const, value: stats.favorites, label: 'Favorites' },
    { icon: 'archive-outline' as const, value: stats.toWash, label: 'To Wash' },
  ];

  return (
    <Animated.View
      entering={FadeInDown.duration(450).delay(200)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Wardrobe Summary</Text>
        <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Wardrobe' })} style={styles.viewAll}>
          <Text style={[styles.viewAllText, { color: theme.secondaryAccent }]}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.secondaryAccent} />
        </Pressable>
      </View>

      <View style={[styles.statsRow, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
        {items.map((item) => (
          <View key={item.label} style={styles.statBlock}>
            <Ionicons name={item.icon} size={18} color={theme.secondaryAccent} />
            <Text style={[styles.statValue, { color: theme.text }]}>{item.value}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 22, borderRadius: 20, borderWidth: 1, padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', borderRadius: 14, paddingVertical: 14 },
  statBlock: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statLabel: { fontSize: 12 },
});