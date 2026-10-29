import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../integrations/supabase/client';
import { analyzeClothingImage, ClothingPrediction, Nsfw5ClassScores } from '../services/imageAnalysisService';
import { colorNameToHex } from '../services/outfitRecommendationService';
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
import { RootStackParamList } from '../types';
import CielabPaletteCard from '../components/CielabPaletteCard';
import {
  CanonicalStudioGarmentSvg,
  formatSubtypeLabel,
  inferVectorSubtype,
} from '../utils/garmentImageHelper';

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

export interface BatchDraftWardrobeItem {
  id: string;
  originalUri: string;
  cutoutDataUri: string | null;
  cutoutUri: string | null;
  beautifiedUri: string | null;
  beautifiedMethod?: string | null;
  useBeautified: boolean;
  useCanonicalStudio: boolean;
  name: string;
  category: string;
  subCategory: string;
  vector_subtype: string;
  layerRole: string;
  layer_role?: string;
  color: string;
  colorHex: string;
  secondary_color?: string;
  secondary_color_hex?: string | null;
  palette?: any;
  color_harmony_note?: string | null;
  style: string;
  occasion: string;
  occasions: string[];
  seasons: string[];
  material: string;
  brand: string;
  confidence: number;
  moderation_reason: string | null;
  isSafeGarment: boolean;
  isVerified: boolean;
  analyzing: boolean;
  nsfw_scores?: Partial<Nsfw5ClassScores>;
}

function buildDraftFromPrediction(
  draftId: string,
  originalUri: string,
  prediction: ClothingPrediction | null
): BatchDraftWardrobeItem {
  const rawCategory = prediction?.category || '';
  const category = (rawCategory && CATEGORY_FROM_API[rawCategory.toUpperCase()]) || '';
  const layerRole =
    prediction?.layerRole ||
    prediction?.layer_role ||
    getLayerRoleForCategory(category || 'Tops');

  // Extract color accurately from primary_color, color, or cluster 0 (never default to Black if light/white)
  const cluster0Color = Array.isArray(prediction?.palette) ? prediction?.palette[0]?.color_name : undefined;
  const rawColor = prediction?.primary_color || prediction?.color || cluster0Color || '';
  let detectedColor = '';
  if (rawColor) {
    const matched = COLOR_OPTIONS.find(
      (c) => c.toLowerCase() === rawColor.toLowerCase()
    );
    detectedColor = matched || capitalize(rawColor);
  }
  const colorHex =
    prediction?.colorHex ||
    prediction?.palette?.dominant_hex ||
    (detectedColor ? colorNameToHex(detectedColor) : '#264C3B');
  const normalizedColor = detectedColor || 'White';

  const confidence =
    typeof prediction?.confidence === 'number'
      ? prediction.confidence
      : typeof prediction?.categoryConfidence === 'number'
      ? prediction.categoryConfidence
      : 0;

  const neutralScore =
    typeof prediction?.nsfw_scores?.Neutral === 'number'
      ? prediction.nsfw_scores.Neutral
      : 1.0;
  const isNsfwSafe = neutralScore >= 0.50;

  // Only hard-block if strictly flagged as adult/prohibited content
  if (!isNsfwSafe) {
    return {
      id: draftId,
      originalUri,
      cutoutDataUri: prediction?.cutoutDataUri ?? null,
      cutoutUri: prediction?.cutoutDataUri ?? null,
      beautifiedUri: null,
      beautifiedMethod: null,
      useBeautified: false,
      useCanonicalStudio: false,
      name: 'Inappropriate Content',
      category: '',
      subCategory: '',
      vector_subtype: '',
      layerRole: 'INNER_BASE',
      layer_role: 'INNER_BASE',
      color: detectedColor || '',
      colorHex,
      secondary_color: prediction?.secondary_color,
      secondary_color_hex: prediction?.secondary_color_hex,
      palette: prediction?.palette,
      color_harmony_note: prediction?.color_harmony_note,
      style: 'Casual',
      occasion: 'Casual',
      occasions: ['Casual'],
      seasons: ['All'],
      material: '',
      brand: '',
      confidence,
      moderation_reason:
        prediction?.moderation_reason ||
        'Image rejected by safety check. Please upload appropriate clothing items.',
      isSafeGarment: false,
      isVerified: false,
      analyzing: false,
      nsfw_scores: prediction?.nsfw_scores,
    };
  }

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
  } else if (detectedColor) {
    finalName = `${detectedColor} Garment`;
  } else {
    finalName = 'Garment';
  }

  const vectorSubtype = inferVectorSubtype(
    finalName,
    category || 'Tops',
    prediction?.vector_subtype || prediction?.subCategory || prediction?.sub_category
  );
  const subCategoryLabel = formatSubtypeLabel(vectorSubtype, category || 'Tops');

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

  const isVerified = Boolean(category) && confidence >= 0.55 && !prediction?.moderation_reason;
  const cutoutUri = prediction?.cutoutDataUri ?? null;
  const beautifiedUri = prediction?.beautifiedDataUri ?? null;

  return {
    id: draftId,
    originalUri,
    cutoutDataUri: cutoutUri,
    cutoutUri,
    beautifiedUri,
    beautifiedMethod: (prediction as any)?.beautifiedMethod ?? null,
    useBeautified: false,
    useCanonicalStudio: false,
    name: finalName,
    category: category || '',
    subCategory: subCategoryLabel,
    vector_subtype: vectorSubtype,
    layerRole,
    layer_role: layerRole,
    color: normalizedColor,
    colorHex,
    secondary_color: prediction?.secondary_color,
    secondary_color_hex: prediction?.secondary_color_hex,
    palette: prediction?.palette,
    color_harmony_note: prediction?.color_harmony_note,
    style,
    occasion: occasions[0] || 'Casual',
    occasions,
    seasons: ['All'],
    material: prediction?.material ? capitalize(prediction.material) : 'Cotton',
    brand: '',
    confidence,
    moderation_reason:
      prediction?.moderation_reason ??
      (!category || confidence < 0.55
        ? 'Low classification confidence; please confirm category manually.'
        : null),
    isSafeGarment: true,
    isVerified,
    analyzing: false,
    nsfw_scores: prediction?.nsfw_scores,
  };
}

