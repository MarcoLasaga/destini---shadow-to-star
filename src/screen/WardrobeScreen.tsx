import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import CategoryFilterBar from '../components/CategoryFilterBar';
import StatusFilterBar from '../components/StatusFilterBar';
import ClothingCard from '../components/ClothingCard';
import { STATUS_FILTERS } from '../constants/wardrobeMockData';

export default function WardrobeScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { items, toggleFavorite } = useWardrobe();

  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('All');

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = category === 'All' || item.category === category;
      const matchesStatus =
        status === 'All' ||
        (status === 'Clean' && item.status === 'clean') ||
        (status === 'Needs Washing' && item.status === 'needs-washing') ||
        (status === 'Favorites' && item.favorite);
      return matchesCategory && matchesStatus;
    });
  }, [items, category, status]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Wardrobe</Text>
        <View style={styles.headerActions}>
          <Pressable style={[styles.iconButton, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={18} color={theme.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('AddClothes')}
            style={[styles.addButton, { backgroundColor: theme.secondaryAccent }]}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        </View>
      </Animated.View>

      <View style={styles.filters}>
        <CategoryFilterBar active={category} onChange={setCategory} />
        <StatusFilterBar active={status} onChange={setStatus} />
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrap}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <ClothingCard item={item} onToggleFavorite={toggleFavorite} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No items match these filters</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  addLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },
  filters: { gap: 10, marginTop: 10, marginBottom: 4 },
  columnWrap: { paddingHorizontal: 20, gap: 12 },
  gridContent: { paddingTop: 8, paddingBottom: 24 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 13.5 },
});