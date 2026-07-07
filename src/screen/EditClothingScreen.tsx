import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useToast } from '../contexts/ToastContext';
import { RootStackParamList } from '../types';
import {
  CLOTHING_CATEGORIES,
  COLOR_OPTIONS,
  STYLE_OPTIONS,
  SEASON_OPTIONS,
  OCCASION_OPTIONS,
} from '../constants/wardrobeMockData';
import SelectField from '../components/SelectField';
import TextField from '../components/TextField';
import ChipGroup from '../components/ChipGroup';

const { width } = Dimensions.get('window');

export default function EditClothingScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'EditClothing'>>();
  const { getItem, updateItem } = useWardrobe();
  const { showToast } = useToast();

  const original = getItem(route.params.id);

  const [name, setName] = useState(original?.name ?? '');
  const [category, setCategory] = useState(original?.category ?? 'Tops');
  const [color, setColor] = useState(original?.color ?? 'Blue');
  const [brand, setBrand] = useState(original?.brand ?? '');
  const [material, setMaterial] = useState(original?.material ?? '');
  const [style, setStyle] = useState(original?.style ?? 'Casual');
  const [seasons, setSeasons] = useState<string[]>(original?.seasons ?? []);
  const [occasions, setOccasions] = useState<string[]>(original?.occasions ?? []);

  if (!original) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.notFound}>
          <Text style={{ color: theme.text }}>This item no longer exists.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleSeason = (value: string) => {
    setSeasons((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const toggleOccasion = (value: string) => {
    setOccasions((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handleSave = () => {
    updateItem(original.id, { name, category, color, brand, material, style, seasons, occasions });
    showToast('Clothing item updated.');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']} style={[styles.header, { backgroundColor: theme.background }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Item</Text>
        <View style={{ width: 40 }} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: original.image }} style={styles.image} contentFit="cover" />
        </View>

        <View style={styles.form}>
          <TextField label="Name *" value={name} onChangeText={setName} placeholder="Clothing name" />

          <SelectField
            label="Category"
            value={category}
            options={CLOTHING_CATEGORIES.filter((c) => c !== 'All')}
            onChange={setCategory}
            required
          />

          <View style={styles.row}>
            <SelectField label="Color" value={color} options={COLOR_OPTIONS} onChange={setColor} />
            <View style={{ width: 12 }} />
            <TextField label="Brand" value={brand} onChangeText={setBrand} placeholder="Brand" />
          </View>

          <View style={styles.row}>
            <TextField label="Material" value={material} onChangeText={setMaterial} placeholder="Material" />
            <View style={{ width: 12 }} />
            <SelectField label="Style" value={style} options={STYLE_OPTIONS} onChange={setStyle} />
          </View>

          <ChipGroup label="Occasions" options={OCCASION_OPTIONS} selected={occasions} onToggle={toggleOccasion} />
          <ChipGroup label="Seasons" options={SEASON_OPTIONS} selected={seasons} onToggle={toggleSeason} />

          <Pressable onPress={handleSave} style={[styles.saveButton, { backgroundColor: theme.secondaryAccent }]}>
            <Text style={styles.saveLabel}>Update Item</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },
  imageWrap: { width, height: width * 0.55, backgroundColor: '#D9D9D9' },
  image: { width: '100%', height: '100%' },
  form: { paddingHorizontal: 20, paddingTop: 20, gap: 18 },
  row: { flexDirection: 'row' },
  saveButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  saveLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});