export default function BatchAddClothesScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BatchAddClothes'>>();
  const { session } = useAuth();
  const { addItem } = useWardrobe();
  const { showToast } = useToast();

  const [draftItems, setDraftItems] = useState<BatchDraftWardrobeItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);
  const [totalToAnalyze, setTotalToAnalyze] = useState(0);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  const [moderationModal, setModerationModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    const initialAssets = route.params?.initialAssets;
    if (initialAssets && initialAssets.length > 0) {
      ingestAssets(initialAssets);
    }
  }, []);

  const ingestAssets = async (
    assets: Array<{ uri: string; width?: number; height?: number; fileName?: string | null }>
  ) => {
    const sliced = assets.slice(0, 15);
    setTotalToAnalyze(sliced.length);
    setAnalyzingIndex(1);

    // Prepare initial draft placeholders so thumbnails appear immediately like TikTok's multi-photo bar
    const placeholders: BatchDraftWardrobeItem[] = sliced.map((asset, idx) => ({
      id: `draft-${Date.now()}-${idx}`,
      originalUri: asset.uri,
      cutoutDataUri: null,
      cutoutUri: null,
      beautifiedUri: null,
      beautifiedMethod: null,
      useBeautified: false,
      useCanonicalStudio: false,
      name: `Analyzing Item #${idx + 1}...`,
      category: 'Tops',
      subCategory: 'Tshirt',
      vector_subtype: 'tshirt',
      layerRole: 'INNER_BASE',
      layer_role: 'INNER_BASE',
      color: 'Gray',
      colorHex: '#7D8597',
      style: 'Casual',
      occasion: 'Casual',
      occasions: ['Casual'],
      seasons: ['All'],
      material: 'Cotton',
      brand: '',
      confidence: 0,
      moderation_reason: null,
      isSafeGarment: true,
      isVerified: false,
      analyzing: true,
    }));

    setDraftItems((prev) => {
      const combined = [...prev, ...placeholders].slice(0, 15);
      return combined;
    });

    // Analyze each selected image and update its draft entry in real time
    for (let i = 0; i < placeholders.length; i++) {
      setAnalyzingIndex(i + 1);
      const placeholder = placeholders[i];
      const rawAsset = sliced[i];

      try {
        let prediction: ClothingPrediction | null = null;
        if (session?.access_token) {
          prediction = await analyzeClothingImage(rawAsset.uri, session.access_token);
        }

        const populated = buildDraftFromPrediction(
          placeholder.id,
          rawAsset.uri,
          prediction
        );

        setDraftItems((prev) =>
          prev.map((item) => (item.id === placeholder.id ? populated : item))
        );
      } catch (err: any) {
        showToast(
          err?.message ||
            'Could not connect to ML server — check your API URL / Wi-Fi connection.'
        );
        const fallback = buildDraftFromPrediction(
          placeholder.id,
          rawAsset.uri,
          null
        );
        fallback.name = 'Unanalyzed Garment';
        fallback.confidence = 0;
        fallback.isVerified = false;
        fallback.analyzing = false;
        setDraftItems((prev) =>
          prev.map((item) => (item.id === placeholder.id ? fallback : item))
        );
      }
    }

    setAnalyzingIndex(null);
  };

  const pickMoreImages = async () => {
    const remaining = Math.max(0, 15 - draftItems.length);
    if (remaining === 0) {
      showToast('Maximum 15 photos per batch reached.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    await ingestAssets(result.assets);
  };

  const removeDraftItem = (id: string) => {
    setDraftItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (selectedIndex >= next.length) {
        setSelectedIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const updateCurrentDraft = (patch: Partial<BatchDraftWardrobeItem>) => {
    const current = draftItems[selectedIndex];
    if (!current) return;
    setDraftItems((prev) =>
      prev.map((item, idx) =>
        idx === selectedIndex
          ? {
              ...item,
              ...patch,
              colorHex: patch.color ? colorNameToHex(patch.color) : item.colorHex,
              isVerified: true,
            }
          : item
      )
    );
  };

  const toggleCurrentArrayField = (field: 'occasions' | 'seasons', value: string) => {
    const current = draftItems[selectedIndex];
    if (!current) return;
    const list = current[field] || [];
    const nextList = list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];
    updateCurrentDraft({
      [field]: nextList.length > 0 ? nextList : [value],
      ...(field === 'occasions' ? { occasion: nextList[0] || value } : {}),
    });
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
    } catch {
      return uri;
    }
  };

  const handleOpenConfirmModal = () => {
    if (draftItems.length === 0 || analyzingIndex !== null) return;

    const validCount = draftItems.filter((d) => d.isSafeGarment !== false && Boolean(d.category)).length;
    if (validCount === 0) {
      showToast('Please select a Category from the dropdown for your items before adding to wardrobe.');
      return;
    }

    for (const item of draftItems) {
      const profanity = containsProfanityOrSlurs(item.name, item.brand, item.material);
      if (profanity.hasProfanity) {
        setModerationModal({
          visible: true,
          title: 'Prohibited Language',
          message:
            profanity.reason ||
            `Item "${item.name}" contains prohibited language. Please revise before saving.`,
        });
        return;
      }
    }

    setConfirmModalVisible(true);
  };

  const handleConfirmBatchSave = async () => {
    setSavingBatch(true);
    try {
      const itemsToSave = draftItems.filter((d) => d.isSafeGarment !== false && Boolean(d.category));
      for (const draft of itemsToSave) {
        const targetUri =
          draft.cutoutDataUri ||
          draft.cutoutUri ||
          draft.beautifiedUri ||
          draft.originalUri ||
          '';
        const uploadedUrl = await uploadImage(targetUri);
        await addItem({
          name: draft.name.trim() || `${draft.color} ${draft.category}`,
          category: draft.category,
          subCategory: draft.subCategory,
          vector_subtype: draft.vector_subtype,
          layerRole: draft.layerRole || getLayerRoleForCategory(draft.category),
          layer_role: draft.layer_role || draft.layerRole || getLayerRoleForCategory(draft.category),
          color: draft.color,
          colorHex: draft.colorHex,
          secondary_color: draft.secondary_color,
          secondary_color_hex: draft.secondary_color_hex,
          palette: draft.palette,
          color_harmony_note: draft.color_harmony_note,
          brand: draft.brand.trim(),
          material: draft.material.trim(),
          style: draft.style,
          seasons: draft.seasons,
          occasions: draft.occasions,
          image: uploadedUrl,
          originalUri: draft.originalUri,
          cutoutUri: draft.cutoutUri,
          beautifiedUri: draft.beautifiedUri,
          beautifiedMethod: draft.beautifiedMethod,
          useBeautified: draft.useBeautified,
          useCanonicalStudio: draft.useCanonicalStudio,
          confidence: draft.confidence,
          moderation_reason: draft.moderation_reason,
          isSafeGarment: draft.isSafeGarment,
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
      }
      setConfirmModalVisible(false);
      showToast(`Added ${itemsToSave.length} items to your wardrobe!`);
      navigation.goBack();
    } catch {
      showToast('Could not save all items. Please check your connection.');
    } finally {
      setSavingBatch(false);
    }
  };

  const activeDraft = draftItems[selectedIndex];
  const isAnalyzingAny = analyzingIndex !== null || draftItems.some((d) => d.analyzing);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Batch Add to Wardrobe
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {draftItems.length} {draftItems.length === 1 ? 'garment' : 'garments'} selected · Tap thumbnail to review
          </Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      {/* 1. Parallel AI Pre-Fill Progress Banner */}
      {isAnalyzingAny && (
        <View
          style={[
            styles.progressBanner,
            { backgroundColor: theme.aiBannerBg, borderColor: theme.aiBannerBorder },
          ]}
        >
          <ActivityIndicator size="small" color={theme.accentText} />
          <Text style={[styles.progressBannerText, { color: theme.aiBannerText }]}>
            Analyzing {analyzingIndex ?? 1} of {totalToAnalyze || draftItems.length} with ResNet-50 & CIELAB K-Means++...
          </Text>
        </View>
      )}

      {/* 2. Top TikTok-Style Horizontal Thumbnail Strip */}
      <View style={[styles.thumbnailStripWrap, { borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailStripScroll}
        >
          {draftItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const previewUri = item.cutoutDataUri || item.originalUri;
            const needsReview = !item.isVerified || item.confidence < 0.55 || !item.isSafeGarment;

            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedIndex(idx)}
                style={[
                  styles.thumbCard,
                  {
                    borderColor: isSelected ? theme.secondaryAccent : theme.border,
                    borderWidth: isSelected ? 2.5 : 1,
                    backgroundColor: '#F8F8FA',
                  },
                ]}
              >
                <Image
                  source={{ uri: previewUri }}
                  style={styles.thumbImage}
                  resizeMode="contain"
                />

                  {/* Remove (×) button */}
                <Pressable
                  onPress={() => removeDraftItem(item.id)}
                  style={styles.thumbRemoveBtn}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={12} color="#FFFFFF" />
                </Pressable>

                {/* Status Badge: 🚫 Blocked vs ✓ Pre-filled vs ! Needs Review */}
                {item.analyzing ? (
                  <View style={[styles.thumbStatusPill, { backgroundColor: '#4B1D6F' }]}>
                    <Text style={styles.thumbStatusText}>•••</Text>
                  </View>
                ) : !item.isSafeGarment ? (
                  <View style={[styles.thumbStatusPill, { backgroundColor: '#DC2626' }]}>
                    <Text style={styles.thumbStatusText}>🚫 Blocked</Text>
                  </View>
                ) : !item.category || needsReview ? (
                  <View style={[styles.thumbStatusPill, { backgroundColor: '#D97706' }]}>
                    <Text style={styles.thumbStatusText}>! Needs Review</Text>
                  </View>
                ) : (
                  <View style={[styles.thumbStatusPill, { backgroundColor: '#2F8F5B' }]}>
                    <Text style={styles.thumbStatusText}>✓ Pre-filled</Text>
                  </View>
                )}
              </Pressable>
            );
          })}

          {draftItems.length < 15 && (
            <Pressable
              onPress={pickMoreImages}
              style={[
                styles.addMoreThumbCard,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            >
              <Ionicons name="add-circle-outline" size={24} color={theme.accentText} />
              <Text style={[styles.addMoreThumbText, { color: theme.accentText }]}>
                + Add Photo
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Selected Item Form Review */}
      {activeDraft ? (
        <ScrollView
          contentContainerStyle={styles.formScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Large Cutout Preview Card */}
          <View style={[styles.previewBox, { backgroundColor: '#F8F8FA', borderColor: theme.border }]}>
            <Image
              source={{
                uri:
                  activeDraft.cutoutDataUri ||
                  activeDraft.cutoutUri ||
                  activeDraft.beautifiedUri ||
                  activeDraft.originalUri,
              }}
              style={styles.previewImage}
              resizeMode="contain"
            />

            <View style={styles.previewCornerRow}>
              <View
                style={[
                  styles.colorPreviewChip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View
                  style={[styles.colorPreviewDot, { backgroundColor: activeDraft.colorHex }]}
                />
                <Text style={[styles.colorPreviewText, { color: theme.text }]}>
                  ● {activeDraft.color} · {activeDraft.subCategory || activeDraft.category} ({Math.round((activeDraft.confidence || 0) * 100)}%)
                </Text>
              </View>

              {!activeDraft.isSafeGarment ? (
                <View style={[styles.amberWarningPill, { backgroundColor: '#FEE2E2', borderColor: '#DC2626', borderWidth: 1 }]}>
                  <Text style={[styles.amberWarningText, { color: '#B91C1C', fontWeight: '800' }]}>
                    🚫 Moderation Flag: {activeDraft.moderation_reason || 'Image rejected by safety check.'}
                  </Text>
                </View>
              ) : (!activeDraft.category || activeDraft.confidence < 0.55 || !!activeDraft.moderation_reason) ? (
                <View style={styles.amberWarningPill}>
                  <Text style={styles.amberWarningText}>
                    ⚠️ Needs Review: {activeDraft.moderation_reason || 'Low classification confidence; please confirm category manually.'}
                  </Text>
                </View>
              ) : null}

              {activeDraft.isSafeGarment && Boolean(activeDraft.category) && (!activeDraft.isVerified || activeDraft.confidence < 0.55) && (
                <Pressable
                  onPress={() => updateCurrentDraft({ isVerified: true, confidence: activeDraft.confidence > 0 ? activeDraft.confidence : 1.0, moderation_reason: null })}
                  style={[styles.markVerifiedBtn, { backgroundColor: '#2F8F5B' }]}
                >
                  <Text style={styles.markVerifiedBtnText}>✓ Mark Reviewed</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* 🎨 Extracted CIELAB Palette (K = 2) Card */}
          <CielabPaletteCard
            palette={activeDraft.palette}
            primaryColor={activeDraft.color}
            primaryHex={activeDraft.colorHex}
            secondaryColor={activeDraft.secondary_color}
            secondaryHex={activeDraft.secondary_color_hex}
            harmonyNote={activeDraft.color_harmony_note}
          />

          <TextField
            label={`Item #${selectedIndex + 1} Name *`}
            value={activeDraft.name}
            onChangeText={(text) => updateCurrentDraft({ name: text })}
            placeholder="e.g. Navy Polo Shirt"
          />

          <SelectField
            label="Category"
            value={activeDraft.category}
            options={ALLOWED_CATEGORIES}
            onChange={(val) => {
              const prevCat = activeDraft.category;
              const nextLayerRole = getLayerRoleForCategory(val);
              const neutral = activeDraft.nsfw_scores?.Neutral ?? 1.0;
              const isSafe = neutral >= 0.50;

              let updatedName = activeDraft.name;
              let updatedSubCategory = activeDraft.subCategory;
              let updatedVectorSubtype = activeDraft.vector_subtype;

              // Manual Category Edit Sync: If user changes from Outerwear to Tops,
              // replace outer garment terms with T-Shirt and set vector_subtype = 'tshirt'
              if (prevCat === 'Outerwear' && val === 'Tops') {
                if (OUTERWEAR_NAME_SUFFIX_REGEX.test(updatedName)) {
                  updatedName = replaceOuterwearSuffixWithTShirt(updatedName);
                }
                if (OUTERWEAR_NAME_SUFFIX_REGEX.test(updatedSubCategory) || !updatedSubCategory || updatedSubCategory === 'Outerwear') {
                  updatedSubCategory = 'T-Shirt';
                }
                updatedVectorSubtype = 'tshirt';
              }

              if (
                !updatedName ||
                updatedName === 'Non-Wearable Item' ||
                updatedName === 'Garment' ||
                updatedName.endsWith(' Garment') ||
                updatedName === 'Inappropriate Content'
              ) {
                updatedName = `${activeDraft.color || 'My'} ${val}`.trim();
              }

              updateCurrentDraft({
                category: val,
                layerRole: nextLayerRole,
                layer_role: nextLayerRole,
                name: updatedName,
                subCategory: updatedSubCategory,
                vector_subtype: updatedVectorSubtype,
                isSafeGarment: isSafe,
                isVerified: true,
                moderation_reason: isSafe ? null : activeDraft.moderation_reason,
              });
            }}
            required
          />

          <SelectField
            label="Color"
            value={activeDraft.color}
            options={COLOR_OPTIONS}
            onChange={(val) => updateCurrentDraft({ color: val })}
          />

          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Brand"
                value={activeDraft.brand}
                onChangeText={(val) => updateCurrentDraft({ brand: val })}
                placeholder="Optional"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <TextField
                label="Material"
                value={activeDraft.material}
                onChangeText={(val) => updateCurrentDraft({ material: val })}
                placeholder="Optional"
              />
            </View>
          </View>

          <SelectField
            label="Style"
            value={activeDraft.style}
            options={STYLE_OPTIONS}
            onChange={(val) => updateCurrentDraft({ style: val })}
          />

          <ChipGroup
            label="Occasions"
            options={THESIS_OCCASIONS}
            selected={activeDraft.occasions}
            onToggle={(val) => toggleCurrentArrayField('occasions', val)}
          />

          <ChipGroup
            label="Seasons"
            options={SEASON_OPTIONS}
            selected={activeDraft.seasons}
            onToggle={(val) => toggleCurrentArrayField('seasons', val)}
          />
        </ScrollView>
      ) : (
        <View style={styles.emptyBatchState}>
          <Ionicons name="images-outline" size={44} color={theme.textMuted} />
          <Text style={[styles.emptyBatchTitle, { color: theme.text }]}>
            No Photos in Batch
          </Text>
          <Pressable
            onPress={pickMoreImages}
            style={[styles.pickPhotosBtn, { backgroundColor: theme.secondaryAccent }]}
          >
            <Text style={[styles.pickPhotosBtnText, { color: theme.onAccent }]}>
              Select Clothing Photos
            </Text>
          </Pressable>
        </View>
      )}

      {/* 3. Bottom Primary Button: "✨ Confirm & Add All (N) to Wardrobe" */}
      {draftItems.length > 0 && (
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
          ]}
        >
          <Pressable
            disabled={isAnalyzingAny || savingBatch}
            onPress={handleOpenConfirmModal}
            style={[
              styles.confirmBatchButton,
              {
                backgroundColor: theme.secondaryAccent,
                opacity: isAnalyzingAny || savingBatch ? 0.55 : 1,
              },
            ]}
          >
            <Text style={[styles.confirmBatchButtonText, { color: theme.onAccent }]}>
              {isAnalyzingAny
                ? 'Analyzing Batch...'
                : `✨ Confirm & Add All (${draftItems.length}) to Wardrobe`}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Batch Confirmation Prompt Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.confirmModalCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.confirmModalHeader}>
              <View style={[styles.confirmIconWrap, { backgroundColor: '#2F8F5B1F' }]}>
                <Ionicons name="checkmark-done-circle" size={24} color="#2F8F5B" />
              </View>
              <Text style={[styles.confirmModalTitle, { color: theme.text }]}>
                Confirm Batch Upload
              </Text>
            </View>

            <Text style={[styles.confirmModalMessage, { color: theme.textMuted }]}>
              Are all {draftItems.length} pre-filled garment details correct? This will add{' '}
              {draftItems.length} {draftItems.length === 1 ? 'item' : 'items'} directly to your
              Wardrobe.
            </Text>

            {/* Compact summary list of items to be added */}
            <ScrollView
              style={styles.summaryListScroll}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {draftItems.map((item, idx) => (
                <View
                  key={item.id}
                  style={[
                    styles.summaryItemRow,
                    { backgroundColor: theme.background, borderColor: theme.border },
                  ]}
                >
                  <Image
                    source={{ uri: item.cutoutDataUri || item.originalUri }}
                    style={styles.summaryItemThumb}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.summaryItemName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {idx + 1}. {item.name}
                    </Text>
                    <Text style={[styles.summaryItemMeta, { color: theme.textMuted }]}>
                      {item.category} · {item.color} · {item.style}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={18} color="#2F8F5B" />
                </View>
              ))}
            </ScrollView>

            <View style={styles.confirmModalActions}>
              <Pressable
                disabled={savingBatch}
                onPress={() => setConfirmModalVisible(false)}
                style={[
                  styles.reviewAgainButton,
                  { borderColor: theme.border, backgroundColor: theme.background },
                ]}
              >
                <Text style={[styles.reviewAgainButtonText, { color: theme.text }]}>
                  Review Again
                </Text>
              </Pressable>

              <Pressable
                disabled={savingBatch}
                onPress={handleConfirmBatchSave}
                style={[
                  styles.yesAddAllButton,
                  { backgroundColor: theme.secondaryAccent, opacity: savingBatch ? 0.6 : 1 },
                ]}
              >
                {savingBatch ? (
                  <ActivityIndicator size="small" color={theme.onAccent} />
                ) : (
                  <Text style={[styles.yesAddAllButtonText, { color: theme.onAccent }]}>
                    Yes, Add All to Wardrobe
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialogModal
        visible={moderationModal.visible}
        variant="moderation"
        title={moderationModal.title}
        message={moderationModal.message}
        confirmText="Understood"
        showCancel={false}
        onConfirm={() => setModerationModal({ visible: false, title: '', message: '' })}
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
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSubtitle: { fontSize: 11.5, marginTop: 1 },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  progressBannerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  thumbnailStripWrap: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  thumbnailStripScroll: {
    paddingHorizontal: 18,
    gap: 10,
    alignItems: 'center',
  },
  thumbCard: {
    width: 82,
    height: 98,
    borderRadius: 14,
    padding: 4,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '76%',
  },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbStatusPill: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    right: 3,
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  thumbStatusText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  addMoreThumbCard: {
    width: 82,
    height: 98,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addMoreThumbText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  formScrollContent: {
    padding: 18,
    gap: 16,
    paddingBottom: 110,
  },
  previewBox: {
    height: 200,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCornerRow: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  colorPreviewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  colorPreviewText: {
    fontSize: 11,
    fontWeight: '700',
  },
  markVerifiedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  markVerifiedBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  twoColRow: {
    flexDirection: 'row',
  },
  emptyBatchState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyBatchTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickPhotosBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  pickPhotosBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  confirmBatchButton: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBatchButtonText: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  confirmModalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    maxHeight: '80%',
  },
  confirmModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  confirmModalMessage: {
    fontSize: 13,
    lineHeight: 18.5,
  },
  summaryListScroll: {
    maxHeight: 230,
  },
  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryItemThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F8F8FA',
  },
  summaryItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryItemMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  reviewAgainButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAgainButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  yesAddAllButton: {
    flex: 1.4,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesAddAllButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  amberWarningPill: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  amberWarningText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
  },
});

