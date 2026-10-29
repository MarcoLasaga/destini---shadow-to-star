import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image as RNImage,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useOutfit } from '../contexts/OutfitContext';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { useToast } from '../contexts/ToastContext';
import { useWeather } from '../hooks/useWeather';
import OccasionDropdown from '../components/OccasionDropdown';
import AltaOutfitCollage from '../components/AltaOutfitCollage';
import OutfitCustomizeModal from '../components/OutfitCustomizeModal';
import FullBodyTryOnModal from '../components/FullBodyTryOnModal';
import { MelMascot, MelSpeechBubble, melOutfitForOccasion } from '../components/MelMascot';
import { GeneratedOutfit, OutfitClothingItem } from '../types';
import {
  classifyAnatomicalSlot,
  colorNameToHex,
  inferAccessoryZone,
} from '../services/outfitRecommendationService';
import { triggerWeatherAlertOncePerSession } from '../services/notificationService';
import { DATASET_GARMENT_CATALOG } from '../data/datasetGarmentCatalog';
import {
  MiniGarmentSvg,
  resolveGarmentImageUrl,
} from '../utils/garmentImageHelper';
import { computeAccurateOutfitScore } from '../services/hybridScoreService';
import { requestTryOn2D } from '../services/imageAnalysisService';
import { publishOutfit } from '../services/communityService';

const PRIVATE_FULLBODY_URI_KEY = '@stylesense_private_fullbody_uri';
const PRIVATE_FULLBODY_BASE64_KEY = '@stylesense_fullbody_base64';
const PRIVATE_FULLBODY_VERIFIED_KEY = '@stylesense_fullbody_verified';
const VTON_SIGNATURE_CACHE_KEY = '@stylesense_vton_sig_cache_v1';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export type OutfitSlotKey = 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES';

const toAnatomical = (slot: OutfitSlotKey) =>
  slot === 'OUTERWEAR'
    ? 'outerLayer'
    : slot === 'BOTTOM'
    ? 'bottom'
    : slot === 'SHOES'
    ? 'shoes'
    : slot === 'ACCESSORIES'
    ? 'accessory'
    : 'innerTop';

const PERMANENT_RANKS = ['TOP 1', 'TOP 2', 'TOP 3'] as const;

const ROLE_BADGES = [
  '🌦️ Rank #1 Weather-Smart',
  '👕 Rank #2 Your Signature Comfort',
  '✨ Rank #3 Fresh Mix',
] as const;

const getSlotRank = (item?: { category?: string; slotType?: string; name?: string } | null): number => {
  if (!item) return 99;
  const slot = (item.slotType || classifyAnatomicalSlot(item.name || '', item.category)).toLowerCase();
  const cat = (item.category || '').toUpperCase();
  if (slot === 'innertop' || cat === 'TOP' || cat.includes('TOP')) return 1;
  if (slot === 'outerlayer' || cat === 'OUTERWEAR' || cat.includes('OUTER')) return 2;
  if (slot === 'bottom' || cat === 'BOTTOM' || cat.includes('BOTTOM')) return 3;
  if (slot === 'shoes' || cat === 'SHOES' || cat.includes('SHOE')) return 4;
  if (slot === 'accessory' || cat === 'ACCESSORIES' || cat.includes('ACCESSOR')) return 5;
  return 3;
};

const getSlotOrderedLabel = (item?: { category?: string; slotType?: string; name?: string } | null): string => {
  const rank = getSlotRank(item);
  if (rank === 1) return '1. TOP';
  if (rank === 2) return '2. OUTERWEAR';
  if (rank === 3) return '3. BOTTOM';
  if (rank === 4) return '4. SHOES';
  return '5. ACCESSORY';
};

const buildOutfitSignature = (photoSource: string, outfit?: GeneratedOutfit | null): string => {
  if (!outfit || !photoSource) return '';
  const photoHash = photoSource.slice(-42);
  const itemSig = (outfit.clothingItems || [])
    .map((ci) => `${ci.id || ci.name}_${ci.category || ''}`)
    .sort()
    .join('|');
  return `${photoHash}::${outfit.id || 'o'}::${itemSig}`;
};

