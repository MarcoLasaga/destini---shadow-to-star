import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useAppTheme } from '../hooks/useAppTheme';
import { analyticsMock } from '../constants/profileMockData';
import ScreenHeader from '../components/ScreenHeader';
import StatBox from '../components/StatBox';
import PieChart from '../components/PieChart';
import HorizontalBarList from '../components/HorizontalBarList';

export default function AnalyticsScreen() {
  const theme = useAppTheme();
  const data = analyticsMock;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Analytics" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <StatBox icon="shirt-outline" value={data.totalItems} label="Total Items" />
          <StatBox icon="heart-outline" value={data.favorites} label="Favorites" tone="#E5484D" />
          <StatBox icon="cash-outline" value={`$${data.wardrobeValue}`} label="Wardrobe Value" />
          <StatBox icon="trending-up-outline" value={data.totalWears} label="Total Wears" />
          <StatBox icon="cash-outline" value={`$${data.avgCostPerWear.toFixed(2)}`} label="Avg Cost/Wear" />
          <StatBox icon="archive-outline" value={data.needsWashing} label="Needs Washing" tone="#E8833A" />
        </View>

        <View style={[styles.sustainabilityCard, { backgroundColor: theme.mode === 'dark' ? '#1E2B22' : '#DCF0E3' }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.leafIcon}>🌱</Text>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Sustainability</Text>
          </View>
          <View style={styles.sustainabilityRow}>
            <View style={styles.sustainabilityBlock}>
              <Text style={styles.sustainabilityValue}>{data.sustainability.score}</Text>
              <Text style={[styles.sustainabilityLabel, { color: theme.textMuted }]}>Score /100</Text>
            </View>
            <View style={styles.sustainabilityBlock}>
              <Text style={styles.sustainabilityValue}>{data.sustainability.co2Reduced.toFixed(1)}kg</Text>
              <Text style={[styles.sustainabilityLabel, { color: theme.textMuted }]}>CO₂ Reduced</Text>
            </View>
            <View style={styles.sustainabilityBlock}>
              <Text style={styles.sustainabilityValue}>${data.sustainability.moneySaved}</Text>
              <Text style={[styles.sustainabilityLabel, { color: theme.textMuted }]}>Money Saved</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Categories</Text>
          <PieChart data={data.categories.map((c) => ({ label: c.label, value: c.value, color: c.color }))} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Colors</Text>
          <HorizontalBarList data={data.topColors} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Most Worn</Text>
          {data.mostWorn.map((item, index) => (
            <View key={item.name} style={styles.mostWornRow}>
              <Text style={[styles.rank, { color: theme.textMuted }]}>{index + 1}</Text>
              <Image source={{ uri: item.image }} style={styles.mostWornImage} />
              <Text style={[styles.mostWornName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.mostWornWears, { color: theme.textMuted }]}>{item.wears}×</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Outfit Generation</Text>
          <Text style={[styles.outfitCount, { color: theme.secondaryAccent }]}>{data.outfitsGenerated}</Text>
          <Text style={[styles.outfitLabel, { color: theme.textMuted }]}>outfits generated</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sustainabilityCard: { borderRadius: 18, padding: 16, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leafIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  sustainabilityRow: { flexDirection: 'row' },
  sustainabilityBlock: { flex: 1, alignItems: 'center', gap: 2 },
  sustainabilityValue: { fontSize: 17, fontWeight: '800', color: '#2F8F5B' },
  sustainabilityLabel: { fontSize: 11.5 },
  section: { borderRadius: 18, borderWidth: 1, padding: 16 },
  mostWornRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rank: { width: 16, fontSize: 13, fontWeight: '700' },
  mostWornImage: { width: 34, height: 34, borderRadius: 17 },
  mostWornName: { flex: 1, fontSize: 13.5, fontWeight: '600' },
  mostWornWears: { fontSize: 12.5 },
  outfitCount: { fontSize: 26, fontWeight: '800' },
  outfitLabel: { fontSize: 12.5 },
});