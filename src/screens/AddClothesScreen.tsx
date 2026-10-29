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
import * as Crypto from 'expo-crypto';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { supabase } from '../integrations/supabase/client';
import { analyzeClothingImage, ClothingPrediction, Nsfw5ClassScores } from '../services/imageAnalysisService';
import { containsProfanityOrSlurs } from '../services/communityService';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
import TextField from '../components/TextField';
import SelectField from '../components/SelectField';
import ChipGroup from '../components/ChipGroup';
import {
  COLOR_OPTIONS,
  SEASON_OPTIONS,
  STYLE_OPTIONS,
  getLayerRoleForCategory,
  OUTERWEAR_NAME_SUFFIX_REGEX,
  replaceOuterwearSuffixWithTShirt,
} from '../constants/wardrobeMockData';
import CielabPaletteCard from '../components/CielabPaletteCard';
import {
  CanonicalStudioGarmentSvg,
  formatSubtypeLabel,
  inferVectorSubtype,
} from '../utils/garmentImageHelper';
import { colorNameToHex } from '../services/outfitRecommendationService';

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
  subCategory: string;
  vector_subtype: string;
  layerRole: string;
  color: string;
  style: string;
  occasions: string[];
  seasons: string[];
}

function buildSafeAutoPrefill(prediction: ClothingPrediction | null): SafePrefillResult {
  const isSafe = prediction?.is_safe_garment !== false;
  const rawCategory = prediction?.category || '';
  const category = (rawCategory && CATEGORY_FROM_API[rawCategory.toUpperCase()]) || '';
  const layerRole =
    prediction?.layerRole ||
    prediction?.layer_role ||
    getLayerRoleForCategory(category || 'Tops');

  // 1. Detect Color from ML result (primary_color || color || cluster0)
  const cluster0Color = Array.isArray(prediction?.palette) ? prediction?.palette[0]?.color_name : undefined;
  const rawColor = prediction?.primary_color || prediction?.color || cluster0Color || '';
  let detectedColor = '';
  if (rawColor) {
    const matchedColor = COLOR_OPTIONS.find(
      (c) => c.toLowerCase() === rawColor.toLowerCase()
    );
    detectedColor = matchedColor || capitalize(rawColor);
  }

  // Block Non-Wearable OOD Items:
  if (!isSafe || !category) {
    return {
      name: prediction?.suggestedName || 'Non-Wearable Item',
      category: '',
      subCategory: '',
      vector_subtype: '',
      layerRole: 'INNER_BASE',
      color: detectedColor || '',
      style: 'Casual',
      occasions: ['Casual'],
      seasons: ['All'],
    };
  }

  // 3. Safe Name Pre-Fill: use result.suggestedName if returned from ml-service, otherwise "${result.color} ${result.category}"
  const rawSuggested = (prediction?.suggestedName || '').trim();
  const isGenericUppercase =
    !rawSuggested ||
    /^(TOP|BOTTOM|SHOES|OUTERWEAR|ACCESSORIES|ITEM)$/i.test(rawSuggested);

  let finalName = '';
  if (!isGenericUppercase && rawSuggested.length >= 3) {
    finalName = rawSuggested
      .split(/\s+/)
      .map((w) => capitalize(w))
      .join(' ');
  } else if (detectedColor && category) {
    finalName = `${detectedColor} ${category}`;
  } else if (category) {
    finalName = category;
  } else {
    finalName = 'Garment';
  }

  const vectorSubtype = inferVectorSubtype(
    finalName,
    category || 'Tops',
    prediction?.vector_subtype || prediction?.subCategory || prediction?.sub_category
  );
  const subCategoryLabel = formatSubtypeLabel(vectorSubtype, category || 'Tops');

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
    category: category || 'Tops',
    subCategory: subCategoryLabel,
    vector_subtype: vectorSubtype,
    layerRole,
    color: detectedColor || 'White',
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
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [cutoutUri, setCutoutUri] = useState<string | null>(null);
  const [beautifiedUri, setBeautifiedUri] = useState<string | null>(null);
  const [beautifiedMethod, setBeautifiedMethod] = useState<string | null>(null);
  const [useBeautified, setUseBeautified] = useState<boolean>(false);
  const [subCategory, setSubCategory] = useState<string>('Tshirt');
  const [vectorSubtype, setVectorSubtype] = useState<string>('tshirt');
  const [layerRole, setLayerRole] = useState<string>('INNER_BASE');
  const [confidence, setConfidence] = useState<number>(0);
  const [moderationReason, setModerationReason] = useState<string | null>(null);
  const [nsfwScores, setNsfwScores] = useState<Partial<Nsfw5ClassScores> | null>(null);
  const [palette, setPalette] = useState<any>(null);
  const [colorHarmonyNote, setColorHarmonyNote] = useState<string | null>(null);
  const [secondaryColor, setSecondaryColor] = useState<string | undefined>(undefined);
  const [secondaryColorHex, setSecondaryColorHex] = useState<string | null>(null);
  const [colorHex, setColorHex] = useState<string>('#264C3B');
  const [isSafeGarment, setIsSafeGarment] = useState<boolean>(true);
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
    setLayerRole('INNER_BASE');
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
    setLayerRole(prefill.layerRole || getLayerRoleForCategory(prefill.category));
    setSubCategory(prefill.subCategory);
    setVectorSubtype(prefill.vector_subtype);
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
    setImageUri(asset.uri);
    setOriginalUri(asset.uri);
    setCutoutUri(null);
    setBeautifiedUri(null);
    setBeautifiedMethod(null);
    setUseBeautified(false);
    setConfidence(0);
    setModerationReason(null);
    setNsfwScores(null);

    if (session?.access_token) {
      setAnalyzing(true);
      setError('');
      try {
        const prediction = await analyzeClothingImage(asset.uri, session.access_token);
        const scores = prediction.nsfw_scores;
        setNsfwScores(scores || null);
        const neutralScore = typeof scores?.Neutral === 'number' ? scores.Neutral : 1.0;
        const isNsfwSafe = neutralScore >= 0.50;

        // Only hard-block if strictly flagged as adult/prohibited content
        if (!isNsfwSafe) {
          setIsSafeGarment(false);
          setModerationReason(
            prediction.moderation_reason ||
            'Image blocked by safety check. Please upload an appropriate clothing item.'
          );
          setIsImageVerified(false);
          setCutoutUri(prediction.cutoutDataUri || null);
          setImageUri(prediction.cutoutDataUri || asset.uri);
          setName('Inappropriate Image');
          setCategory('');
          return;
        }

        // Store clean background-removed cutout in imageUri when returned from ml-service
        if (prediction.cutoutDataUri && typeof prediction.cutoutDataUri === 'string') {
          setCutoutUri(prediction.cutoutDataUri);
          setBeautifiedUri(prediction.beautifiedDataUri || null);
          setImageUri(prediction.cutoutDataUri);
        }

        const rawConf =
          typeof prediction.confidence === 'number'
            ? prediction.confidence
            : typeof prediction.categoryConfidence === 'number'
            ? prediction.categoryConfidence
            : 0;

        setConfidence(rawConf);
        setModerationReason(prediction.moderation_reason || null);
        setPalette(prediction.palette || null);
        setColorHarmonyNote(prediction.color_harmony_note || null);
        setSecondaryColor(prediction.secondary_color || undefined);
        setSecondaryColorHex(prediction.secondary_color_hex || null);
        setColorHex(prediction.colorHex || colorNameToHex(prediction.primary_color || prediction.color || 'White'));
        setIsSafeGarment(true);

        const mappedCategory = prediction.category
          ? (CATEGORY_FROM_API[prediction.category.toUpperCase()] || prediction.category)
          : '';

        if (!mappedCategory || rawConf < 0.55 || !!prediction.moderation_reason) {
          setLowConfidenceWarning(true);
          setModerationReason(
            prediction.moderation_reason ||
            'Low classification confidence; please confirm category manually.'
          );
        } else {
          setLowConfidenceWarning(false);
        }

        setIsImageVerified(true);
        const prefill = buildSafeAutoPrefill(prediction);
        applySafePrefill(prefill);
        if (!mappedCategory) {
          setCategory('');
          if (!prediction.suggestedName) {
            setName(`${prediction.primary_color || prediction.color || 'My'} Garment`.trim());
          }
        }
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

        const errMsg =
          err?.message ||
          'Could not connect to ML server — check your API URL / Wi-Fi connection.';
        setError(errMsg);
        setInfoModal({
          visible: true,
          title: 'ML Server Connection Error',
          message: errMsg,
        });
        setIsImageVerified(true);
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

    if (!isSafeGarment) {
      setInfoModal({
        visible: true,
        title: 'Moderation Flag',
        message: moderationReason || 'Image rejected by safety check. Please upload an appropriate clothing item.',
      });
      return;
    }

    if (!category) {
      setInfoModal({
        visible: true,
        title: 'Category Required',
        message: moderationReason || 'Please select a Category from the dropdown before adding to wardrobe.',
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
      const cleanGarmentUri = cutoutUri || beautifiedUri || imageUri || '';
      const image = cleanGarmentUri ? await uploadImage(cleanGarmentUri) : '';
      const parsedPrice = price.trim() ? parseFloat(price.trim()) || 0 : 0;
      await addItem({
        name: name.trim(),
        category,
        subCategory,
        vector_subtype: vectorSubtype,
        layerRole: layerRole || getLayerRoleForCategory(category),
        layer_role: layerRole || getLayerRoleForCategory(category),
        color,
        colorHex,
        secondary_color: secondaryColor,
        secondary_color_hex: secondaryColorHex,
        palette,
        color_harmony_note: colorHarmonyNote,
        brand: brand.trim(),
        material: material.trim(),
        style,
        seasons,
        occasions,
        image,
        originalUri: originalUri || undefined,
        cutoutUri,
        beautifiedUri,
        beautifiedMethod,
        useBeautified,
        confidence,
        moderation_reason: moderationReason,
        isSafeGarment,
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
              source={{
                uri: cutoutUri || beautifiedUri || imageUri,
              }}
              style={styles.photoImage}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="shirt-outline" size={48} color={theme.textMuted} />
          )}

          {imageUri && (
            <View style={styles.previewOverlayBottom}>
              <View
                style={[
                  styles.previewInfoPill,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View
                  style={[
                    styles.previewColorDot,
                    { backgroundColor: colorNameToHex(color) },
                  ]}
                />
                <Text style={[styles.previewInfoPillText, { color: theme.text }]}>
                  ● {color} · {subCategory || category} ({Math.round((confidence || 0) * 100)}%)
                </Text>
              </View>

              {!isSafeGarment ? (
                <View style={[styles.amberWarningPill, { backgroundColor: '#FEE2E2', borderColor: '#DC2626', borderWidth: 1 }]}>
                  <Text style={[styles.amberWarningText, { color: '#B91C1C', fontWeight: '800' }]}>
                    🚫 Moderation Flag: {moderationReason || 'Image rejected by safety check.'}
                  </Text>
                </View>
              ) : (!category || confidence < 0.55 || !!moderationReason) && isImageVerified ? (
                <View style={styles.amberWarningPill}>
                  <Text style={styles.amberWarningText}>
                    ⚠️ Needs Review: {moderationReason || 'Low confidence; please confirm category manually.'}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* 🎨 Extracted CIELAB Palette (K = 2) Card */}
        {imageUri && (
          <CielabPaletteCard
            palette={palette}
            primaryColor={color}
            primaryHex={colorHex}
            secondaryColor={secondaryColor}
            secondaryHex={secondaryColorHex}
            harmonyNote={colorHarmonyNote}
          />
        )}

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
          onChange={(newCat) => {
            const prevCat = category;
            const nextLayerRole = getLayerRoleForCategory(newCat);
            setCategory(newCat);
            setLayerRole(nextLayerRole);

            // Manual Category Edit Sync: If user changes from Outerwear to Tops,
            // replace outer garment terms with T-Shirt and set vector_subtype = 'tshirt'
            if (prevCat === 'Outerwear' && newCat === 'Tops') {
              if (OUTERWEAR_NAME_SUFFIX_REGEX.test(name)) {
                setName(replaceOuterwearSuffixWithTShirt(name));
              }
              if (OUTERWEAR_NAME_SUFFIX_REGEX.test(subCategory) || !subCategory || subCategory === 'Outerwear') {
                setSubCategory('T-Shirt');
              }
              setVectorSubtype('tshirt');
            }

            const neutral = nsfwScores?.Neutral ?? 1.0;
            if (neutral >= 0.50) {
              setIsSafeGarment(true);
              setLowConfidenceWarning(false);
              setIsImageVerified(true);
              setModerationReason(null);
            }
            if (!name || name === 'Non-Wearable Item' || name === 'Inappropriate Image' || name === 'Garment' || name.endsWith(' Garment')) {
              setName(`${color || 'My'} ${newCat}`.trim());
            }
          }}
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
  previewOverlayBottom: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 54,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  previewInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  previewColorDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  previewInfoPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  amberWarningPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  amberWarningText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
});
