import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import ScreenHeader from '../components/ScreenHeader';
import StatBox from '../components/StatBox';

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const { items } = useWardrobe();
  const { savedOutfits } = useOutfit();
  const data = useMemo(() => {
    const totalWears = items.reduce((sum, item) => sum + item.timesWorn, 0);
    const value = items.reduce((sum, item) => sum + item.costPerWear * Math.max(item.timesWorn, 1), 0);
    const categories = items.reduce<Record<string, number>>((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + 1 }), {});
    const colors = items.reduce<Record<string, number>>((result, item) => ({ ...result, [item.color || 'Unknown']: (result[item.color || 'Unknown'] || 0) + 1 }), {});
    return { totalWears, value, categories, colors };
  }, [items]);
  return <View style={[styles.container, { backgroundColor: theme.background }]}><ScreenHeader title="Analytics" /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.statsGrid}><StatBox icon="shirt-outline" value={items.length} label="Total Items" /><StatBox icon="heart-outline" value={items.filter((item) => item.favorite).length} label="Favorites" tone="#E5484D" /><StatBox icon="cash-outline" value={`$${data.value.toFixed(2)}`} label="Wardrobe Value" /><StatBox icon="trending-up-outline" value={data.totalWears} label="Total Wears" /><StatBox icon="archive-outline" value={items.filter((item) => item.status !== 'clean').length} label="Needs Washing" tone="#E8833A" /><StatBox icon="sparkles-outline" value={savedOutfits.length} label="Saved Outfits" /></View>
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.title, { color: theme.text }]}>Categories</Text>{Object.keys(data.categories).length === 0 ? <Text style={{ color: theme.textMuted }}>Add clothing to see your wardrobe breakdown.</Text> : Object.entries(data.categories).map(([name, count]) => <View key={name} style={styles.row}><Text style={{ color: theme.text }}>{name}</Text><Text style={{ color: theme.textMuted }}>{count}</Text></View>)}</View>
    <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.title, { color: theme.text }]}>Most common colors</Text>{Object.entries(data.colors).sort(([, a], [, b]) => b - a).slice(0, 6).map(([name, count]) => <View key={name} style={styles.row}><Text style={{ color: theme.text }}>{name}</Text><Text style={{ color: theme.textMuted }}>{count}</Text></View>)}</View>
  </ScrollView></View>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 20, gap: 16, paddingBottom: 40 }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 }, title: { fontSize: 15, fontWeight: '700' }, row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 } });
