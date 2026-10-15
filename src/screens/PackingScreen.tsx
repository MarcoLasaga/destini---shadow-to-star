import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePacking } from '../contexts/PackingContext';
import ScreenHeader from '../components/ScreenHeader';
import NewTripModal from '../components/NewTripModal';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
import { PackingTrip } from '../types';

function formatShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function PackingScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { trips, deleteTrip } = usePacking();
  const [modalVisible, setModalVisible] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<PackingTrip | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Packing Assistant"
        rightElement={
          <Pressable onPress={() => setModalVisible(true)} style={[styles.newTripButton, { backgroundColor: theme.secondaryAccent }]}>
            <Ionicons name="add" size={15} color={theme.onAccent} />
            <Text style={[styles.newTripLabel, { color: theme.onAccent }]}>New Trip</Text>
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
            <Ionicons name="briefcase-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No trips planned yet</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Tap New Trip to generate a tailored packing checklist from your clean wardrobe garments.
            </Text>
            <Pressable
              onPress={() => setModalVisible(true)}
              style={[styles.emptyCta, { backgroundColor: theme.secondaryAccent }]}
            >
              <Text style={[styles.emptyCtaText, { color: theme.onAccent }]}>Start Packing a Trip</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const packedCount = item.checklist.filter((i) => i.checked).length;
          const total = item.checklist.length;
          const percent = total > 0 ? Math.round((packedCount / total) * 100) : 0;
          return (
            <Pressable
              onPress={() => navigation.navigate('PackingTripDetail', { tripId: item.id })}
              style={[styles.tripCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.tripHeaderRow}>
                <View style={styles.destWrap}>
                  <Ionicons name="location" size={16} color={theme.secondaryAccent} />
                  <Text style={[styles.tripDestination, { color: theme.text }]}>{item.destination}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.percentBadge, { backgroundColor: percent === 100 ? '#2F8F5B20' : theme.secondaryAccent + '20' }]}>
                    <Text style={[styles.percentText, { color: percent === 100 ? '#2F8F5B' : theme.secondaryAccent }]}>
                      {percent}% Packed
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => setTripToDelete(item)}
                    style={{ padding: 2 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#E5484D" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.badgesRow}>
                {item.occasion && (
                  <View style={[styles.badgePill, { backgroundColor: theme.primaryAccent }]}>
                    <Text style={styles.badgePillText}>{item.occasion}</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: item.packingMode === 'heavy' ? '#756E9E20' : '#2F8F5B20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgePillText,
                      { color: item.packingMode === 'heavy' ? theme.secondaryAccent : '#2F8F5B' },
                    ]}
                  >
                    {item.packingMode === 'heavy' ? 'Heavy Mode' : 'Light Capsule'}
                  </Text>
                </View>
                {item.tripDays && (
                  <View style={[styles.badgePill, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}>
                    <Text style={[styles.badgePillText, { color: theme.text }]}>{item.tripDays} Days</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.tripDates, { color: theme.textMuted }]}>
                {formatShort(item.startDate)} — {formatShort(item.endDate)}
              </Text>

              <Text style={[styles.tripProgress, { color: theme.textMuted }]}>
                {packedCount} / {total} items checked
              </Text>
            </Pressable>
          );
        }}
      />

      <NewTripModal visible={modalVisible} onClose={() => setModalVisible(false)} />

      {/* Delete Trip Confirmation Dialog */}
      <ConfirmDialogModal
        visible={!!tripToDelete}
        variant="danger"
        title="Delete Trip Checklist"
        message={tripToDelete ? `Are you sure you want to delete the packing checklist for "${tripToDelete.destination}"? This cannot be undone.` : ''}
        confirmText="Delete Trip"
        cancelText="Cancel"
        onConfirm={async () => {
          if (!tripToDelete) return;
          await deleteTrip(tripToDelete.id);
          setTripToDelete(null);
        }}
        onCancel={() => setTripToDelete(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newTripButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  newTripLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 12.5 },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyCta: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  emptyCtaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  tripCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tripHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  destWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripDestination: { fontSize: 16, fontWeight: '700' },
  percentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  percentText: { fontSize: 11, fontWeight: '700' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 2 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgePillText: { fontSize: 10.5, fontWeight: '700' },
  tripDates: { fontSize: 12.5 },
  tripProgress: { fontSize: 12, marginTop: 2 },
});