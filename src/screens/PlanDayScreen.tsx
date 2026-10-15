import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePlanner } from '../contexts/PlannerContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useToast } from '../contexts/ToastContext';
import { GeneratedOutfit } from '../types';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';

function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PlanDayScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { plans, scheduleOutfit, removePlan, markPlanAsWorn } = usePlanner();
  const { currentOutfits, savedOutfits } = useOutfit();
  const { showToast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(new Date()));
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [conflictOutfit, setConflictOutfit] = useState<GeneratedOutfit | null>(null);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);

  // Generate 7 days of the currently selected week
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday
    // Start of the week (Sunday)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay + weekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const key = formatDateKey(d);
      return {
        date: d,
        key,
        dayName: DAYS_SHORT[d.getDay()],
        dayNumber: d.getDate(),
        monthName: MONTHS_SHORT[d.getMonth()],
        isToday: key === formatDateKey(today),
      };
    });
  }, [weekOffset]);

  const activePlan = plans[selectedDateKey];

  const handleSelectOutfitToPlan = async (outfit: GeneratedOutfit) => {
    const result = await scheduleOutfit(selectedDateKey, outfit, { force: false });

    if (result.conflict) {
      setConflictOutfit(outfit);
    } else {
      setPickerModalVisible(false);
      showToast('Outfit scheduled for ' + selectedDateKey);
    }
  };

  const handleConfirmReplace = async () => {
    if (!conflictOutfit) return;
    await scheduleOutfit(selectedDateKey, conflictOutfit, { force: true });
    setConflictOutfit(null);
    setPickerModalVisible(false);
    showToast('Planned outfit successfully replaced.');
  };

  const handleMarkWorn = async () => {
    if (!activePlan) return;
    await markPlanAsWorn(selectedDateKey);
    showToast('Marked as worn! Wardrobe laundry status updated.');
  };

  const handleRemove = () => {
    setRemoveConfirmVisible(true);
  };

  const handleConfirmRemove = async () => {
    await removePlan(selectedDateKey);
    setRemoveConfirmVisible(false);
    showToast('Outfit removed from calendar.');
  };

  // Available candidate outfits to schedule
  const availableOutfits = useMemo(() => {
    const combined = [...currentOutfits, ...savedOutfits];
    const uniqueMap = new Map<string, GeneratedOutfit>();
    for (const o of combined) {
      if (!uniqueMap.has(o.id)) uniqueMap.set(o.id, o);
    }
    return Array.from(uniqueMap.values());
  }, [currentOutfits, savedOutfits]);

  const selectedDateObj = weekDays.find((d) => d.key === selectedDateKey)?.date ?? new Date();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: theme.surface }]}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.title, { color: theme.text }]}>Weekly Outfit Planner</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Schedule & plan your daily looks
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNavRow}>
        <Pressable
          onPress={() => setWeekOffset((prev) => prev - 1)}
          style={[styles.weekNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
          <Text style={[styles.weekNavText, { color: theme.text }]}>Prev Week</Text>
        </Pressable>

        <Text style={[styles.weekNavTitle, { color: theme.text }]}>
          {weekDays[0].monthName} {weekDays[0].dayNumber} – {weekDays[6].monthName} {weekDays[6].dayNumber}
        </Text>

        <Pressable
          onPress={() => setWeekOffset((prev) => prev + 1)}
          style={[styles.weekNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Text style={[styles.weekNavText, { color: theme.text }]}>Next Week</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.text} />
        </Pressable>
      </View>

      {/* 7-Day Calendar Strip */}
      <View style={styles.calendarStrip}>
        {weekDays.map((d) => {
          const isSelected = d.key === selectedDateKey;
          const hasPlan = !!plans[d.key];
          return (
            <Pressable
              key={d.key}
              onPress={() => setSelectedDateKey(d.key)}
              style={[
                styles.dayPill,
                {
                  backgroundColor: isSelected
                    ? theme.secondaryAccent
                    : d.isToday
                    ? theme.primaryAccent + '40'
                    : theme.surface,
                  borderColor: isSelected ? theme.secondaryAccent : theme.border,
                },
              ]}
            >
              <Text style={[styles.dayPillName, { color: isSelected ? theme.onAccent : theme.textMuted }]}>
                {d.dayName}
              </Text>
              <Text style={[styles.dayPillNumber, { color: isSelected ? theme.onAccent : theme.text }]}>
                {d.dayNumber}
              </Text>
              {hasPlan && (
                <View
                  style={[
                    styles.planDot,
                    { backgroundColor: isSelected ? '#FFD586' : theme.secondaryAccent },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Title Banner */}
        <View style={styles.selectedDateBanner}>
          <Text style={[styles.bannerDateText, { color: theme.text }]}>
            {selectedDateObj.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {activePlan && (
            <View style={[styles.occasionBadge, { backgroundColor: theme.primaryAccent }]}>
              <Text style={styles.occasionBadgeText}>{activePlan.occasion}</Text>
            </View>
          )}
        </View>

        {/* Planned Outfit Details or Empty Placeholder */}
        {activePlan ? (
          <View style={[styles.plannedCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.plannedTitle, { color: theme.text }]}>{activePlan.outfit.name}</Text>
                <Text style={[styles.plannedMatch, { color: theme.secondaryAccent }]}>
                  {activePlan.outfit.hybridScore ?? activePlan.outfit.matchPercent}% Hybrid Match
                </Text>
              </View>
              {activePlan.outfit.worn ? (
                <View style={styles.wornTag}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.onAccent} />
                  <Text style={styles.wornTagText}>Worn</Text>
                </View>
              ) : (
                <View style={[styles.scheduledTag, { backgroundColor: theme.secondaryAccent + '20' }]}>
                  <Text style={[styles.scheduledTagText, { color: theme.secondaryAccent }]}>Scheduled</Text>
                </View>
              )}
            </View>

            {activePlan.outfit.image ? (
              <Image source={{ uri: activePlan.outfit.image }} style={styles.outfitImage} contentFit="cover" />
            ) : null}

            {/* Garment breakdown */}
            <View style={styles.itemsSection}>
              <Text style={[styles.itemsHeading, { color: theme.textMuted }]}>SCHEDULED GARMENTS</Text>
              <View style={styles.itemsList}>
                {activePlan.outfit.clothingItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Image source={{ uri: item.image }} style={styles.itemImg} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.itemCat, { color: theme.textMuted }]}>{item.category}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Actions for Planned Day */}
            <View style={styles.actionsRow}>
              {!activePlan.outfit.worn && (
                <Pressable onPress={handleMarkWorn} style={[styles.actionBtn, { backgroundColor: theme.secondaryAccent }]}>
                  <Ionicons name="checkmark" size={16} color={theme.onAccent} />
                  <Text style={[styles.actionBtnText, { color: theme.onAccent }]}>Mark as Worn</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setPickerModalVisible(true)}
                style={[styles.actionBtnOutline, { borderColor: theme.border }]}
              >
                <Ionicons name="sync-outline" size={15} color={theme.text} />
                <Text style={[styles.actionBtnOutlineText, { color: theme.text }]}>Replace</Text>
              </Pressable>
              <Pressable
                onPress={handleRemove}
                style={[styles.actionBtnOutline, { borderColor: '#E5484D40' }]}
              >
                <Ionicons name="trash-outline" size={15} color="#E5484D" />
                <Text style={[styles.actionBtnOutlineText, { color: '#E5484D' }]}>Clear</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.primaryAccent + '25' }]}>
              <Ionicons name="calendar-outline" size={32} color={theme.secondaryAccent} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Outfit Planned</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Assign an outfit from your recommendations or saved looks to this day.
            </Text>
            <Pressable
              onPress={() => setPickerModalVisible(true)}
              style={[styles.planButton, { backgroundColor: theme.secondaryAccent }]}
            >
              <Ionicons name="add" size={16} color={theme.onAccent} />
              <Text style={[styles.planButtonText, { color: theme.onAccent }]}>Plan Outfit for this Date</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Outfit Selection Sheet */}
      <Modal visible={pickerModalVisible} transparent animationType="slide" onRequestClose={() => setPickerModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.background }]} edges={['bottom']}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Select Outfit to Plan</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
                  Assigning to {selectedDateKey}
                </Text>
              </View>
              <Pressable onPress={() => setPickerModalVisible(false)} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>

            {availableOutfits.length === 0 ? (
              <View style={styles.emptyOutfitsNotice}>
                <Text style={[styles.emptyNoticeText, { color: theme.textMuted }]}>
                  No outfits generated or saved yet. Generate recommendations in the Outfit tab first!
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableOutfits}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.outfitPickList}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelectOutfitToPlan(item)}
                    style={[styles.outfitPickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  >
                    <Image source={{ uri: item.image }} style={styles.pickImage} contentFit="cover" />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.pickName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.pickOccasion, { color: theme.textMuted }]}>
                        {item.occasionLabel} · {item.hybridScore ?? item.matchPercent}% Match
                      </Text>
                      <Text style={[styles.pickItemsCount, { color: theme.secondaryAccent }]}>
                        {item.clothingItems.length} Garments
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Date Outfit Conflict Modal */}
      <ConfirmDialogModal
        visible={!!conflictOutfit}
        variant="danger"
        title="Conflict Detected"
        message="This date already has a planned outfit. Replace it?"
        confirmText="Replace"
        cancelText="Cancel"
        onConfirm={handleConfirmReplace}
        onCancel={() => setConflictOutfit(null)}
      />

      {/* Remove Planned Outfit Modal */}
      <ConfirmDialogModal
        visible={removeConfirmVisible}
        variant="danger"
        title="Remove Planned Outfit"
        message="Are you sure you want to unschedule this outfit from your calendar?"
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 1 },
  weekNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  weekNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  weekNavText: { fontSize: 11.5, fontWeight: '600' },
  weekNavTitle: { fontSize: 13, fontWeight: '700' },
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  dayPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
  },
  dayPillName: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  dayPillNumber: { fontSize: 15, fontWeight: '800' },
  planDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 5,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16, paddingTop: 10 },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  bannerDateText: { fontSize: 16, fontWeight: '800' },
  occasionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  occasionBadgeText: { fontSize: 11.5, fontWeight: '700', color: '#3D2E10' },
  plannedCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plannedTitle: { fontSize: 18, fontWeight: '800' },
  plannedMatch: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  wornTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2F8F5B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  wornTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  scheduledTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  scheduledTagText: { fontSize: 11, fontWeight: '700' },
  outfitImage: { width: '100%', height: 200, borderRadius: 14 },
  itemsSection: { gap: 8 },
  itemsHeading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  itemsList: { gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemImg: { width: 36, height: 36, borderRadius: 8 },
  itemName: { fontSize: 13, fontWeight: '600' },
  itemCat: { fontSize: 11 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnOutlineText: { fontWeight: '700', fontSize: 13 },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 8 },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  planButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  outfitPickList: { gap: 10, paddingBottom: 20 },
  outfitPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  pickImage: { width: 50, height: 50, borderRadius: 10 },
  pickName: { fontSize: 14, fontWeight: '700' },
  pickOccasion: { fontSize: 12 },
  pickItemsCount: { fontSize: 11.5, fontWeight: '600' },
  emptyOutfitsNotice: { padding: 30, alignItems: 'center' },
  emptyNoticeText: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
});

