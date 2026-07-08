import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, FlatList, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePacking } from '../contexts/PackingContext';
import { searchDestinations, GeocodeResult } from '../services/geocodingService';
import { fetchWeatherByCoords } from '../services/weatherService';

export default function NewTripModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { addTrip } = usePacking();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [selected, setSelected] = useState<GeocodeResult | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

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
    if (!selected) {
      setDateError('Please select a destination from the suggestions.');
      return;
    }
    let avgTempF: number | undefined;
    try {
      const weather = await fetchWeatherByCoords(selected.lat, selected.lon, selected.displayName.split(',')[0]);
      avgTempF = weather.tempF;
    } catch {
      avgTempF = undefined;
    }

    const tripId = addTrip(
      selected.displayName.split(',')[0],
      selected.lat,
      selected.lon,
      startDate.toISOString(),
      endDate.toISOString(),
      avgTempF
    );

    resetForm();
    onClose();
    navigation.navigate('PackingTripDetail', { tripId });
  };

  const resetForm = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setStartDate(new Date());
    setEndDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setDateError(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={[styles.sheet, { backgroundColor: theme.background }]} edges={['bottom']}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>New Trip</Text>
            <Pressable onPress={() => { resetForm(); onClose(); }} style={[styles.closeButton, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={18} color={theme.text} />
            </Pressable>
          </View>

          <Text style={[styles.label, { color: theme.text }]}>Destination</Text>
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search a city..."
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
          />

          {results.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <FlatList
                data={results}
                keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
                renderItem={({ item }) => (
                  <Pressable onPress={() => handleSelectDestination(item)} style={styles.suggestionRow}>
                    <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                    <Text style={[styles.suggestionText, { color: theme.text }]} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}

          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.text }]}>Start Date</Text>
              <Pressable onPress={() => setShowStartPicker(true)} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={{ color: theme.text }}>{startDate.toDateString()}</Text>
              </Pressable>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.text }]}>End Date</Text>
              <Pressable onPress={() => setShowEndPicker(true)} style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={{ color: theme.text }}>{endDate.toDateString()}</Text>
              </Pressable>
            </View>
          </View>

          {showStartPicker && (
            <DateTimePicker value={startDate} mode="date" minimumDate={today} onChange={handleStartChange} />
          )}
          {showEndPicker && (
            <DateTimePicker value={endDate} mode="date" minimumDate={startDate} onChange={handleEndChange} />
          )}

          {dateError && <Text style={styles.errorText}>{dateError}</Text>}

          <Pressable onPress={handleCreate} style={[styles.createButton, { backgroundColor: theme.secondaryAccent }]}>
            <Text style={styles.createLabel}>Create Trip & Generate Checklist</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  suggestions: { borderWidth: 1, borderRadius: 12, maxHeight: 160, marginTop: -4 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 14 },
  suggestionText: { fontSize: 13, flex: 1 },
  dateRow: { flexDirection: 'row', marginTop: 6 },
  errorText: { color: '#E5484D', fontSize: 12.5 },
  createButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  createLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});