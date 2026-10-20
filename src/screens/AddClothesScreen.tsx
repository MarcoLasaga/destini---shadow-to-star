import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { analyzeClothingImage, ClothingPrediction } from '../services/imageAnalysisService';
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
const ALLOWED_CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories'];
const THESIS_OCCASIONS = ['Academic', 'Office', 'Formal', 'Casual', 'Workout'];

function capitalize(str: string): string {
  const s = (str || '').trim();
  if (!s) return 'Item';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface SafePrefillResult {
  name: string;
  category: string;
  color: string;
  style: string;
  occasions: string[];
  seasons: string[];
}

function buildSafeAutoPrefill(prediction: ClothingPrediction | null): SafePrefillResult {
  // 1. Detect Color
  let detectedColor = 'Gray';
  if (prediction?.color) {
    const matchedColor = COLOR_OPTIONS.find(
      (c) => c.toLowerCase() === prediction.color!.toLowerCase()
    );
    detectedColor = matchedColor || capitalize(prediction.color);
  }

  // 2. Detect Category
  const rawCategory = prediction?.category || '';
  const category = (rawCategory && CATEGORY_FROM_API[rawCategory.toUpperCase()]) || 'Tops';

  // 3. Safe Name Pre-Fill: use result.suggestedName if returned, otherwise "${result.color} ${result.category ? capitalize(result.category) : 'Item'}"
  const rawSuggested = (prediction?.suggestedName || '').trim();
  const isGenericUppercase =
    !rawSuggested ||
    /^(TOP|BOTTOM|SHOES|OUTERWEAR|ACCESSORIES|ITEM)$/i.test(rawSuggested);

  const finalName = !isGenericUppercase
    ? rawSuggested
        .split(/\s+/)
        .map((w) => capitalize(w))
        .join(' ')
    : `${detectedColor} ${rawCategory ? capitalize(rawCategory) : 'Item'}`;

  // 4. Determine Style & Occasions
  const apiStyle = (prediction?.style || '').toUpperCase();
  let style = 'Casual';
  if (apiStyle === 'FORMAL' || apiStyle === 'CLASSIC') {
    style = 'Formal';
  } else if (apiStyle === 'MINIMALIST') {
    style = 'Business';
  } else if (apiStyle === 'SPORTY') {
    style = 'Athletic';
  } else if (apiStyle === 'STREETWEAR') {
    style = 'Streetwear';
  } else if (apiStyle === 'BOHEMIAN') {
    style = 'Bohemian';
  }

  let occasions: string[] = ['Casual'];
  if (style === 'Formal') {
    occasions = ['Formal', 'Office'];
  } else if (style === 'Business') {
    occasions = ['Office', 'Academic'];
  } else if (style === 'Athletic') {
    occasions = ['Workout', 'Casual'];
  } else {
    occasions = ['Casual', 'Academic'];
  }

  return {
    name: finalName,
    category,
    color: COLOR_OPTIONS.includes(detectedColor as any) ? detectedColor : 'Gray',
    style,
    occasions,
    seasons: ['All'],
  };
}

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
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [style, setStyle] = useState('Casual');
  const [seasons, setSeasons] = useState<string[]>(['All']);
  const [occasions, setOccasions] = useState<string[]>(['Casual']);
  const [analyzing, setAnalyzing] = useState(false);
  const [isImageVerified, setIsImageVerified] = useState(false);
  const [wasAiPrefilled, setWasAiPrefilled] = useState(false);
  const [lowConfidenceWarning, setLowConfidenceWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  // Custom Moderation Shield & Info Modal States
  const [moderationModal, setModerationModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });
  const [infoModal, setInfoModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  const resetTextFieldsOnNewPhoto = () => {
    setName('');
    setBrand('');
    setMaterial('');
    setCategory('Tops');
    setColor('Black');
    setPrice('');
    setNotes('');
    setError('');
  };

  const resetInvalidImage = () => {
    setImageUri(null);
    setIsImageVerified(false);
    setWasAiPrefilled(false);
    resetTextFieldsOnNewPhoto();
  };

  const applySafePrefill = (prefill: SafePrefillResult) => {
    setName(prefill.name);
    setCategory(prefill.category);
    setColor(prefill.color);
    setStyle(prefill.style);
    setOccasions(prefill.occasions);
    setSeasons(prefill.seasons);
    // Explicitly keep Brand and Material blank so placeholder values never appear
    setBrand('');
    setMaterial('');
    setWasAiPrefilled(true);
  };

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setInfoModal({
        visible: true,
        title: 'Permission Required',
        message: `Please allow access to your ${
          useCamera ? 'camera' : 'photos'
        } in device settings to add a clothing item.`,
      });
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.9,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.9,
        });
    if (result.canceled || !result.assets[0]) return;

    // Explicitly reset all text input fields on every new photo selection
    resetTextFieldsOnNewPhoto();
    setIsImageVerified(false);
    setWasAiPrefilled(false);
    setLowConfidenceWarning(false);

    const asset = result.assets[0];
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(asset.width, asset.height));
    const processed = await manipulateAsync(
      asset.uri,
      [
        {
          resize: {
            width: Math.round(asset.width * scale),
            height: Math.round(asset.height * scale),
          },
        },
      ],
      { compress: 0.86, format: SaveFormat.JPEG }
    );

    setImageUri(processed.uri);

    if (session?.access_token) {
      setAnalyzing(true);
      try {
        const prediction = await analyzeClothingImage(processed.uri, session.access_token);

        if (
          prediction.is_safe_garment === false ||
          (prediction.category === null && prediction.moderation_reason)
        ) {
          resetInvalidImage();
          setModerationModal({
            visible: true,
            title: 'Unrecognized Image',
            message:
              prediction.moderation_reason ||
              'This photo does not appear to be a valid clothing item. Please upload a clear photo of a garment.',
          });
          return;
        }

        // Store clean background-removed cutout in imageUri when returned
        if (prediction.cutoutDataUri && typeof prediction.cutoutDataUri === 'string') {
          setImageUri(prediction.cutoutDataUri);
        }

        const rawConf = prediction.categoryConfidence ?? prediction.confidence ?? 0.88;
        if (!prediction.category || rawConf < 0.6) {
          setLowConfidenceWarning(true);
        }

        setIsImageVerified(true);
        const prefill = buildSafeAutoPrefill(prediction);
        applySafePrefill(prefill);
      } catch (err: any) {
        const isModerationError =
          err?.response?.status === 422 ||
          err?.status === 422 ||
          err?.message?.includes('422') ||
          err?.message?.toLowerCase().includes('moderation') ||
          err?.message?.toLowerCase().includes('inappropriate');

        if (isModerationError) {
          resetInvalidImage();
          setModerationModal({
            visible: true,
            title: 'Unrecognized Image',
            message:
              err?.response?.data?.moderation_reason ||
              err?.response?.data?.message ||
              'This photo could not be verified as a clothing item. Please upload a clear photo of a garment.',
          });
          return;
        }

        setLowConfidenceWarning(true);
        setIsImageVerified(true);
        const fallbackPrefill = buildSafeAutoPrefill(null);
        applySafePrefill(fallbackPrefill);
      } finally {
        setAnalyzing(false);
      }
    } else {
      setIsImageVerified(true);
      const fallbackPrefill = buildSafeAutoPrefill(null);
      applySafePrefill(fallbackPrefill);
    }
  };

  const uploadImage = async (uri: string) => {
    const user = session?.user;
    if (!user) throw new Error('Please sign in before uploading a photo.');
    try {
      const isPng = uri.startsWith('data:image/png') || uri.toLowerCase().endsWith('.png');
      const ext = isPng ? 'png' : 'jpg';
      const contentType = isPng ? 'image/png' : 'image/jpeg';
      const response = await fetch(uri);
      const bytes = await response.arrayBuffer();
      const path = `${user.id}/${Crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('wardrobe-images')
        .upload(path, bytes, { contentType, upsert: false });
      if (uploadError) {
        if (uri.startsWith('data:image/') || uri.startsWith('http')) return uri;
        throw uploadError;
      }
      return supabase.storage.from('wardrobe-images').getPublicUrl(path).data.publicUrl;
    } catch (err) {
      if (uri.startsWith('data:image/') || uri.startsWith('http')) return uri;
      throw err;
    }
  };

  const toggle = (
    value: string,
    setValues: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setValues((previous) =>
      previous.includes(value)
        ? previous.filter((entry) => entry !== value)
        : [...previous, value]
    );
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

    const profanityCheck = containsProfanityOrSlurs(name, brand, material, notes);
    if (profanityCheck.hasProfanity) {
      setModerationModal({
        visible: true,
        title: 'Prohibited Language',
        message:
          profanityCheck.reason ||
          'Item name or details contain prohibited language or profanity. Please revise before saving.',
      });
      return;
    }

    setSaving(true);
    setError('');
    try {
      const image = imageUri ? await uploadImage(imageUri) : '';
      const parsedPrice = price.trim() ? parseFloat(price.trim()) || 0 : 0;
      await addItem({
        name: name.trim(),
        category,
        color,
        brand: brand.trim(),
        material: material.trim(),
        style,
        seasons,
        occasions,
        image,
        status: 'clean',
        favorite: false,
        timesWorn: 0,
        lastWorn: '',
        costPerWear: parsedPrice,
        wearCountSinceWash: 0,
        washThreshold: 5,
        avgWearsPerMonth: 0,
        sinceLast: 'Never',
        wearHistory: [],
      });
      navigation.goBack();
    } catch {
      setError('Could not save item. Please check your connection and try again.');
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
        {/* Cutout Preview Canvas: Centered on subtle #F8F8FA rounded canvas with resizeMode="contain" */}
        <View style={[styles.photo, { backgroundColor: '#F8F8FA', borderColor: theme.border }]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.photoImage}
              resizeMode="contain"
            />
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
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
              Take Photo (Camera)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => pickImage(false)}
            style={[styles.photoButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <Ionicons name="images-outline" size={17} color={theme.text} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
              Upload from Gallery
            </Text>
          </Pressable>
        </View>

        {analyzing && (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: theme.aiBannerBg,
                borderColor: theme.aiBannerBorder,
                flexDirection: 'row',
                gap: 8,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.accentText} />
            <Text style={[styles.statusPillText, { color: theme.aiBannerText }]}>
              ✨ Removing background & detecting garment details...
            </Text>
          </View>
        )}
        {!analyzing && isImageVerified && lowConfidenceWarning && (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: theme.aiBannerBg,
                borderColor: theme.aiBannerBorder,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: theme.aiBannerText }]}>
              We couldn't auto-detect the category clearly — please verify the category below before saving.
            </Text>
          </View>
        )}
        {!analyzing && isImageVerified && wasAiPrefilled && !lowConfidenceWarning && (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: theme.aiPillBg,
                borderColor: theme.aiBannerBorder,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: theme.aiPillText }]}>
              ✨ Clean cutout & garment details auto-filled · Ready to add!
            </Text>
          </View>
        )}
        {!!error && (
          <Text style={[styles.errorText, { color: '#E5484D' }]}>{error}</Text>
        )}

        <TextField
          label="Name *"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setWasAiPrefilled(false);
          }}
          placeholder="e.g. Gray Top"
        />
        <SelectField
          label="Category"
          value={category}
          options={ALLOWED_CATEGORIES}
          onChange={setCategory}
          required
        />
        <SelectField label="Color" value={color} options={COLOR_OPTIONS} onChange={setColor} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Brand"
              value={brand}
              onChangeText={setBrand}
              placeholder="Optional"
            />
          </View>
          <View style={styles.gap} />
          <View style={{ flex: 1 }}>
            <TextField
              label="Material"
              value={material}
              onChangeText={setMaterial}
              placeholder="Optional"
            />
          </View>
        </View>
        <SelectField label="Style" value={style} options={STYLE_OPTIONS} onChange={setStyle} />
        <ChipGroup
          label="Occasions"
          options={THESIS_OCCASIONS}
          selected={occasions}
          onToggle={(value) => toggle(value, setOccasions)}
        />
        <ChipGroup
          label="Seasons"
          options={SEASON_OPTIONS}
          selected={seasons}
          onToggle={(value) => toggle(value, setSeasons)}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  photo: {
    height: 230,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 12,
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  photoActions: { flexDirection: 'row', gap: 12 },
  photoButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  statusPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  statusPillText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  errorText: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row' },
  gap: { width: 12 },
  save: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  saveText: { fontSize: 15, fontWeight: '700' },
});
