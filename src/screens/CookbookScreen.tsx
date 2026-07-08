import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { cookbookMock } from '../constants/profileMockData';
import ScreenHeader from '../components/ScreenHeader';

export default function CookbookScreen() {
  const theme = useAppTheme();
  const data = cookbookMock;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Cookbook" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag-outline" size={17} color="#E8833A" />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Wardrobe Gaps</Text>
          </View>
          {data.wardrobeGaps.map((gap) => (
            <View key={gap} style={[styles.gapRow, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
              <Ionicons name="warning-outline" size={15} color="#E8833A" />
              <Text style={[styles.gapText, { color: theme.text }]}>{gap}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb-outline" size={17} color={theme.secondaryAccent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Suggestions</Text>
          </View>
          {data.suggestions.map((s) => (
            <View key={s} style={[styles.gapRow, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
              <Ionicons name="shirt-outline" size={15} color="#5A7FC1" />
              <Text style={[styles.gapText, { color: theme.text }]}>{s}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tipsHeader}>
          <Ionicons name="leaf-outline" size={17} color="#2F8F5B" />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Sustainability Tips</Text>
        </View>

        {data.sustainabilityTips.map((tip) => (
          <View key={tip.title} style={[styles.tipCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.tipIcon, { backgroundColor: theme.mode === 'dark' ? '#2A2A31' : '#F4F1EA' }]}>
              <Ionicons name={tip.icon} size={17} color={theme.secondaryAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tipTitle, { color: theme.text }]}>{tip.title}</Text>
              <Text style={[styles.tipBody, { color: theme.textMuted }]}>{tip.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12 },
  gapText: { fontSize: 13, flex: 1 },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  tipIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14, fontWeight: '700' },
  tipBody: { fontSize: 12.5, marginTop: 2 },
});