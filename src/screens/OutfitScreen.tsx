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
  normalizeHexCode,
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

const STYLING_NOTES_BY_RANK = [
  "Cute fit incoming! Let's style this look!",
  "Looking good today! Your vibe is ready.",
  "Your next favorite look awaits!",
] as const;

function formatCleanOutfitTitle(rawName?: string, occasionLabel?: string, _idx = 0): string {
  const occ =
    occasionLabel && occasionLabel !== 'Any occasion' ? occasionLabel : 'Casual';
  if (!rawName) return `${occ} Look`;
  // Strip robotic "· Item1 + Item2" concatenations if present
  const beforeBullet = rawName.split('·')[0].trim();
  if (beforeBullet && beforeBullet.length >= 3 && !/\bIm\b/i.test(beforeBullet)) {
    return beforeBullet;
  }
  return `${occ} Look`;
}

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
  const isDark = theme.mode === 'dark';
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

  // In-flight guard refs so TOP 1 (and each rank) is only requested ONCE without duplicate concurrent /try-on-2d calls
  const inFlightVtonRef = useRef<Set<string>>(new Set());
  const inFlightVtonPromisesRef = useRef<
    Map<string, Promise<{ compositeDataUri: string | null; usedServerComposite: boolean }>>
  >(new Map());
  const vtonCacheByOutfitIndexRef = useRef<Record<number, string>>({});
  const vtonSignatureCacheRef = useRef<Record<string, string>>({});

  useEffect(() => {
    vtonCacheByOutfitIndexRef.current = vtonCacheByOutfitIndex;
  }, [vtonCacheByOutfitIndex]);

  useEffect(() => {
    vtonSignatureCacheRef.current = vtonSignatureCache;
  }, [vtonSignatureCache]);

  const [wardrobeOutfits, setWardrobeOutfits] = useState<GeneratedOutfit[]>([]);
  const [mixOutfits, setMixOutfits] = useState<GeneratedOutfit[]>([]);
  const [reaction, setReaction] = useState("Let's find your vibe!");

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

  // Preserve the Top 3 recommendations in strict descending Hybrid Score order (TOP 1 >= TOP 2 >= TOP 3)
  const scoredCurrentOutfits = useMemo(() => {
    const mapped = currentOutfits.slice(0, 3).map((outfit) => {
      const existingScore = outfit.hybridScore ?? outfit.matchPercent;
      const resolvedScore =
        typeof existingScore === 'number' && existingScore > 0
          ? Math.round(existingScore)
          : computeAccurateOutfitScore(
              outfit.clothingItems || [],
              profile,
              weather,
              occasion
            );
      return {
        ...outfit,
        hybridScore: resolvedScore,
        matchPercent: resolvedScore,
      };
    });

    // Guarantee strict non-increasing score hierarchy on tabs: TOP 1 >= TOP 2 >= TOP 3
    for (let i = 1; i < mapped.length; i++) {
      const prevScore = mapped[i - 1].hybridScore ?? mapped[i - 1].matchPercent ?? 90;
      const currScore = mapped[i].hybridScore ?? mapped[i].matchPercent ?? 85;
      if (currScore > prevScore) {
        mapped[i] = {
          ...mapped[i],
          hybridScore: prevScore,
          matchPercent: prevScore,
        };
      }
    }

    return mapped;
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

  // Deduplicated single-outfit VTON renderer using inFlightVtonRef guard
  const renderSingleOutfitVton = useCallback(
    async (
      idx: number,
      outfit: GeneratedOutfit,
      photoSource: string
    ): Promise<string | null> => {
      const sig = buildOutfitSignature(photoSource, outfit) || `rank_${idx}_${outfit.id}`;
      const rankKey = `rank_${idx}`;

      // 1. Return immediately if already cached in memory or signature cache
      const cachedDirect =
        vtonCacheByOutfitIndexRef.current[idx] || vtonSignatureCacheRef.current[sig];
      if (cachedDirect) {
        if (!vtonCacheByOutfitIndexRef.current[idx]) {
          vtonCacheByOutfitIndexRef.current[idx] = cachedDirect;
          setVtonCacheByOutfitIndex((prev) => ({ ...prev, [idx]: cachedDirect }));
        }
        return cachedDirect;
      }

      // 2. In-flight guard: if this outfit/rank is currently rendering, await existing promise
      const existingPromise =
        inFlightVtonPromisesRef.current.get(sig) ||
        inFlightVtonPromisesRef.current.get(rankKey);
      if (
        existingPromise ||
        inFlightVtonRef.current.has(sig) ||
        inFlightVtonRef.current.has(rankKey)
      ) {
        if (existingPromise) {
          try {
            const sharedRes = await existingPromise;
            if (sharedRes?.compositeDataUri) {
              const uri = sharedRes.compositeDataUri;
              vtonCacheByOutfitIndexRef.current[idx] = uri;
              setVtonCacheByOutfitIndex((prev) => ({ ...prev, [idx]: uri }));
              return uri;
            }
          } catch {
            return null;
          }
        }
        return vtonCacheByOutfitIndexRef.current[idx] || null;
      }

      // 3. Mark as in-flight before launching POST /try-on-2d
      inFlightVtonRef.current.add(sig);
      inFlightVtonRef.current.add(rankKey);

      const reqPromise = requestTryOn2D(
        photoSource,
        normalizeItemsForVton(outfit.clothingItems || []),
        session?.access_token,
        65000
      );
      inFlightVtonPromisesRef.current.set(sig, reqPromise);
      inFlightVtonPromisesRef.current.set(rankKey, reqPromise);

      try {
        const res = await reqPromise;
        if (res?.compositeDataUri) {
          const compUri = res.compositeDataUri;
          vtonCacheByOutfitIndexRef.current[idx] = compUri;
          setVtonCacheByOutfitIndex((prev) => ({
            ...prev,
            [idx]: compUri,
          }));

          vtonSignatureCacheRef.current[sig] = compUri;
          setVtonSignatureCache((prev) => {
            const updated = { ...prev, [sig]: compUri };
            const keys = Object.keys(updated);
            if (keys.length > 12) {
              delete updated[keys[0]];
            }
            AsyncStorage.setItem(VTON_SIGNATURE_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
            return updated;
          });
          return compUri;
        }
        return null;
      } catch {
        return null;
      } finally {
        inFlightVtonRef.current.delete(sig);
        inFlightVtonRef.current.delete(rankKey);
        inFlightVtonPromisesRef.current.delete(sig);
        inFlightVtonPromisesRef.current.delete(rankKey);
      }
    },
    [normalizeItemsForVton, session?.access_token]
  );

  const top3SignaturesKey = useMemo(
    () =>
      top3
        .map((o, idx) => buildOutfitSignature(photoSourceForVton || '', o) || `${o.id}_${idx}`)
        .join('||'),
    [top3, photoSourceForVton]
  );

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
        if (sig && vtonSignatureCacheRef.current[sig]) {
          initialHits[idx] = vtonSignatureCacheRef.current[sig];
        }
      }
      if (Object.keys(initialHits).length > 0 && preloadRunIdRef.current === runId) {
        vtonCacheByOutfitIndexRef.current = {
          ...vtonCacheByOutfitIndexRef.current,
          ...initialHits,
        };
        setVtonCacheByOutfitIndex((prev) => ({ ...prev, ...initialHits }));
      }

      // Step 2: Render TOP 1 (idx = 0) first; only after TOP 1 finishes, sequentially pre-load TOP 2 and TOP 3
      for (let idx = 0; idx < top3.length; idx++) {
        if (preloadRunIdRef.current !== runId) return;
        const outfit = top3[idx];
        if (!outfit) continue;
        await renderSingleOutfitVton(idx, outfit, photoSourceForVton);
      }

      if (preloadRunIdRef.current === runId) {
        setIsPreloadingVton(false);
      }
    };

    preloadAllOutfitsVton();
  }, [
    isFullBodyPhotoVerified,
    photoSourceForVton,
    top3SignaturesKey,
    renderSingleOutfitVton,
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

    showToast('Full-body standing photo verified! Unlocking See It On Me...');
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
      setReaction(`Cute swap! Now a ${nextScore}% match!`);
    } else {
      setReaction(`Fresh update! ${nextScore}% style match!`);
    }
  };

  // Natural, fashion-forward Mel stylist description without CIELAB or raw item concatenation (PDF Page 12)
  useEffect(() => {
    if (activeOutfit) {
      const s = activeOutfit.hybridScore ?? activeOutfit.matchPercent ?? 88;
      const cuteNotes = [
        `Cute fit incoming! (${s}% match)`,
        `Looking good today! (${s}% match)`,
        `Your next look awaits! (${s}% match)`,
      ];
      setReaction(cuteNotes[activeIndex % cuteNotes.length]);
    }
  }, [activeOutfit?.id, activeIndex, occasion]);

  // ALTA Left Action Bar Handlers
  const handleToggleLikeSave = () => {
    if (!activeOutfit) return;
    const outfitId = activeOutfit.id;
    const willLike = !activeOutfit.favorited;
    toggleFavorite(outfitId);
    if (!activeOutfit.saved && willLike) {
      toggleSave(outfitId);
    }
    if (willLike) {
      showToast('Saved to your liked looks.');
    } else {
      showToast('Removed from liked looks.', {
        variant: 'warning',
        undoLabel: 'Undo',
        onUndo: () => {
          toggleFavorite(outfitId);
          showToast('Restored to your liked looks.');
        },
      });
    }
  };

  const handleDislikeSkip = () => {
    if (!activeOutfit) return;
    const prevIdx = activeIndex;
    submitPreferenceEvent(activeOutfit.id, 'DISLIKE');
    if (top3.length > 1) {
      const nextIdx = (activeIndex + 1) % top3.length;
      setActiveIndex(nextIdx);
      showToast(`Skipped to ${PERMANENT_RANKS[nextIdx]}.`, {
        variant: 'info',
        undoLabel: 'Undo',
        onUndo: () => {
          setActiveIndex(prevIdx);
        },
      });
    } else {
      generateOutfit();
      showToast('Generating a fresh look for you...');
    }
  };

  const handlePublishToCommunity = async () => {
    if (!activeOutfit || isPublishing) return;
    setIsPublishing(true);
    try {
      const cleanTitle = formatCleanOutfitTitle(activeOutfit.name, occasion, activeIndex);
      const caption = `${cleanTitle} · Styled for ${
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
      return 'See It On Me';
    }
    if (isPreloadingVton && preloadedCount < top3.length) {
      return `See It On Me · ${Math.max(1, preloadedCount)}/${top3.length}`;
    }
    return 'See It On Me';
  }, [isFullBodyPhotoVerified, photoSourceForVton, isPreloadingVton, preloadedCount, top3.length]);

  const activeCompositeUri = vtonCacheByOutfitIndex[activeIndex] || null;
  const activeScore = activeOutfit?.hybridScore ?? activeOutfit?.matchPercent ?? 90;
  const cleanActiveTitle = formatCleanOutfitTitle(activeOutfit?.name, occasion, activeIndex);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={['left', 'right']}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: 22 }]}
      >
        {/* Screen Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.kickerRow}>
              <View style={styles.kickerDot} />
              <Text style={[styles.kicker, { color: isDark ? '#F3F1EF' : '#364536' }]}>
                AI OUTFIT STUDIO
              </Text>
            </View>
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

        {/* Controls: Target Occasion & Wardrobe Source Toggle */}
        <View style={styles.controls}>
          <Text style={[styles.controlLabel, { color: theme.textMuted }]}>TARGET OCCASION</Text>
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
                outfitSourceMode === 'closet' && { backgroundColor: '#364536' },
              ]}
            >
              <Text
                style={[
                  styles.sourceText,
                  {
                    color:
                      outfitSourceMode === 'closet' ? '#F3F1EF' : theme.textMuted,
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
                outfitSourceMode === 'bestForOccasion' && { backgroundColor: '#364536' },
              ]}
            >
              <Text
                style={[
                  styles.sourceText,
                  {
                    color:
                      outfitSourceMode === 'bestForOccasion'
                        ? '#F3F1EF'
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
            <Ionicons name="sparkles-outline" size={17} color="#E83E35" />
            <Text style={[styles.emptyBannerText, { color: theme.textSecondary }]}>
              Showing curated outfits tailored to your fit profile. Tap Wardrobe anytime to add your own clothes.
            </Text>
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
            <View style={{ alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Ionicons name="shirt-outline" size={28} color={isDark ? '#98C4A4' : '#364536'} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
                Complete Your Wardrobe
              </Text>
              <Text style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 18 }}>
                Add at least a Top, Bottom, and Shoes to unlock My Wardrobe outfits, or try Mix & Match right now.
              </Text>
            </View>

            <View style={styles.emptyPromptActions}>
              <Pressable
                onPress={() => navigation.navigate('Wardrobe')}
                style={[styles.emptyPromptBtnPrimary, { backgroundColor: '#364536' }]}
              >
                <Ionicons name="camera-outline" size={17} color="#F3F1EF" />
                <Text style={[styles.emptyPromptBtnTextPrimary, { color: '#F3F1EF' }]}>
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
            <ActivityIndicator size="small" color="#E83E35" />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Curating your Top-3 editorial looks...
            </Text>
          </View>
        ) : activeOutfit ? (
          /* ================= REDESIGNED ALTA-STYLE EDITORIAL OUTFIT STUDIO CARD (PDF Page 13) ================= */
          <View
            style={[
              styles.altaOuterCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {/* Top Rank Switcher Row: TOP 1 | TOP 2 | TOP 3 */}
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
                            ? '#364536'
                            : theme.surfaceSecondary,
                          borderColor: isCurrent ? '#364536' : theme.border,
                        },
                      ]}
                    >
                      {isCurrent && <View style={styles.rankActiveDot} />}
                      <Text
                        style={[
                          styles.rankPillText,
                          {
                            color: isCurrent ? '#F3F1EF' : theme.textSecondary,
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

            {/* Clean Editorial Title Row (No Archetype Badge) */}
            <View style={styles.altaTitleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.altaOutfitTitle, { color: theme.text }]} numberOfLines={1}>
                  {cleanActiveTitle}
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

            {/* Outfit Color Palette Swatches with Explicit #RRGGBB HEX Codes */}
            {sortedActivePieces.length > 0 && (
              <View
                style={[
                  styles.outfitPaletteBar,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F5F3EE',
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.outfitPaletteHeader}>
                  <Ionicons name="color-palette-outline" size={13} color={theme.textSecondary} />
                  <Text style={[styles.outfitPaletteLabel, { color: theme.textSecondary }]}>
                    OUTFIT COLOR PALETTE
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.outfitPaletteSwatchesRow}
                >
                  {sortedActivePieces.map((piece, idx) => {
                    const hexCode = normalizeHexCode(piece.hexColor, piece.color || 'Neutral');
                    return (
                      <View
                        key={`pal-${piece.id || idx}`}
                        style={[
                          styles.outfitPaletteChip,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.outfitPaletteDot,
                            {
                              backgroundColor: hexCode,
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.25)'
                                : 'rgba(0, 0, 0, 0.16)',
                            },
                          ]}
                        />
                        <Text
                          style={[styles.outfitPaletteHexText, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {hexCode}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ALTA-Style Action Bar Directly Below Studio Canvas */}
            <View style={styles.altaActionBar}>
              {/* Left Action Icons Row: ♡ Favorite | ✎ Customize | 👎 Dislike | ⌲ Publish */}
              <View style={styles.altaLeftIconsRow}>
                <Pressable
                  onPress={handleToggleLikeSave}
                  style={[
                    styles.altaIconBtn,
                    {
                      backgroundColor: activeOutfit.favorited
                        ? 'rgba(232, 62, 53, 0.12)'
                        : theme.surfaceSecondary,
                      borderColor: activeOutfit.favorited ? '#E83E35' : theme.border,
                    },
                  ]}
                  accessibilityLabel="Like and save outfit"
                >
                  <Ionicons
                    name={activeOutfit.favorited ? 'heart' : 'heart-outline'}
                    size={19}
                    color={activeOutfit.favorited ? '#E83E35' : theme.text}
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
                  <Ionicons name="options-outline" size={19} color={theme.text} />
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
                  <Ionicons name="heart-dislike-outline" size={18} color={theme.text} />
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
                    <Ionicons name="paper-plane-outline" size={18} color={theme.text} />
                  )}
                </Pressable>
              </View>

              {/* Right Primary Pill Button: See It On Me */}
              <Pressable
                onPress={handlePressSeeItOnMe}
                style={[
                  styles.seeItOnMePill,
                  {
                    backgroundColor: '#364536',
                  },
                ]}
              >
                <Ionicons
                  name={
                    !isFullBodyPhotoVerified || !photoSourceForVton
                      ? 'lock-closed-outline'
                      : 'sparkles'
                  }
                  size={14}
                  color="#E83E35"
                />
                <Text style={styles.seeItOnMePillText}>
                  {seeItOnMeButtonLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Standalone Mel Character (Right) & Cute Compact Speech Bubble (Left -> Pointing to Mel) at Bottom */}
        <View style={styles.melBottomCompanion}>
          <MelSpeechBubble
            title={showEmptyWardrobePrompt ? 'MEL · CLOSET TIP' : 'MEL · STYLIST NOTE'}
            variant={
              showEmptyWardrobePrompt
                ? 'casual_sunny'
                : melOutfitForOccasion(activeOutfit?.occasionLabel || occasion)
            }
            message={
              showEmptyWardrobePrompt
                ? 'Add a Top, Bottom & Shoes, or try Mix & Match right now!'
                : reaction
            }
            position="inline"
            tailDirection="right"
            compact
          />
          <View style={styles.melCharacterWrap}>
            <MelMascot
              size={54}
              waving={showEmptyWardrobePrompt}
              outfit={
                showEmptyWardrobePrompt
                  ? 'casual_sunny'
                  : melOutfitForOccasion(activeOutfit?.occasionLabel || occasion)
              }
              onPress={generateOutfit}
            />
          </View>
        </View>
      </ScrollView>

      {/* ================= EXPANSIVE FULL-HEIGHT "SEE IT ON ME" VISUALIZER MODAL ================= */}
      <Modal statusBarTranslucent={true}
        visible={seeItOnMeVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSeeItOnMeVisible(false)}
      >
        <SafeAreaView
          style={[styles.vtonModalContainer, { backgroundColor: theme.background }]}
          edges={['left', 'right', 'bottom']}
        >
          {/* 1. Compact Top Bar (height: 52): Left <- Back | Center TOP 1/2/3 Pills | Right Retake */}
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
                        backgroundColor: isCurrent ? '#364536' : theme.surfaceSecondary,
                        borderColor: isCurrent ? '#364536' : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.vtonRankChipText,
                        { color: isCurrent ? '#F3F1EF' : theme.textSecondary },
                      ]}
                    >
                      {PERMANENT_RANKS[idx]} ({s}%)
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Ionicons name="camera-outline" size={13} color={theme.text} /><Text style={[styles.vtonRetakeText, { color: theme.text }]}>Retake</Text></View>
            </Pressable>
          </View>

          {/* 2. Main Full-Body VTON Stage */}
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

            {!activeCompositeUri && (
              <View style={styles.vtonLoadingOverlay}>
                <ActivityIndicator size="large" color="#E83E35" />
                <Text style={styles.vtonLoadingTitle}>
                  Rendering Full-Body Virtual Try-On...
                </Text>
                <Text style={styles.vtonLoadingSub}>
                  Pre-loading {PERMANENT_RANKS[activeIndex]} ({activeScore}% match) on your standing photo
                </Text>
              </View>
            )}

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="lock-closed-outline" size={12} color={theme.text} />
                <Text style={[styles.vtonPrivateBadgeText, { color: theme.text }]}>
                  100% Private
                </Text>
              </View>
            </View>
          </View>

          {/* 3. Compact Bottom Strip */}
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
                        style={[
                          styles.vtonPieceSlotLabel,
                          { color: isDark ? '#F3F1EF' : '#364536' },
                        ]}
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
              style={[styles.vtonCustomizeBtn, { backgroundColor: '#364536' }]}
            >
              <Ionicons name="options-outline" size={15} color="#F3F1EF" />
              <Text style={[styles.vtonCustomizeText, { color: '#F3F1EF' }]}>
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

      {/* Piece Swap Drawer */}
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
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    paddingTop: 2,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
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
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refresh: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    gap: 8,
    marginBottom: 12,
  },
  melBottomCompanion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    paddingHorizontal: 4,
    marginTop: 'auto',
    paddingTop: 14,
    marginBottom: 6,
    gap: 10,
    maxWidth: '94%',
    overflow: 'visible',
  },
  melCharacterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  controlLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBanner: {
    marginBottom: 10,
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
  melEditorialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#364536',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(243, 241, 239, 0.14)',
  },
  melBannerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(243, 241, 239, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  melBannerTextCol: {
    flex: 1,
    gap: 2,
  },
  melBannerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  melBannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  melBannerLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: 'rgba(243, 241, 239, 0.76)',
  },
  melBannerMessage: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
    color: '#F3F1EF',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  emptyPromptBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  emptyPromptBtnTextPrimary: {
    fontWeight: '800',
    fontSize: 12.5,
  },
  emptyPromptBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  emptyPromptBtnTextSecondary: {
    fontWeight: '800',
    fontSize: 12.5,
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
    borderRadius: 22,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  rankActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
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
    gap: 8,
  },
  altaOutfitTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  roleBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  outfitPaletteBar: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 6,
  },
  outfitPaletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  outfitPaletteLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  outfitPaletteSwatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  outfitPaletteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  outfitPaletteDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1,
  },
  outfitPaletteHexText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  seeItOnMePillText: {
    color: '#F3F1EF',
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
    height: 64,
    paddingTop: 12,
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
    color: '#F3F1EF',
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