export default function OutfitScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { items } = useWardrobe();
  const { profile, updateProfile } = useProfile();
  const { session } = useAuth();
  const community = useCommunity();
  const { showToast } = useToast();
  const { weather } = useWeather();
  const {
    occasion,
    setOccasion,
    outfitSourceMode,
    setOutfitSourceMode,
    currentOutfits,
    currentOutfit,
    isLoading,
    generateOutfit,
    toggleFavorite,
    toggleSave,
    submitPreferenceEvent,
    updateOutfitEverywhere,
  } = useOutfit();

  const [activeIndex, setActiveIndex] = useState(0);
  const [customizing, setCustomizing] = useState(false);
  const [fullBodyModalVisible, setFullBodyModalVisible] = useState(false);
  const [seeItOnMeVisible, setSeeItOnMeVisible] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Full-body photo & verification state
  const [fullBodyPhotoUri, setFullBodyPhotoUri] = useState<string | null>(
    profile?.userFullBodyPhotoUri || null
  );
  const [userFullBodyPhotoBase64, setUserFullBodyPhotoBase64] = useState<string | null>(null);
  const [isFullBodyPhotoVerified, setIsFullBodyPhotoVerified] = useState<boolean>(false);

  // Sequential VTON cache by outfit index (0 -> Top 1, 1 -> Top 2, 2 -> Top 3) + persistent signature map
  const [vtonCacheByOutfitIndex, setVtonCacheByOutfitIndex] = useState<Record<number, string>>({});
  const [vtonSignatureCache, setVtonSignatureCache] = useState<Record<string, string>>({});
  const [isPreloadingVton, setIsPreloadingVton] = useState<boolean>(false);
  const preloadRunIdRef = useRef(0);

  const [wardrobeOutfits, setWardrobeOutfits] = useState<GeneratedOutfit[]>([]);
  const [mixOutfits, setMixOutfits] = useState<GeneratedOutfit[]>([]);
  const [reaction, setReaction] = useState(
    'Mel is balancing your colors, proportions, and today’s weather.'
  );

  // Load persisted full-body photo, verification status, and VTON signature cache on mount
  useEffect(() => {
    (async () => {
      try {
        const [storedUri, storedBase64, storedVerified, storedSigCache] = await Promise.all([
          AsyncStorage.getItem(PRIVATE_FULLBODY_URI_KEY),
          AsyncStorage.getItem(PRIVATE_FULLBODY_BASE64_KEY),
          AsyncStorage.getItem(PRIVATE_FULLBODY_VERIFIED_KEY),
          AsyncStorage.getItem(VTON_SIGNATURE_CACHE_KEY),
        ]);

        if (storedUri) {
          setFullBodyPhotoUri(storedUri);
        } else if (profile?.userFullBodyPhotoUri) {
          setFullBodyPhotoUri(profile.userFullBodyPhotoUri);
        }

        if (storedBase64) {
          setUserFullBodyPhotoBase64(storedBase64);
        }

        if (storedVerified === 'true' && (storedUri || storedBase64 || profile?.userFullBodyPhotoUri)) {
          setIsFullBodyPhotoVerified(true);
        }

        if (storedSigCache) {
          const parsed = JSON.parse(storedSigCache);
          if (parsed && typeof parsed === 'object') {
            setVtonSignatureCache(parsed);
          }
        }
      } catch {
        // Non-fatal
      }
    })();
  }, [profile?.userFullBodyPhotoUri]);

  useEffect(() => {
    if (!currentOutfit && !isLoading) {
      generateOutfit();
    }
  }, [currentOutfit, isLoading, generateOutfit]);

  useEffect(() => {
    if (weather) {
      triggerWeatherAlertOncePerSession(
        weather.tempC ?? 28,
        weather.condition,
        weather.location
      );
    }
  }, [weather]);

  useEffect(() => {
    const index = currentOutfits.findIndex((outfit) => outfit.id === currentOutfit?.id);
    if (index >= 0) setActiveIndex(index);
  }, [currentOutfit?.id, currentOutfits]);

  // Check if wardrobe has minimum required pieces (Top + Bottom + Shoes)
  const hasTop = useMemo(
    () =>
      items.some((i) => {
        const cat = (i.category || '').toUpperCase().trim();
        const name = (i.name || '').toLowerCase();
        return cat.startsWith('TOP') || /shirt|tee|polo|blouse|top|crewneck|tank/.test(name);
      }),
    [items]
  );

  const hasBottom = useMemo(
    () =>
      items.some((i) => {
        const cat = (i.category || '').toUpperCase().trim();
        const name = (i.name || '').toLowerCase();
        return cat.startsWith('BOTTOM') || /pant|jean|short|skirt|trouser|chino/.test(name);
      }),
    [items]
  );

  const hasShoes = useMemo(
    () =>
      items.some((i) => {
        const cat = (i.category || '').toUpperCase().trim();
        const name = (i.name || '').toLowerCase();
        return cat.startsWith('SHOE') || /shoe|sneaker|boot|loafer|sandal|heel/.test(name);
      }),
    [items]
  );

  const hasCompleteWardrobe = hasTop && hasBottom && hasShoes && items.length >= 3;
  const sourceMode: 'wardrobe' | 'mix' = outfitSourceMode === 'closet' ? 'wardrobe' : 'mix';

  // Dynamically compute deterministic hybrid score for all top-3 outfits
  const scoredCurrentOutfits = useMemo(() => {
    return currentOutfits.slice(0, 3).map((outfit) => {
      const calculatedScore = computeAccurateOutfitScore(
        outfit.clothingItems || [],
        profile,
        weather,
        occasion
      );
      return {
        ...outfit,
        hybridScore: calculatedScore,
        matchPercent: calculatedScore,
      };
    });
  }, [currentOutfits, profile, weather, occasion]);

  useEffect(() => {
    if (sourceMode === 'wardrobe') {
      if (hasCompleteWardrobe) {
        setWardrobeOutfits(scoredCurrentOutfits);
      } else {
        setWardrobeOutfits([]);
      }
    } else {
      setMixOutfits(scoredCurrentOutfits);
    }
  }, [sourceMode, hasCompleteWardrobe, scoredCurrentOutfits]);

  const displayedOutfits = sourceMode === 'wardrobe' ? wardrobeOutfits : mixOutfits;
  const top3 = useMemo(() => displayedOutfits.slice(0, 3), [displayedOutfits]);
  const activeOutfit = top3[activeIndex] || (sourceMode === 'mix' ? currentOutfit : null);
  const catalogOnly = items.length === 0;
  const showEmptyWardrobePrompt = sourceMode === 'wardrobe' && displayedOutfits.length === 0;

  const photoSourceForVton = userFullBodyPhotoBase64 || fullBodyPhotoUri;

  // Normalize outfit items for POST /try-on-2d
  const normalizeItemsForVton = useCallback((garments: OutfitClothingItem[] = []) => {
    return garments.map((ci: any) => ({
      id: ci.id || ci._id,
      name: ci.name || ci.clothing_name,
      clothing_name: ci.clothing_name || ci.name,
      category: ci.category,
      image: resolveGarmentImageUrl(ci) || ci.image || ci.image_url,
      image_url: resolveGarmentImageUrl(ci) || ci.image_url || ci.image,
      color: ci.color || ci.primary_color,
      style: ci.style,
    }));
  }, []);

  // Sequential Background VTON Pre-Loading for ALL Recommended Outfits (Top 1 -> Top 2 -> Top 3)
  useEffect(() => {
    if (!isFullBodyPhotoVerified || !photoSourceForVton || top3.length === 0) {
      return;
    }

    const runId = ++preloadRunIdRef.current;

    const preloadAllOutfitsVton = async () => {
      setIsPreloadingVton(true);

      // Step 1: Hydrate any outfits already in persistent signature cache immediately (0ms)
      const initialHits: Record<number, string> = {};
      for (let idx = 0; idx < top3.length; idx++) {
        const sig = buildOutfitSignature(photoSourceForVton, top3[idx]);
        if (sig && vtonSignatureCache[sig]) {
          initialHits[idx] = vtonSignatureCache[sig];
        }
      }
      if (Object.keys(initialHits).length > 0 && preloadRunIdRef.current === runId) {
        setVtonCacheByOutfitIndex((prev) => ({ ...prev, ...initialHits }));
      }

      // Step 2: Sequentially pre-load remaining uncached outfits (idx = 0 -> 1 -> 2)
      for (let idx = 0; idx < top3.length; idx++) {
        if (preloadRunIdRef.current !== runId) return;

        const outfit = top3[idx];
        const sig = buildOutfitSignature(photoSourceForVton, outfit);
        if (initialHits[idx] || (sig && vtonSignatureCache[sig])) {
          continue;
        }

        try {
          const res = await requestTryOn2D(
            photoSourceForVton,
            normalizeItemsForVton(outfit.clothingItems || []),
            session?.access_token,
            65000
          );

          if (preloadRunIdRef.current !== runId) return;

          if (res?.compositeDataUri) {
            setVtonCacheByOutfitIndex((prev) => ({
              ...prev,
              [idx]: res.compositeDataUri!,
            }));

            if (sig) {
              setVtonSignatureCache((prev) => {
                const updated = { ...prev, [sig]: res.compositeDataUri! };
                // Keep signature cache bounded to last 12 composites
                const keys = Object.keys(updated);
                if (keys.length > 12) {
                  delete updated[keys[0]];
                }
                AsyncStorage.setItem(VTON_SIGNATURE_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
                return updated;
              });
            }
          }
        } catch {
          // Continue to next outfit in queue
        }
      }

      if (preloadRunIdRef.current === runId) {
        setIsPreloadingVton(false);
      }
    };

    preloadAllOutfitsVton();
  }, [
    isFullBodyPhotoVerified,
    photoSourceForVton,
    top3,
    session?.access_token,
    normalizeItemsForVton,
  ]);

  const preloadedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < top3.length; i++) {
      if (vtonCacheByOutfitIndex[i]) count++;
    }
    return count;
  }, [top3.length, vtonCacheByOutfitIndex]);

  // Handle tapping "See It On Me" pill in the ALTA action bar
  const handlePressSeeItOnMe = () => {
    if (!isFullBodyPhotoVerified || !photoSourceForVton) {
      setFullBodyModalVisible(true);
      return;
    }
    setSeeItOnMeVisible(true);
  };

  // Called once FullBodyTryOnModal verifies head-to-toe standing photo via POST /verify-full-body
  const handleFullBodyPhotoSaved = async (uri: string, base64DataUri?: string) => {
    const cleanBase64 = base64DataUri || uri;
    setFullBodyPhotoUri(uri);
    setUserFullBodyPhotoBase64(cleanBase64);
    setIsFullBodyPhotoVerified(true);
    setVtonCacheByOutfitIndex({});

    await Promise.all([
      AsyncStorage.setItem(PRIVATE_FULLBODY_URI_KEY, uri).catch(() => {}),
      AsyncStorage.setItem(PRIVATE_FULLBODY_BASE64_KEY, cleanBase64).catch(() => {}),
      AsyncStorage.setItem(PRIVATE_FULLBODY_VERIFIED_KEY, 'true').catch(() => {}),
      updateProfile({ userFullBodyPhotoUri: uri }).catch(() => {}),
    ]);

    showToast('✨ Full-body standing photo verified! Unlocking See It On Me...');
    setSeeItOnMeVisible(true);
  };

  // Horizontal swipe gesture on the ALTA studio canvas to flip between TOP 1, TOP 2, TOP 3
  const horizontalSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
        onPanResponderRelease: (_, gesture) => {
          if (top3.length <= 1) return;
          if (gesture.dx < -35) {
            setActiveIndex((prev) => (prev + 1) % top3.length);
          } else if (gesture.dx > 35) {
            setActiveIndex((prev) => (prev - 1 + top3.length) % top3.length);
          }
        },
      }),
    [top3.length]
  );

  // Combined suggestions for customizer (combining user wardrobe + dataset catalog)
  const allSuggestions = useMemo(() => {
    const fromWardrobe: OutfitClothingItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category as any,
      image: item.useBeautified && item.beautifiedUri ? item.beautifiedUri : item.image,
      color: item.color,
      hexColor: colorNameToHex(item.color),
      slotType: classifyAnatomicalSlot(item.name, item.category),
      status: item.status,
      isSuggested: false,
    }));

    const fromDataset: OutfitClothingItem[] = DATASET_GARMENT_CATALOG.map((ds) => ({
      id: ds.id,
      name: ds.name,
      category: ds.category,
      image: ds.imageUri,
      color: ds.color,
      hexColor: ds.colorHex,
      slotType: ds.slotType,
      isSuggested: true,
    }));

    const fromOutfits = currentOutfits.flatMap((outfit) => outfit.clothingItems || []);

    const unique = new Map<string, OutfitClothingItem>();
    [...fromWardrobe, ...fromDataset, ...fromOutfits].forEach((item) => {
      if (item && item.id && item.name) {
        unique.set(item.id, item);
      }
    });

    return Array.from(unique.values());
  }, [items, currentOutfits]);

  const chooseItem = (item: OutfitClothingItem | null, slot: OutfitSlotKey) => {
    if (!activeOutfit) return;
    const anatomical = toAnatomical(slot);

    let nextItems: OutfitClothingItem[];
    if (slot === 'ACCESSORIES' && item) {
      const itemZone = inferAccessoryZone(item);
      nextItems = (activeOutfit.clothingItems || []).filter((entry) => {
        const isAcc =
          (entry.slotType || classifyAnatomicalSlot(entry.name, entry.category)) === 'accessory';
        if (!isAcc) return true;
        return inferAccessoryZone(entry) !== itemZone;
      });
      nextItems.push({ ...item, slotType: 'accessory' as any });
    } else {
      nextItems = (activeOutfit.clothingItems || []).filter(
        (entry) =>
          (entry.slotType || classifyAnatomicalSlot(entry.name, entry.category)) !== anatomical
      );
      if (item) {
        nextItems.push({ ...item, slotType: anatomical as any });
      }
    }

    const nextScore = computeAccurateOutfitScore(nextItems, profile, weather, occasion);

    // Clear VTON cache entry for activeIndex so the updated piece triggers a fresh VTON render
    setVtonCacheByOutfitIndex((prev) => {
      const copy = { ...prev };
      delete copy[activeIndex];
      return copy;
    });

    updateOutfitEverywhere(activeOutfit.id, {
      clothingItems: nextItems,
      hybridScore: nextScore,
      matchPercent: nextScore,
      contentScore: nextScore + 1,
      collaborativeScore: nextScore - 1,
    });

    if (item) {
      setReaction(
        `Swapped in ${item.name.toLowerCase()} for your ${
          occasion === 'Any occasion' ? 'everyday' : occasion.toLowerCase()
        } look. Match score is now ${nextScore}%!`
      );
    } else {
      setReaction(`Updated pieces. Live outfit match score is now ${nextScore}%.`);
    }
  };

  useEffect(() => {
    if (activeOutfit) {
      const s = activeOutfit.hybridScore ?? activeOutfit.matchPercent ?? 88;
      setReaction(
        `${activeOutfit.name || 'Curated Look'} (${s}% match) — styled for ${
          occasion === 'Any occasion' ? 'everyday wear' : occasion
        } with balanced CIELAB harmony.`
      );
    }
  }, [activeOutfit?.id, occasion]);

  // ALTA Left Action Bar Handlers
  const handleToggleLikeSave = () => {
    if (!activeOutfit) return;
    const willLike = !activeOutfit.favorited;
    toggleFavorite(activeOutfit.id);
    if (!activeOutfit.saved && willLike) {
      toggleSave(activeOutfit.id);
    }
    showToast(willLike ? 'Saved to your liked looks.' : 'Removed from liked looks.');
  };

  const handleDislikeSkip = () => {
    if (!activeOutfit) return;
    submitPreferenceEvent(activeOutfit.id, 'DISLIKE');
    if (top3.length > 1) {
      const nextIdx = (activeIndex + 1) % top3.length;
      setActiveIndex(nextIdx);
      showToast(`Skipped to ${PERMANENT_RANKS[nextIdx]}.`);
    } else {
      generateOutfit();
      showToast('Generating a fresh look for you...');
    }
  };

  const handlePublishToCommunity = async () => {
    if (!activeOutfit || isPublishing) return;
    setIsPublishing(true);
    try {
      const caption = `${activeOutfit.name || 'Curated Look'} · Styled for ${
        occasion === 'Any occasion' ? 'Everyday' : occasion
      }`;
      await publishOutfit(activeOutfit, caption);
      await community.refresh();
      showToast('Published editorial flat-lay to Community!');
    } catch (err: any) {
      showToast(err?.message || 'Sign in to publish looks to Community.');
    } finally {
      setIsPublishing(false);
    }
  };

  const sortedActivePieces = useMemo(() => {
    return [...(activeOutfit?.clothingItems || [])].sort(
      (a, b) => getSlotRank(a) - getSlotRank(b)
    );
  }, [activeOutfit?.clothingItems]);

  const seeItOnMeButtonLabel = useMemo(() => {
    if (!isFullBodyPhotoVerified || !photoSourceForVton) {
      return '🔒 See It On Me';
    }
    if (isPreloadingVton && preloadedCount < top3.length) {
      return `🧍 See It On Me · ${Math.max(1, preloadedCount)}/${top3.length}`;
    }
    return '✨ See It On Me';
  }, [isFullBodyPhotoVerified, photoSourceForVton, isPreloadingVton, preloadedCount, top3.length]);

  const activeCompositeUri = vtonCacheByOutfitIndex[activeIndex] || null;
  const activeScore = activeOutfit?.hybridScore ?? activeOutfit?.matchPercent ?? 90;
  const activeRoleBadge = ROLE_BADGES[activeIndex] || ROLE_BADGES[0];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) }]}
      >
        {/* Screen Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.kicker, { color: theme.primary }]}>AI OUTFIT STUDIO</Text>
            <Text style={[styles.title, { color: theme.text }]}>Recommendations</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={generateOutfit}
              style={[
                styles.refresh,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
              accessibilityLabel="Refresh outfits"
            >
              <Ionicons name="refresh" size={18} color={theme.text} />
            </Pressable>
          </View>
        </View>

        {/* Controls: Target Occasion & Wardrobe Source Toggle (Zero Subcategory Bar) */}
        <View
          style={[
            styles.controls,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.controlLabel, { color: theme.text }]}>Target Occasion</Text>
          <OccasionDropdown value={occasion} onChange={setOccasion} />

          <View
            style={[
              styles.sourceToggle,
              { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
            ]}
          >
            <Pressable
              onPress={() => setOutfitSourceMode('closet')}
              style={[
                styles.sourceOption,
                outfitSourceMode === 'closet' && { backgroundColor: theme.primary },
              ]}
            >
              <Text
                style={[
                  styles.sourceText,
                  {
                    color:
                      outfitSourceMode === 'closet' ? theme.primaryText : theme.textMuted,
                  },
                ]}
              >
                My Wardrobe
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOutfitSourceMode('bestForOccasion')}
              style={[
                styles.sourceOption,
                outfitSourceMode === 'bestForOccasion' && { backgroundColor: theme.primary },
              ]}
            >
              <Text
                style={[
                  styles.sourceText,
                  {
                    color:
                      outfitSourceMode === 'bestForOccasion'
                        ? theme.primaryText
                        : theme.textMuted,
                  },
                ]}
              >
                Mix & Match
              </Text>
            </Pressable>
          </View>
        </View>

        {sourceMode === 'mix' && catalogOnly && !showEmptyWardrobePrompt && (
          <View
            style={[
              styles.emptyBanner,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="sparkles-outline" size={17} color={theme.primary} />
            <Text style={[styles.emptyBannerText, { color: theme.textSecondary }]}>
              Showing curated outfits tailored to your fit profile. Tap Wardrobe anytime to add your own clothes.
            </Text>
          </View>
        )}

        {/* Compact Mel Stylist Note on Main Studio Screen */}
        {!showEmptyWardrobePrompt && (
          <View
            style={[
              styles.melRow,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <MelMascot
              size={50}
              outfit={melOutfitForOccasion(activeOutfit?.occasionLabel || occasion)}
            />
            <MelSpeechBubble
              variant={melOutfitForOccasion(activeOutfit?.occasionLabel || occasion)}
              message={reaction}
              position="inline"
            />
          </View>
        )}

        {/* Empty or Incomplete Wardrobe Guard for My Wardrobe mode */}
        {showEmptyWardrobePrompt ? (
          <View
            style={[
              styles.emptyPromptCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.emptyPromptMelRow}>
              <MelMascot outfit="casual_sunny" size={76} waving />
              <View style={{ flex: 1 }}>
                <MelSpeechBubble
                  variant="casual_sunny"
                  message="Add at least a Top, Bottom, and Shoes to build outfits from your own closet—or switch to Mix & Match to explore curated looks right now!"
                  position="inline"
                />
              </View>
            </View>

            <View style={styles.emptyPromptActions}>
              <Pressable
                onPress={() => navigation.navigate('Wardrobe')}
                style={[styles.emptyPromptBtnPrimary, { backgroundColor: theme.primary }]}
              >
                <Ionicons name="camera-outline" size={17} color={theme.primaryText} />
                <Text style={[styles.emptyPromptBtnTextPrimary, { color: theme.primaryText }]}>
                  Add to My Wardrobe
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setOutfitSourceMode('bestForOccasion')}
                style={[
                  styles.emptyPromptBtnSecondary,
                  { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
                ]}
              >
                <Ionicons name="sparkles-outline" size={16} color={theme.text} />
                <Text style={[styles.emptyPromptBtnTextSecondary, { color: theme.text }]}>
                  Try Mix & Match
                </Text>
              </Pressable>
            </View>
          </View>
        ) : isLoading && !activeOutfit ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Curating your Top-3 editorial looks...
            </Text>
          </View>
        ) : activeOutfit ? (
          /* ================= ALTA-STYLE EDITORIAL OUTFIT STUDIO CARD ================= */
          <View
            style={[
              styles.altaOuterCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {/* Top Rank Switcher Row: TOP 1 | TOP 2 | TOP 3 + Match Score */}
            <View style={styles.altaTopHeader}>
              <View style={styles.rankPillsRow}>
                {top3.map((o, idx) => {
                  const isCurrent = idx === activeIndex;
                  const s = o.hybridScore ?? o.matchPercent ?? 90;
                  return (
                    <Pressable
                      key={o.id || idx}
                      onPress={() => setActiveIndex(idx)}
                      style={[
                        styles.rankPill,
                        {
                          backgroundColor: isCurrent
                            ? theme.primary
                            : theme.surfaceSecondary,
                          borderColor: isCurrent ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rankPillText,
                          {
                            color: isCurrent ? theme.primaryText : theme.textSecondary,
                          },
                        ]}
                      >
                        {PERMANENT_RANKS[idx]} · {s}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Outfit Title + Role Subtitle */}
            <View style={styles.altaTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.altaOutfitTitle, { color: theme.text }]} numberOfLines={1}>
                  {activeOutfit.name || `${occasion} Look #${activeIndex + 1}`}
                </Text>
                <Text style={[styles.altaRoleSubtitle, { color: theme.textMuted }]}>
                  {activeRoleBadge} · Swipe left/right to flip looks
                </Text>
              </View>
            </View>

            {/* ALTA Single Unified Borderless Studio Canvas (Swipeable horizontally) */}
            <View {...horizontalSwipeResponder.panHandlers}>
              <AltaOutfitCollage
                items={activeOutfit.clothingItems || []}
                paginationIndex={activeIndex}
                paginationCount={top3.length}
                onSelectPagination={setActiveIndex}
                interactive
              />
            </View>

            {/* ALTA-Style Action Bar Directly Below Studio Canvas */}
            <View style={styles.altaActionBar}>
              {/* Left Action Icons Row: ♡ Favorite | ✎ Customize | 👎 Dislike | ⌲ Publish */}
              <View style={styles.altaLeftIconsRow}>
                <Pressable
                  onPress={handleToggleLikeSave}
                  style={[
                    styles.altaIconBtn,
                    {
                      backgroundColor: theme.surfaceSecondary,
                      borderColor: theme.border,
                    },
                  ]}
                  accessibilityLabel="Like and save outfit"
                >
                  <Ionicons
                    name={activeOutfit.favorited ? 'heart' : 'heart-outline'}
                    size={20}
                    color={activeOutfit.favorited ? '#DC2626' : theme.text}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setCustomizing(true)}
                  style={[
                    styles.altaIconBtn,
                    {
                      backgroundColor: theme.surfaceSecondary,
                      borderColor: theme.border,
                    },
                  ]}
                  accessibilityLabel="Customize outfit pieces"
                >
                  <Ionicons name="create-outline" size={20} color={theme.text} />
                </Pressable>

                <Pressable
                  onPress={handleDislikeSkip}
                  style={[
                    styles.altaIconBtn,
                    {
                      backgroundColor: theme.surfaceSecondary,
                      borderColor: theme.border,
                    },
                  ]}
                  accessibilityLabel="Dislike or skip outfit"
                >
                  <Ionicons name="thumbs-down-outline" size={19} color={theme.text} />
                </Pressable>

                <Pressable
                  onPress={handlePublishToCommunity}
                  disabled={isPublishing}
                  style={[
                    styles.altaIconBtn,
                    {
                      backgroundColor: theme.surfaceSecondary,
                      borderColor: theme.border,
                      opacity: isPublishing ? 0.5 : 1,
                    },
                  ]}
                  accessibilityLabel="Publish to Community"
                >
                  {isPublishing ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <Ionicons name="paper-plane-outline" size={19} color={theme.text} />
                  )}
                </Pressable>
              </View>

              {/* Right Primary Pill Button: See It On Me */}
              <Pressable
                onPress={handlePressSeeItOnMe}
                style={[
                  styles.seeItOnMePill,
                  {
                    backgroundColor: theme.mode === 'dark' ? '#F4F4F5' : '#18181B',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.seeItOnMePillText,
                    {
                      color: theme.mode === 'dark' ? '#18181B' : '#FFFFFF',
                    },
                  ]}
                >
                  {seeItOnMeButtonLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* ================= EXPANSIVE FULL-HEIGHT "SEE IT ON ME" VISUALIZER MODAL (NO MEL SPEECH BUBBLE) ================= */}
      <Modal
        visible={seeItOnMeVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSeeItOnMeVisible(false)}
      >
        <SafeAreaView
          style={[styles.vtonModalContainer, { backgroundColor: theme.background }]}
          edges={['top', 'bottom']}
        >
          {/* 1. Compact Top Bar (height: 52): Left <- Back | Center TOP 1/2/3 Pills | Right 📷 Retake */}
          <View
            style={[
              styles.vtonTopBar,
              { backgroundColor: theme.surface, borderBottomColor: theme.border },
            ]}
          >
            <Pressable
              onPress={() => setSeeItOnMeVisible(false)}
              style={styles.vtonBackBtn}
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={18} color={theme.text} />
              <Text style={[styles.vtonBackText, { color: theme.text }]}>Back</Text>
            </Pressable>

            <View style={styles.vtonRankSwitchRow}>
              {top3.map((o, idx) => {
                const isCurrent = idx === activeIndex;
                const s = o.hybridScore ?? o.matchPercent ?? 90;
                const isReady = Boolean(vtonCacheByOutfitIndex[idx]);
                return (
                  <Pressable
                    key={o.id || idx}
                    onPress={() => setActiveIndex(idx)}
                    style={[
                      styles.vtonRankChip,
                      {
                        backgroundColor: isCurrent ? theme.primary : theme.surfaceSecondary,
                        borderColor: isCurrent ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.vtonRankChipText,
                        { color: isCurrent ? theme.primaryText : theme.textSecondary },
                      ]}
                    >
                      {PERMANENT_RANKS[idx]} ({s}%){isReady ? ' ✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => {
                setSeeItOnMeVisible(false);
                setTimeout(() => setFullBodyModalVisible(true), 220);
              }}
              style={[
                styles.vtonRetakeBtn,
                { backgroundColor: theme.surfaceSecondary, borderColor: theme.border },
              ]}
              hitSlop={6}
            >
              <Text style={[styles.vtonRetakeText, { color: theme.text }]}>📷 Retake</Text>
            </Pressable>
          </View>

          {/* 2. Main Full-Body VTON Stage (74% of screen height, full width, zero Mel speech bubble) */}
          <View
            style={[
              styles.vtonMainStage,
              {
                backgroundColor: theme.mode === 'dark' ? '#18181B' : '#FFFFFF',
                borderColor: theme.border,
              },
            ]}
          >
            {activeCompositeUri || fullBodyPhotoUri ? (
              <RNImage
                source={{ uri: activeCompositeUri || fullBodyPhotoUri || '' }}
                style={styles.vtonFullImage}
                resizeMode="contain"
              />
            ) : null}

            {/* Shimmer Overlay while 2-Pass Full-Body VTON finishes in background queue */}
            {!activeCompositeUri && (
              <View style={styles.vtonLoadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.vtonLoadingTitle}>
                  ✨ Rendering 2-Pass Full-Body Virtual Try-On (Upper Body + Lower Body & Shoes)...
                </Text>
                <Text style={styles.vtonLoadingSub}>
                  Pre-loading {PERMANENT_RANKS[activeIndex]} ({activeScore}% match) on your standing photo
                </Text>
              </View>
            )}

            {/* Subtle Bottom-Left Privacy Badge */}
            <View
              style={[
                styles.vtonPrivateBadge,
                {
                  backgroundColor:
                    theme.mode === 'dark'
                      ? 'rgba(28, 28, 31, 0.92)'
                      : 'rgba(255, 255, 255, 0.92)',
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.vtonPrivateBadgeText, { color: theme.text }]}>
                🔒 100% Private
              </Text>
            </View>
          </View>

          {/* 3. Compact Bottom Strip (height: 84): Equipped Pieces (1. TOP -> 5. ACCESSORY) + Customize Button */}
          <View
            style={[
              styles.vtonBottomStrip,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vtonEquippedScroll}
            >
              {sortedActivePieces.map((piece, pIdx) => {
                const uri = resolveGarmentImageUrl(piece);
                const slot =
                  piece.slotType || classifyAnatomicalSlot(piece.name, piece.category);
                const hex = piece.hexColor || colorNameToHex(piece.color || 'Black');
                const orderedSlotLabel = getSlotOrderedLabel(piece);

                return (
                  <Pressable
                    key={`${piece.id || 'eq'}-${pIdx}`}
                    onPress={() => {
                      setSeeItOnMeVisible(false);
                      setTimeout(() => setCustomizing(true), 220);
                    }}
                    style={[
                      styles.vtonPieceChip,
                      {
                        backgroundColor: theme.surfaceSecondary,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.vtonPieceThumb,
                        { backgroundColor: theme.collageCanvas },
                      ]}
                    >
                      {uri ? (
                        <Image
                          source={{ uri }}
                          style={{ width: 36, height: 36 }}
                          contentFit="contain"
                        />
                      ) : (
                        <MiniGarmentSvg
                          slot={slot as any}
                          name={piece.name}
                          color={hex}
                          size={30}
                        />
                      )}
                    </View>
                    <View style={{ maxWidth: 88 }}>
                      <Text
                        style={[styles.vtonPieceSlotLabel, { color: theme.primary }]}
                        numberOfLines={1}
                      >
                        {orderedSlotLabel}
                      </Text>
                      <Text
                        style={[styles.vtonPieceName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {piece.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => {
                setSeeItOnMeVisible(false);
                setTimeout(() => setCustomizing(true), 220);
              }}
              style={[styles.vtonCustomizeBtn, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="create-outline" size={15} color={theme.primaryText} />
              <Text style={[styles.vtonCustomizeText, { color: theme.primaryText }]}>
                Customize
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Locked Full-Body Standing Photo Verification Modal (POST /verify-full-body) */}
      <FullBodyTryOnModal
        visible={fullBodyModalVisible}
        onClose={() => setFullBodyModalVisible(false)}
        onPhotoSaved={handleFullBodyPhotoSaved}
      />

      {/* Piece Swap Drawer (1. TOP -> 2. OUTERWEAR -> 3. BOTTOM -> 4. SHOES -> 5. ACCESSORIES) */}
      {activeOutfit && (
        <OutfitCustomizeModal
          visible={customizing}
          outfit={activeOutfit}
          profile={profile}
          weather={weather}
          suggestions={allSuggestions}
          sourceMode={outfitSourceMode === 'closet' ? 'wardrobe' : 'mix'}
          onClose={() => setCustomizing(false)}
          onEquip={chooseItem as any}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  controlLabel: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  sourceToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  sourceOption: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyBanner: {
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  emptyBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  melRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
  },
  emptyPromptCard: {
    marginVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 16,
  },
  emptyPromptMelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyPromptActions: {
    gap: 10,
    marginTop: 4,
  },
  emptyPromptBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  emptyPromptBtnTextPrimary: {
    fontWeight: '800',
    fontSize: 14,
  },
  emptyPromptBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyPromptBtnTextSecondary: {
    fontWeight: '800',
    fontSize: 14,
  },
  loadingCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  altaOuterCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  altaTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rankPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  rankPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  altaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  altaOutfitTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  altaRoleSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  altaActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    gap: 10,
  },
  altaLeftIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  altaIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeItOnMePill: {
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeItOnMePillText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  /* ================= FULL-HEIGHT SEE IT ON ME MODAL ================= */
  vtonModalContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  vtonTopBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  vtonBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 8,
  },
  vtonBackText: {
    fontSize: 13,
    fontWeight: '800',
  },
  vtonRankSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vtonRankChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  vtonRankChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  vtonRetakeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  vtonRetakeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  vtonMainStage: {
    height: Math.round(SCREEN_HEIGHT * 0.74),
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vtonFullImage: {
    width: '100%',
    height: '100%',
  },
  vtonLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 24, 27, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  vtonLoadingTitle: {
    color: '#F4F4F5',
    fontSize: 13.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 19,
  },
  vtonLoadingSub: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  vtonPrivateBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  vtonPrivateBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  vtonBottomStrip: {
    height: 84,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  vtonEquippedScroll: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  vtonPieceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  vtonPieceThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vtonPieceSlotLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  vtonPieceName: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  vtonCustomizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
  },
  vtonCustomizeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});
