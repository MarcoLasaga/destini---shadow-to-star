import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePacking } from '../contexts/PackingContext';
import ScreenHeader from '../components/ScreenHeader';
import NewTripModal from '../components/NewTripModal';

function formatShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PackingScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { trips } = usePacking();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Packing"
        rightElement={
          <Pressable onPress={() => setModalVisible(true)} style={[styles.newTripButton, { backgroundColor: theme.secondaryAccent }]}>
            <Ionicons name="add" size={15} color="#FFFFFF" />
            <Text style={styles.newTripLabel}>New Trip</Text>
          </Pressable>
        }
      />

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="airplane-outline" size={30} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No trips yet — tap New Trip to start packing</Text>
          </View>
        }
        renderItem={({ item }) => {
          const packedCount = item.checklist.filter((i) => i.checked).length;
          return (
            <Pressable
              onPress={() => navigation.navigate('PackingTripDetail', { tripId: item.id })}
              style={[styles.tripCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.tripHeaderRow}>
                <Ionicons name="location" size={15} color={theme.secondaryAccent} />
                <Text style={[styles.tripDestination, { color: theme.text }]}>{item.destination}</Text>
              </View>
              <Text style={[styles.tripDates, { color: theme.textMuted }]}>
                {formatShort(item.startDate)} — {formatShort(item.endDate)}
              </Text>
              <Text style={[styles.tripProgress, { color: theme.textMuted }]}>
                {packedCount} / {item.checklist.length} packed
              </Text>
            </Pressable>
          );
        }}
      />

      <NewTripModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newTripButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  newTripLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 30 },
  tripCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 4 },
  tripHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripDestination: { fontSize: 15, fontWeight: '700' },
  tripDates: { fontSize: 12.5 },
  tripProgress: { fontSize: 12.5, marginTop: 2 },
});