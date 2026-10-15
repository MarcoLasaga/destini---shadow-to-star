import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { containsProfanityOrSlurs } from '../services/communityService';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
import TextField from '../components/TextField';
import SelectField from '../components/SelectField';
import ChipGroup from '../components/ChipGroup';
import { COLOR_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS } from '../constants/wardrobeMockData';

const MAX_IMAGE_EDGE = 1600;
const CATEGORY_FROM_API: Record<string, string> = {
  TOP: 'Tops',
  BOTTOM: 'Bottoms',
  SHOES: 'Shoes',
  OUTERWEAR: 'Outerwear',
  ACCESSORIES: 'Accessories',
};
const CATEGORY_NAME_FROM_API: Record<string, string> = {
  TOP: 'Top',
  BOTTOM: 'Bottom',
  SHOES: 'Shoes',
  OUTERWEAR: 'Outerwear',
  ACCESSORIES: 'Accessory',
};
const ALLOWED_CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories'];
const THESIS_OCCASIONS = ['Academic', 'Office', 'Formal', 'Casual', 'Workout'];

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
  const [analyzing, setAnalyzing] = useState(false);
  const [isImageVerified, setIsImageVerified] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Custom Moderation Shield & Info Modal States
  const [moderationModal, setModerationModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: '',
    message: '',
  });

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setInfoModal({
        visible: true,
        title: 'Permission Required',
        message: `Please allow access to your ${useCamera ? 'camera' : 'photos'} in device settings to add a clothing item.`,
      });
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;

    // Normalization before storage/inference: correct orientation, cap resolution, encode JPEG.
    const asset = result.assets[0];
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(asset.width, asset.height));
    const processed = await manipulateAsync(
      asset.uri,
      [{ resize: { width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) } }],
      { compress: 0.86, format: SaveFormat.JPEG }
    );

    // Tentatively set image preview while analyzing; mark unverified until moderation succeeds
    setImageUri(processed.uri);
    setIsImageVerified(false);

    if (session?.access_token) {
      setAnalyzing(true);
      try {
        const prediction = await analyzeClothingImage(processed.uri, session.access_token);

        // Moderation check: block upload if is_safe_garment is false or category is null with moderation reason
        if (
          prediction.is_safe_garment === false ||
          (prediction.category === null && prediction.moderation_reason)
        ) {
          setImageUri(null);
          setIsImageVerified(false);
          setConfidence(null);
          setModerationModal({
            visible: true,
            title: 'Image Blocked by Moderation',
            message:
              prediction.moderation_reason ||
              'This image was flagged by automated content moderation. Non-clothing, unsafe, or inappropriate images cannot be added. Please upload a clear photo of a garment.',
          });
          return;
        }

        setIsImageVerified(true);

        const detectedConfidence =
          typeof prediction.categoryConfidence === 'number'
            ? prediction.categoryConfidence
            : typeof prediction.confidence === 'number'
            ? prediction.confidence
            : null;

        // Thesis Chapter 2 Eq. 3: Garment detection & classification confidence threshold tau >= 0.55
        if (detectedConfidence !== null && detectedConfidence < 0.55) {
          setConfidence(detectedConfidence);
          setModerationModal({
            visible: true,
            title: 'Low Garment Confidence',
            message: `The image could only be identified with ${Math.round(detectedConfidence * 100)}% confidence (<55% threshold). Please upload a clear, well-lit photo of a clothing item.`,
          });
          return;
        }

        setConfidence(detectedConfidence);

        const suggestedCategory = prediction.category ? CATEGORY_FROM_API[prediction.category] : undefined;
        if (suggestedCategory && ALLOWED_CATEGORIES.includes(suggestedCategory)) {
          setCategory(suggestedCategory);
        }
        if (prediction.color && COLOR_OPTIONS.includes(prediction.color as (typeof COLOR_OPTIONS)[number])) {
          setColor(prediction.color);
        }
        if (!name.trim() && prediction.category) {
          setName(`${prediction.color ? `${prediction.color} ` : ''}${CATEGORY_NAME_FROM_API[prediction.category] || 'Item'}`);
        }
      } catch (error: any) {
        setConfidence(null);
        const isModerationError =
          error?.response?.status === 422 ||
          error?.status === 422 ||
          error?.message?.includes('422') ||
          error?.message?.toLowerCase().includes('moderation') ||
          error?.message?.toLowerCase().includes('inappropriate');

        if (isModerationError) {
          setImageUri(null);
          setIsImageVerified(false);
          setModerationModal({
            visible: true,
            title: 'Image Blocked by Moderation',
            message:
              error?.response?.data?.moderation_reason ||
              error?.response?.data?.message ||
              'This photo was flagged by automated content moderation and cannot be uploaded. Non-clothing, offensive, or inappropriate images are strictly prohibited.',
          });
          return;
        }

        // A photo can still be saved when the API/CNN is unreachable.
        setIsImageVerified(true);
        if (__DEV__) console.info('[StyleSense] wardrobe analysis unavailable; manual values remain editable.', error);
      } finally {
        setAnalyzing(false);
      }
    } else {
      setIsImageVerified(true);
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
    setValues((previous) => (previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value]));
  };

  const save = async () => {
    if (analyzing) {
      setInfoModal({
        visible: true,
        title: 'Analysis in Progress',
        message: 'Please wait for garment moderation and category analysis to complete.',
      });
      return;
    }

    if (imageUri && !isImageVerified) {
      setModerationModal({
        visible: true,
        title: 'Image Moderation Required',
        message: 'Please wait for your garment photo to be verified or upload a safe garment image.',
      });
      return;
    }

    if (!name.trim()) {
      setInfoModal({
        visible: true,
        title: 'Name Required',
        message: 'Give this clothing item a name before adding it to your wardrobe.',
      });
      return;
    }

    // Client-side profanity and slurs check on user input text
    const profanityCheck = containsProfanityOrSlurs(name, brand, material);
    if (profanityCheck.hasProfanity) {
      setModerationModal({
        visible: true,
        title: 'Prohibited Language',
        message: profanityCheck.reason || 'Item name or details contain prohibited language or profanity. Please revise before saving.',
      });
      return;
    }

    setSaving(true);
    try {
      const image = imageUri ? await uploadImage(imageUri) : '';
      await addItem({
        name: name.trim(),
        category,
        color,
        brand,
        material,
        style,
        seasons,
        occasions,
        image,
        status: 'clean',
        favorite: false,
        timesWorn: 0,
        lastWorn: '',
        costPerWear: 0,
        wearCountSinceWash: 0,
        washThreshold: 5,
        avgWearsPerMonth: 0,
        sinceLast: 'Never',
        wearHistory: [],
      });
      navigation.goBack();
    } catch (error) {
      console.error('Unable to add wardrobe item', error);
      setInfoModal({
        visible: true,
        title: 'Could Not Save Item',
        message: 'Please check your connection and try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.icon}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Add to Wardrobe</Text>
        <View style={styles.icon} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.photo, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photoImage} />
          ) : (
            <Ionicons name="shirt-outline" size={48} color={theme.textMuted} />
          )}
        </View>

        <View style={styles.photoActions}>
          <Pressable
            onPress={() => pickImage(true)}
            style={[styles.photoButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <Ionicons name="camera-outline" size={17} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Take Photo (Camera)</Text>
          </Pressable>
          <Pressable
            onPress={() => pickImage(false)}
            style={[styles.photoButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <Ionicons name="images-outline" size={17} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Upload from Gallery</Text>
          </Pressable>
        </View>

        {analyzing && (
          <View style={[styles.statusPill, { backgroundColor: theme.mode === 'dark' ? '#3A2447' : '#DECFE8', borderColor: theme.border }]}>
            <Text style={[styles.statusPillText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>
              Analyzing garment with ResNet-50 & CIELAB K-Means…
            </Text>
          </View>
        )}
        {!analyzing && confidence !== null && (
          <View style={[styles.statusPill, { backgroundColor: theme.mode === 'dark' ? '#3A2447' : '#DECFE8', borderColor: theme.border }]}>
            <Text style={[styles.statusPillText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>
              Classified as {category} with {Math.round(confidence * 100)}% AI confidence
            </Text>
          </View>
        )}

        <TextField label="Name *" value={name} onChangeText={setName} placeholder="e.g. Linen Camp Shirt" />
        <SelectField label="Category" value={category} options={ALLOWED_CATEGORIES} onChange={setCategory} required />
        <SelectField label="Color" value={color} options={COLOR_OPTIONS} onChange={setColor} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="Brand" value={brand} onChangeText={setBrand} placeholder="Optional" />
          </View>
          <View style={styles.gap} />
          <View style={{ flex: 1 }}>
            <TextField label="Material" value={material} onChangeText={setMaterial} placeholder="Optional" />
          </View>
        </View>
        <SelectField label="Style" value={style} options={STYLE_OPTIONS} onChange={setStyle} />
        <ChipGroup label="Occasions" options={THESIS_OCCASIONS} selected={occasions} onToggle={(value) => toggle(value, setOccasions)} />
        <ChipGroup label="Seasons" options={SEASON_OPTIONS} selected={seasons} onToggle={(value) => toggle(value, setSeasons)} />
        <Pressable
          disabled={saving || analyzing || (!!imageUri && !isImageVerified)}
          onPress={save}
          style={[
            styles.save,
            {
              backgroundColor: theme.secondaryAccent,
              opacity: saving || analyzing || (!!imageUri && !isImageVerified) ? 0.5 : 1,
            },
          ]}
        >
          <Text style={[styles.saveText, { color: theme.onAccent }]}>
            {saving ? 'Saving…' : analyzing ? 'Analyzing Garment…' : 'Add to wardrobe'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Moderation Shield Dialog Modal */}
      <ConfirmDialogModal
        visible={moderationModal.visible}
        variant="moderation"
        title={moderationModal.title}
        message={moderationModal.message}
        confirmText="Understood"
        showCancel={false}
        onConfirm={() => setModerationModal({ visible: false, title: '', message: '' })}
      />

      {/* Informational Dialog Modal */}
      <ConfirmDialogModal
        visible={infoModal.visible}
        variant="info"
        title={infoModal.title}
        message={infoModal.message}
        confirmText="OK"
        showCancel={false}
        onConfirm={() => setInfoModal({ visible: false, title: '', message: '' })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  photo: { height: 230, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoActions: { flexDirection: 'row', gap: 12 },
  photoButton: { flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  statusPill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  statusPillText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  analyzingText: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row' },
  gap: { width: 12 },
  save: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  saveText: { fontSize: 15, fontWeight: '700' },
});
