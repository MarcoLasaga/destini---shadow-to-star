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
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useAuth } from '../contexts/AuthContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../integrations/supabase/client';
import { analyzeClothingImage, ClothingPrediction } from '../services/imageAnalysisService';
import { colorNameToHex } from '../services/outfitRecommendationService';
import { containsProfanityOrSlurs } from '../services/communityService';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
import TextField from '../components/TextField';
import SelectField from '../components/SelectField';
import ChipGroup from '../components/ChipGroup';
import { COLOR_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS } from '../constants/wardrobeMockData';
import { RootStackParamList } from '../types';

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
  name: string;
  category: string;
  color: string;
  colorHex: string;
  style: string;
  occasion: string;
  occasions: string[];
  seasons: string[];
  material: string;
  brand: string;
  confidence: number;
  isSafeGarment: boolean;
  isVerified: boolean;
  analyzing: boolean;
}

function buildDraftFromPrediction(
  draftId: string,
  originalUri: string,
  prediction: ClothingPrediction | null
): BatchDraftWardrobeItem {
  let detectedColor = 'Gray';
  if (prediction?.color) {
    const matched = COLOR_OPTIONS.find(
      (c) => c.toLowerCase() === prediction.color!.toLowerCase()
    );
    detectedColor = matched || capitalize(prediction.color);
  }
  const normalizedColor = COLOR_OPTIONS.includes(detectedColor as any) ? detectedColor : 'Gray';
  const colorHex =
    prediction?.palette?.dominant_hex || colorNameToHex(normalizedColor);

  const rawCategory = prediction?.category || '';
  const category = (rawCategory && CATEGORY_FROM_API[rawCategory.toUpperCase()]) || 'Tops';

  const rawSuggested = (prediction?.suggestedName || '').trim();
  const isGenericUppercase =
    !rawSuggested ||
    /^(TOP|BOTTOM|SHOES|OUTERWEAR|ACCESSORIES|ITEM)$/i.test(rawSuggested);

  const finalName = !isGenericUppercase
    ? rawSuggested
        .split(/\s+/)
        .map((w) => capitalize(w))
        .join(' ')
    : `${normalizedColor} ${rawCategory ? capitalize(rawCategory) : 'Item'}`;

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

  const confidence = prediction?.categoryConfidence ?? prediction?.confidence ?? 0.88;
  const isSafeGarment = prediction?.is_safe_garment !== false;
  const isVerified = isSafeGarment && confidence >= 0.55;

  return {
    id: draftId,
    originalUri,
    cutoutDataUri: prediction?.cutoutDataUri ?? null,
    name: finalName,
    category,
    color: normalizedColor,
    colorHex,
    style,
    occasion: occasions[0] || 'Casual',
    occasions,
    seasons: ['All'],
    material: prediction?.material ? capitalize(prediction.material) : 'Cotton',
    brand: '',
    confidence,
    isSafeGarment,
    isVerified,
    analyzing: false,
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
    const sliced = assets.slice(0, 10);
    setTotalToAnalyze(sliced.length);
    setAnalyzingIndex(1);

    // Prepare initial draft placeholders so thumbnails appear immediately like TikTok's multi-photo bar
    const placeholders: BatchDraftWardrobeItem[] = sliced.map((asset, idx) => ({
      id: `draft-${Date.now()}-${idx}`,
      originalUri: asset.uri,
      cutoutDataUri: null,
      name: `Analyzing Item #${idx + 1}...`,
      category: 'Tops',
      color: 'Gray',
      colorHex: '#7D8597',
      style: 'Casual',
      occasion: 'Casual',
      occasions: ['Casual'],
      seasons: ['All'],
      material: 'Cotton',
      brand: '',
      confidence: 0.9,
      isSafeGarment: true,
      isVerified: false,
      analyzing: true,
    }));

    setDraftItems((prev) => {
      const combined = [...prev, ...placeholders].slice(0, 10);
      return combined;
    });

    // Analyze each selected image and update its draft entry in real time
    for (let i = 0; i < placeholders.length; i++) {
      setAnalyzingIndex(i + 1);
      const placeholder = placeholders[i];
      const rawAsset = sliced[i];

      try {
        const w = rawAsset.width || 1000;
        const h = rawAsset.height || 1200;
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
        const processed = await manipulateAsync(
          rawAsset.uri,
          [{ resize: { width: Math.round(w * scale), height: Math.round(h * scale) } }],
          { compress: 0.86, format: SaveFormat.JPEG }
        );

        let prediction: ClothingPrediction | null = null;
        if (session?.access_token) {
          prediction = await analyzeClothingImage(processed.uri, session.access_token);
        }

        const populated = buildDraftFromPrediction(
          placeholder.id,
          processed.uri,
          prediction
        );

        setDraftItems((prev) =>
          prev.map((item) => (item.id === placeholder.id ? populated : item))
        );
      } catch {
        const fallback = buildDraftFromPrediction(
          placeholder.id,
          rawAsset.uri,
          null
        );
        // Mark fallback items with confidence 0.52 so user sees "! Needs Review" badge
        fallback.confidence = 0.52;
        fallback.isVerified = false;
        setDraftItems((prev) =>
          prev.map((item) => (item.id === placeholder.id ? fallback : item))
        );
      }
    }

    setAnalyzingIndex(null);
  };

  const pickMoreImages = async () => {
    const remaining = Math.max(0, 10 - draftItems.length);
    if (remaining === 0) {
      showToast('Maximum 10 photos per batch reached.');
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
      const itemsToSave = draftItems.filter((d) => d.isSafeGarment !== false);
      for (const draft of itemsToSave) {
        const targetUri = draft.cutoutDataUri || draft.originalUri;
        const uploadedUrl = await uploadImage(targetUri);
        await addItem({
          name: draft.name.trim() || `${draft.color} ${draft.category}`,
          category: draft.category,
          color: draft.color,
          brand: draft.brand.trim(),
          material: draft.material.trim(),
          style: draft.style,
          seasons: draft.seasons,
          occasions: draft.occasions,
          image: uploadedUrl,
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

                {/* Status Badge: ✓ Pre-filled vs ! Needs Review */}
                {item.analyzing ? (
                  <View style={[styles.thumbStatusPill, { backgroundColor: '#4B1D6F' }]}>
                    <Text style={styles.thumbStatusText}>•••</Text>
                  </View>
                ) : needsReview ? (
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

          {draftItems.length < 10 && (
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
              source={{ uri: activeDraft.cutoutDataUri || activeDraft.originalUri }}
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
                  {activeDraft.color} · {Math.round(activeDraft.confidence * 100)}% Match
                </Text>
              </View>

              {(!activeDraft.isVerified || activeDraft.confidence < 0.55) && (
                <Pressable
                  onPress={() => updateCurrentDraft({ isVerified: true, confidence: 0.9 })}
                  style={[styles.markVerifiedBtn, { backgroundColor: '#2F8F5B' }]}
                >
                  <Text style={styles.markVerifiedBtnText}>✓ Mark Reviewed</Text>
                </Pressable>
              )}
            </View>
          </View>

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
            onChange={(val) => updateCurrentDraft({ category: val })}
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
});

