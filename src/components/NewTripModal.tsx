import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, TextInput, StyleSheet, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePacking } from '../contexts/PackingContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { searchDestinations, GeocodeResult } from '../services/geocodingService';
import { fetchWeatherByCoords } from '../services/weatherService';
import { daysBetween } from '../utils/packingChecklist';

const OCCASIONS = ['Academic', 'Office', 'Formal', 'Casual', 'Workout'] as const;

export default function NewTripModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { addTrip } = usePacking();
  const { items } = useWardrobe();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const [selectedOccasion, setSelectedOccasion] = useState<string>('Casual');
  const [packingMode, setPackingMode] = useState<'light' | 'heavy'>('light');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanItems = useMemo(() => items.filter((i) => (i.status || '').toLowerCase() === 'clean'), [items]);
  const tripDays = useMemo(() => daysBetween(startDate.toISOString(), endDate.toISOString()), [startDate, endDate]);

  const handleQueryChange = async (text: string) => {
    setQuery(text);
    setSelected(null);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const found = await searchDestinations(text);
    setResults(found);
    setSearching(false);
  };

  const handleSelectDestination = (result: GeocodeResult) => {
    setSelected(result);
    setQuery(result.displayName.split(',')[0]);
    setResults([]);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleStartChange = (_: any, date?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (!date) return;
    if (date < today) {
      setDateError('Travel dates cannot be in the past.');
      return;
    }
    setDateError(null);
    setStartDate(date);
    if (endDate < date) setEndDate(date);
  };

  const handleEndChange = (_: any, date?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (!date) return;
    if (date < startDate) {
      setDateError('End date must be on or after the start date.');
      return;
    }
    setDateError(null);
    setEndDate(date);
  };

  const handleCreate = async () => {
    if (!selected && !query.trim()) {
      setDateError('Please enter or select a destination.');
      return;
    }
    setLoading(true);
    try {
      const destinationName = selected ? selected.displayName.split(',')[0] : query.trim();
      const lat = selected ? selected.lat : 14.5995;
      const lon = selected ? selected.lon : 120.9842;

      let avgTempF: number | undefined;
      let weatherCondition: string | undefined;
      try {
        const weather = await fetchWeatherByCoords(lat, lon, destinationName);
        avgTempF = weather.tempF;
        weatherCondition = weather.condition;
      } catch {
        avgTempF = undefined;
      }

      const tripId = await addTrip({
        destination: destinationName,
        lat,
        lon,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        occasion: selectedOccasion,
        packingMode,
        cleanWardrobeItems: cleanItems,
        avgTempF,
        weatherCondition,
      });

      resetForm();
      onClose();
      navigation.navigate('PackingTripDetail', { tripId });
    } catch (err) {
      console.error('Error creating trip', err);
      setDateError('Could not generate packing checklist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setSelectedOccasion('Casual');
    setPackingMode('light');
    setDateError(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]} edges={['bottom']}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>New Trip Assistant</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Generates a checklist from your clean wardrobe
              </Text>
            </View>
            <Pressable
              onPress={() => {
                resetForm();
                onClose();
              }}
              style={[styles.closeButton, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Destination Search */}
            <View style={styles.fieldSection}>
              <Text style={[styles.label, { color: theme.text }]}>Destination</Text>
              <TextInput
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Search a city (e.g. Tokyo, Baguio, Cebu)..."
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
              />

              {results.length > 0 && (
                <View style={[styles.suggestions, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {results.slice(0, 6).map((item, index) => (
                    <Pressable
                      key={`${item.lat}-${item.lon}-${index}`}
                      onPress={() => handleSelectDestination(item)}
                      style={[
                        styles.suggestionRow,
                        index < Math.min(results.length, 6) - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border } : null,
                      ]}
                    >
                      <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                      <Text style={[styles.suggestionText, { color: theme.text }]} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Travel Dates & Trip Days */}
            <View style={styles.fieldSection}>
              <View style={styles.dateHeaderRow}>
                <Text style={[styles.label, { color: theme.text }]}>Travel Dates</Text>
                <View style={[styles.daysBadge, { backgroundColor: theme.primaryAccent }]}>
                  <Text style={styles.daysBadgeText}>
                    {tripDays} {tripDays === 1 ? 'Trip Day' : 'Trip Days'}
                  </Text>
                </View>
              </View>

              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subLabel, { color: theme.textMuted }]}>Depart</Text>
                  <Pressable
                    onPress={() => setShowStartPicker(true)}
                    style={[styles.dateButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  >
                    <Ionicons name="calendar-outline" size={15} color={theme.accent} />
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                      {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                </View>

                <View style={{ width: 10 }} />

                <View style={{ flex: 1 }}>
                  <Text style={[styles.subLabel, { color: theme.textMuted }]}>Return</Text>
                  <Pressable
                    onPress={() => setShowEndPicker(true)}
                    style={[styles.dateButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  >
                    <Ionicons name="calendar-outline" size={15} color={theme.accent} />
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                      {endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {showStartPicker && (
                <DateTimePicker value={startDate} mode="date" minimumDate={today} onChange={handleStartChange} />
              )}
              {showEndPicker && (
                <DateTimePicker value={endDate} mode="date" minimumDate={startDate} onChange={handleEndChange} />
              )}
            </View>

            {/* Occasion Selection */}
            <View style={styles.fieldSection}>
              <Text style={[styles.label, { color: theme.text }]}>Trip Occasion</Text>
              <View style={styles.optionsWrap}>
                {OCCASIONS.map((occ) => {
                  const isSelected = selectedOccasion === occ;
                  return (
                    <Pressable
                      key={occ}
                      onPress={() => setSelectedOccasion(occ)}
                      style={[
                        styles.optionPill,
                        {
                          backgroundColor: isSelected ? theme.secondaryAccent : theme.surface,
                          borderColor: isSelected ? theme.secondaryAccent : theme.border,
                        },
                      ]}
                    >
                      <Text style={[styles.optionPillText, { color: isSelected ? theme.onAccent : theme.text }]}>
                        {occ}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Light vs. Heavy Packing Mode */}
            <View style={styles.fieldSection}>
              <Text style={[styles.label, { color: theme.text }]}>Packing Mode</Text>
              <View style={styles.modeToggleRow}>
                <Pressable
                  onPress={() => setPackingMode('light')}
                  style={[
                    styles.modeChoiceCard,
                    {
                      borderColor: packingMode === 'light' ? theme.activeCardBorder : theme.border,
                      backgroundColor: packingMode === 'light' ? theme.activeCardBg : theme.surface,
                    },
                  ]}
                >
                  <View style={styles.modeChoiceHeader}>
                    <Ionicons
                      name="leaf-outline"
                      size={18}
                      color={packingMode === 'light' ? theme.accent : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.modeChoiceTitle,
                        { color: packingMode === 'light' ? theme.text : theme.text },
                      ]}
                    >
                      Light Mode
                    </Text>
                  </View>
                  <Text style={[styles.modeChoiceDesc, { color: theme.textMuted }]}>
                    Minimalist capsule, high re-wear ratio, carry-on friendly.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setPackingMode('heavy')}
                  style={[
                    styles.modeChoiceCard,
                    {
                      borderColor: packingMode === 'heavy' ? theme.activeCardBorder : theme.border,
                      backgroundColor: packingMode === 'heavy' ? theme.activeCardBg : theme.surface,
                    },
                  ]}
                >
                  <View style={styles.modeChoiceHeader}>
                    <Ionicons
                      name="briefcase-outline"
                      size={18}
                      color={packingMode === 'heavy' ? theme.accent : theme.textMuted}
                    />
                    <Text
                      style={[
                        styles.modeChoiceTitle,
                        { color: packingMode === 'heavy' ? theme.text : theme.text },
                      ]}
                    >
                      Heavy Mode
                    </Text>
                  </View>
                  <Text style={[styles.modeChoiceDesc, { color: theme.textMuted }]}>
                    Full wardrobe options, daily outfit changes, backup layers.
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Clean wardrobe items indicator */}
            <View style={[styles.cleanStatusBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="sparkles" size={16} color="#2F8F5B" />
              <Text style={[styles.cleanStatusText, { color: theme.text }]}>
                {cleanItems.length} Clean wardrobe items available for packing
              </Text>
            </View>

            {dateError && <Text style={styles.errorText}>{dateError}</Text>}

            <Pressable
              disabled={loading}
              onPress={handleCreate}
              style={[styles.createButton, { backgroundColor: theme.secondaryAccent, opacity: loading ? 0.65 : 1 }]}
            >
              <Ionicons name="checkmark-done" size={18} color={theme.onAccent} />
              <Text style={[styles.createLabel, { color: theme.onAccent }]}>
                {loading ? 'Generating Checklist…' : 'Generate Clean Wardrobe Checklist'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 1 },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { gap: 16, paddingBottom: 24 },
  fieldSection: { gap: 6 },
  label: { fontSize: 13.5, fontWeight: '700' },
  subLabel: { fontSize: 11, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  suggestions: { borderWidth: 1, borderRadius: 12, maxHeight: 150, marginTop: 4 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  suggestionText: { fontSize: 13, flex: 1 },
  dateHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  daysBadgeText: { fontSize: 11, fontWeight: '700', color: '#3D2E10' },
  dateRow: { flexDirection: 'row' },
  dateButton: {
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  optionPillText: { fontSize: 12.5, fontWeight: '600' },
  modeToggleRow: { flexDirection: 'row', gap: 10 },
  modeChoiceCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  modeChoiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeChoiceTitle: { fontSize: 13.5, fontWeight: '700' },
  modeChoiceDesc: { fontSize: 11, lineHeight: 15 },
  cleanStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cleanStatusText: { fontSize: 12, fontWeight: '600', flex: 1 },
  errorText: { color: '#E5484D', fontSize: 12.5, textAlign: 'center' },
  createButton: {
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  createLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});