import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { supabase } from '../integrations/supabase/client';
import { analyzeClothingImage } from '../services/imageAnalysisService';
import TextField from '../components/TextField';
import SelectField from '../components/SelectField';
import ChipGroup from '../components/ChipGroup';
import { CLOTHING_CATEGORIES, COLOR_OPTIONS, OCCASION_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS } from '../constants/wardrobeMockData';

const MAX_IMAGE_EDGE = 1600;
const CATEGORY_FROM_API: Record<string, string> = { TOP: 'Tops', BOTTOM: 'Bottoms', SHOES: 'Shoes', OUTERWEAR: 'Outerwear', ACCESSORIES: 'Accessories' };
const CATEGORY_NAME_FROM_API: Record<string, string> = { TOP: 'Top', BOTTOM: 'Bottom', SHOES: 'Shoes', OUTERWEAR: 'Outerwear', ACCESSORIES: 'Accessory' };
const STYLE_FROM_API: Record<string, string> = { CASUAL: 'Casual', FORMAL: 'Formal', SPORTY: 'Athletic', STREETWEAR: 'Streetwear', MINIMALIST: 'Casual', BOHEMIAN: 'Bohemian', VINTAGE: 'Casual', CLASSIC: 'Formal' };

export default function AddClothesScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { session } = useAuth();
  const { addItem } = useWardrobe();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tops');
  const [color, setColor] = useState('Black');
  const [brand, setBrand] = useState('');
  const [material, setMaterial] = useState('');
  const [style, setStyle] = useState('Casual');
  const [seasons, setSeasons] = useState<string[]>(['All']);
  const [occasions, setOccasions] = useState<string[]>(['Casual']);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', `Allow access to your ${useCamera ? 'camera' : 'photos'} to add a clothing image.`);
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;

    // Normalization before storage/inference: correct orientation, cap resolution, encode JPEG.
    const asset = result.assets[0];
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(asset.width, asset.height));
    const processed = await manipulateAsync(asset.uri, [{ resize: { width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) } }], { compress: 0.86, format: SaveFormat.JPEG });
    setImageUri(processed.uri);
    if (session?.access_token) {
      setAnalyzing(true);
      try {
        const prediction = await analyzeClothingImage(processed.uri, session.access_token);
        const suggestedCategory = prediction.category ? CATEGORY_FROM_API[prediction.category] : undefined;
        const suggestedStyle = prediction.style ? STYLE_FROM_API[prediction.style] : undefined;
        if (suggestedCategory) setCategory(suggestedCategory);
        if (prediction.color && COLOR_OPTIONS.includes(prediction.color as typeof COLOR_OPTIONS[number])) setColor(prediction.color);
        if (suggestedStyle) setStyle(suggestedStyle);
        if (!name.trim() && prediction.category) setName(`${prediction.color ? `${prediction.color} ` : ''}${CATEGORY_NAME_FROM_API[prediction.category]}`);
      } catch (error) {
        // A photo can still be saved when the API/CNN is unreachable.
        console.info('Image analysis unavailable; continue with manual values.', error);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const uploadImage = async (uri: string) => {
    const user = session?.user;
    if (!user) throw new Error('Please sign in before uploading a photo.');
    const response = await fetch(uri);
    const bytes = await response.arrayBuffer();
    const path = `${user.id}/${Crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('wardrobe-images').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return supabase.storage.from('wardrobe-images').getPublicUrl(path).data.publicUrl;
  };

  const toggle = (value: string, setValues: React.Dispatch<React.SetStateAction<string[]>>) => {
    setValues((previous) => previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this clothing item a name before saving.');
      return;
    }
    setSaving(true);
    try {
      const image = imageUri ? await uploadImage(imageUri) : '';
      await addItem({ name: name.trim(), category, color, brand, material, style, seasons, occasions, image, status: 'clean', favorite: false, timesWorn: 0, lastWorn: '', costPerWear: 0, wearCountSinceWash: 0, washThreshold: 5, avgWearsPerMonth: 0, sinceLast: 'Never', wearHistory: [] });
      navigation.goBack();
    } catch (error) {
      console.error('Unable to add wardrobe item', error);
      Alert.alert('Could not save item', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
    <View style={styles.header}><Pressable onPress={() => navigation.goBack()} style={styles.icon}><Ionicons name="arrow-back" size={21} color={theme.text} /></Pressable><Text style={[styles.title, { color: theme.text }]}>Add clothing</Text><View style={styles.icon} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.photo, { backgroundColor: theme.surface, borderColor: theme.border }]}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.photoImage} /> : <Ionicons name="shirt-outline" size={44} color={theme.textMuted} />}</View>
      <View style={styles.photoActions}><Pressable onPress={() => pickImage(false)} style={[styles.photoButton, { borderColor: theme.border }]}><Ionicons name="images-outline" size={18} color={theme.text} /><Text style={{ color: theme.text }}>Choose photo</Text></Pressable><Pressable onPress={() => pickImage(true)} style={[styles.photoButton, { backgroundColor: theme.secondaryAccent }]}><Ionicons name="camera-outline" size={18} color="#fff" /><Text style={{ color: '#fff' }}>Take photo</Text></Pressable></View>
      {analyzing && <Text style={[styles.analyzingText, { color: theme.textMuted }]}>Analyzing photo and suggesting details…</Text>}
      <TextField label="Name *" value={name} onChangeText={setName} placeholder="e.g. Black hoodie" />
      <SelectField label="Category" required value={category} options={CLOTHING_CATEGORIES.filter((entry) => entry !== 'All' && entry !== 'Dresses')} onChange={setCategory} />
      <View style={styles.row}><SelectField label="Color" value={color} options={COLOR_OPTIONS} onChange={setColor} /><View style={styles.gap} /><TextField label="Brand" value={brand} onChangeText={setBrand} placeholder="Optional" /></View>
      <View style={styles.row}><TextField label="Material" value={material} onChangeText={setMaterial} placeholder="Optional" /><View style={styles.gap} /><SelectField label="Style" value={style} options={STYLE_OPTIONS} onChange={setStyle} /></View>
      <ChipGroup label="Occasions" options={OCCASION_OPTIONS} selected={occasions} onToggle={(value) => toggle(value, setOccasions)} />
      <ChipGroup label="Seasons" options={SEASON_OPTIONS} selected={seasons} onToggle={(value) => toggle(value, setSeasons)} />
      <Pressable disabled={saving} onPress={save} style={[styles.save, { backgroundColor: theme.secondaryAccent, opacity: saving ? 0.65 : 1 }]}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Add to wardrobe'}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 }, icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 17, fontWeight: '700' }, content: { padding: 20, gap: 18, paddingBottom: 40 }, photo: { height: 230, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, photoImage: { width: '100%', height: '100%', resizeMode: 'cover' }, photoActions: { flexDirection: 'row', gap: 12 }, photoButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, analyzingText: { textAlign: 'center', fontSize: 13 }, row: { flexDirection: 'row' }, gap: { width: 12 }, save: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 }, saveText: { color: '#fff', fontSize: 15, fontWeight: '700' } });
