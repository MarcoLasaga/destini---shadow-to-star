import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { GeneratedOutfit, OutfitClothingItem } from '../types';
import { useAuth } from './AuthContext';
import { useWardrobe } from './WardrobeContext';
import { useWeather } from '../hooks/useWeather';
import { supabase } from '../integrations/supabase/client';
import {
  generateRecommendations,
  getRecommendationHistory,
  updateRecommendation,
  saveOutfitToApi,
  deleteOutfitFromApi,
  fetchSavedOutfitsFromApi,
  isUuid,
  classifyAnatomicalSlot,
  colorNameToHex,
} from '../services/outfitRecommendationService';
import { triggerSmartAlert } from '../services/notificationService';

const LOCAL_OUTFIT_PREFS_KEY = '@stylesense_outfit_prefs_v1';
const getUserSavedKey = (userId?: string) =>
  userId ? `@stylesense_saved_outfits_${userId}` : '@stylesense_saved_outfits_guest';

interface OutfitContextValue {
  occasion: string;
  setOccasion: (value: string) => void;
  noNewClothesMode: boolean;
  setNoNewClothesMode: (value: boolean) => void;
  toggleNoNewClothesMode: () => void;
  outfitSourceMode: 'closet' | 'bestForOccasion';
  setOutfitSourceMode: (mode: 'closet' | 'bestForOccasion') => void;
  currentOutfit: GeneratedOutfit | null;
  currentOutfits: GeneratedOutfit[];
  isLoading: boolean;
  savedOutfits: GeneratedOutfit[];
  generateOutfit: () => Promise<void>;
  surpriseMe: () => Promise<void>;
  remixCurrentOutfit: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  toggleSave: (id: string) => void;
  markAsWorn: (id: string) => Promise<void>;
  submitWearFeedback: (id: string, rating: number, notes: string) => void;
  submitPreferenceEvent: (id: string, eventType: 'LIKE' | 'DISLIKE') => void;
  renameSavedOutfit: (id: string, newName: string) => void;
  deleteSavedOutfit: (id: string) => void;
  getOutfit: (id: string) => GeneratedOutfit | undefined;
  updateOutfitEverywhere: (id: string, updates: Partial<GeneratedOutfit>) => void;
}

const OutfitContext = createContext<OutfitContextValue | undefined>(undefined);

export function OutfitProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const wardrobe = useWardrobe();
  const { weather } = useWeather();

  const [occasion, setOccasionState] = useState('Any occasion');
  const [noNewClothesMode, setNoNewClothesMode] = useState(true);
  const [outfitSourceMode, setOutfitSourceModeState] = useState<'closet' | 'bestForOccasion'>('closet');
  const [currentOutfit, setCurrentOutfit] = useState<GeneratedOutfit | null>(null);
  const [currentOutfits, setCurrentOutfits] = useState<GeneratedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<GeneratedOutfit[]>([]);
  const [history, setHistory] = useState<Record<string, GeneratedOutfit>>({});
  const [localPrefs, setLocalPrefs] = useState<Record<string, Partial<GeneratedOutfit>>>({});

  useEffect(() => {
    AsyncStorage.getItem(LOCAL_OUTFIT_PREFS_KEY)
      .then((raw) => {
        if (raw) {
          setLocalPrefs(JSON.parse(raw));
        }
      })
      .catch(() => {});
  }, []);

  const persistLocalPref = useCallback((id: string, updates: Partial<GeneratedOutfit>) => {
    setLocalPrefs((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] || {}), ...updates } };
      AsyncStorage.setItem(LOCAL_OUTFIT_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Load user-scoped saved outfits immediately when the logged in user changes
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setSavedOutfits([]);
      return;
    }
    const userKey = getUserSavedKey(userId);
    AsyncStorage.getItem(userKey)
      .then((raw) => {
        if (raw) {
          try {
            const cached = JSON.parse(raw);
            if (Array.isArray(cached) && cached.length > 0) {
              setSavedOutfits(cached);
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  const refreshHistory = useCallback(async () => {
    const userId = session?.user?.id;
    const token = session?.access_token;
    if (!userId) return;

    const userKey = getUserSavedKey(userId);

    // 1. Load local cached saved outfits
    let localSaved: GeneratedOutfit[] = [];
    try {
      const raw = await AsyncStorage.getItem(userKey);
      if (raw) {
        localSaved = JSON.parse(raw);
      }
    } catch {}

    // 2. Fetch remote saved outfits from backend /outfits
    let remoteSaved: GeneratedOutfit[] = [];
    if (token) {
      try {
        remoteSaved = await fetchSavedOutfitsFromApi(token);
      } catch {}
    }

    // 3. Fallback check to Supabase directly if remoteSaved returned empty
    if (remoteSaved.length === 0) {
      try {
        const { data: dbRows } = await supabase
          .from('outfit_recommendations' as any)
          .select('*')
          .eq('user_id', userId)
          .eq('is_saved', true)
          .order('created_at', { ascending: false });

        if (dbRows && dbRows.length > 0) {
          remoteSaved = dbRows.map((row: any, idx: number) => {
            const matchedItems: OutfitClothingItem[] = (row.item_ids || [])
              .map((iId: string) => wardrobe.items.find((w) => w.id === iId))
              .filter(Boolean)
              .map((w: any) => ({
                id: w.id,
                name: w.name,
                category: w.category,
                image: w.image,
                color: w.color || 'Neutral',
                hexColor: colorNameToHex(w.color),
                slotType: classifyAnatomicalSlot(w.name, w.category),
                status: w.status || 'clean',
              }));

            return {
              id: row.id,
              name: `${row.occasion || 'Curated'} Look #${idx + 1}`,
              badge: 'Saved Look',
              image: matchedItems[0]?.image || '',
              occasionLabel: row.occasion || 'Casual',
              matchPercent: row.score || 90,
              hybridScore: row.score || 90,
              contentScore: row.score || 90,
              collaborativeScore: row.score || 90,
              sustainPercent: 100,
              comfortRating: 5,
              weatherCondition: 'Clear',
              weatherTempF: 75,
              location: 'Makati, PH',
              clothingItems: matchedItems,
              colorPalette: matchedItems.slice(0, 4).map((m) => ({
                name: m.color || 'Neutral',
                hex: m.hexColor || colorNameToHex(m.color),
              })),
              colorHarmonyExplanation: 'Harmonious palette curated from your closet.',
              howToWearBullets: ['Layer cleanly and wear with confidence.'],
              feedback: [
                { id: `fb-${row.id}-1`, stars: 5, quote: 'Very balanced silhouette and comfortable for everyday wear.' },
              ],
              whyReasons: (row.reasons || []).map((r: string, rIdx: number) => ({
                id: `r-${rIdx}`,
                icon: 'sparkles-outline',
                title: 'Recommendation',
                description: r,
              })),
              favorited: true,
              saved: true,
              worn: Boolean(row.is_worn),
            };
          });
        }
      } catch {}
    }

    // 4. Merge strategy: combine local and remote without wiping
    const mergedMap = new Map<string, GeneratedOutfit>();
    for (const outfit of localSaved) {
      if (outfit?.id && outfit.saved !== false) {
        mergedMap.set(outfit.id, outfit);
      }
    }
    for (const outfit of remoteSaved) {
      if (outfit?.id) {
        const existing = mergedMap.get(outfit.id);
        mergedMap.set(outfit.id, { ...(existing || {}), ...outfit, saved: true });
      }
    }

    const mergedList = Array.from(mergedMap.values());
    if (mergedList.length > 0 || localSaved.length > 0) {
      setSavedOutfits(mergedList);
      AsyncStorage.setItem(userKey, JSON.stringify(mergedList)).catch(() => {});
    }

    // 5. Sync any local outfits not yet in remote to Supabase
    if (localSaved.length > 0) {
      for (const localOutfit of localSaved) {
        if (!remoteSaved.some((r) => r.id === localOutfit.id)) {
          if (token) {
            saveOutfitToApi(localOutfit, token).catch(() => {});
          }
          const itemIds = (localOutfit.clothingItems || [])
            .map((i) => i.id)
            .filter((id) => isUuid(id));
          Promise.resolve(
            supabase
              .from('outfit_recommendations' as any)
              .upsert({
                id: isUuid(localOutfit.id) ? localOutfit.id : Crypto.randomUUID(),
                user_id: userId,
                occasion: localOutfit.occasionLabel || 'Casual',
                item_ids: itemIds,
                score: localOutfit.matchPercent || 88,
                reasons: (localOutfit.whyReasons || []).map((r) => `${r.title}: ${r.description}`),
                is_saved: true,
                is_worn: Boolean(localOutfit.worn),
                updated_at: new Date().toISOString(),
              })
          ).catch(() => {});
        }
      }
    }

    // Also populate recommendation history
    if (token) {
      try {
        const historyOutfits = await getRecommendationHistory(token);
        if (historyOutfits && historyOutfits.length > 0) {
          setHistory((prev) => ({
            ...prev,
            ...Object.fromEntries(historyOutfits.map((o) => [o.id, o])),
          }));
        }
      } catch {}
    }
  }, [session, wardrobe.items]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const runWithLoading = useCallback(
    async (
      selectedOccasion: string,
      modeOverride?: boolean,
      sourceOverride?: 'closet' | 'bestForOccasion'
    ) => {
      setIsLoading(true);
      try {
        const activeNoNewClothes = modeOverride !== undefined ? modeOverride : noNewClothesMode;
        const activeSource = sourceOverride !== undefined ? sourceOverride : outfitSourceMode;
        const outfits = await generateRecommendations(selectedOccasion, session?.access_token || '', {
          noNewClothesMode: activeNoNewClothes,
          outfitSourceMode: activeSource,
          weather,
          wardrobeItems: wardrobe.items,
        });

        const top3 = outfits.slice(0, 3).map((o) => (localPrefs[o.id] ? { ...o, ...localPrefs[o.id] } : o));
        const primary = top3[0] ?? null;
        setCurrentOutfits(top3);
        setCurrentOutfit(primary);

        if (top3.length) {
          setHistory((prev) => ({
            ...prev,
            ...Object.fromEntries(top3.map((item) => [item.id, item])),
          }));
        }
      } catch {
        // Silently handle any recommendation error
      } finally {
        setIsLoading(false);
      }
    },
    [session, noNewClothesMode, outfitSourceMode, weather, wardrobe.items, localPrefs]
  );

  const setOccasion = useCallback(
    (newOccasion: string) => {
      setOccasionState(newOccasion);
      runWithLoading(newOccasion, noNewClothesMode, outfitSourceMode);
    },
    [noNewClothesMode, outfitSourceMode, runWithLoading]
  );

  const setOutfitSourceMode = useCallback(
    (newSourceMode: 'closet' | 'bestForOccasion') => {
      setOutfitSourceModeState(newSourceMode);
      runWithLoading(occasion, noNewClothesMode, newSourceMode);
    },
    [occasion, noNewClothesMode, runWithLoading]
  );

  const toggleNoNewClothesMode = useCallback(() => {
    setNoNewClothesMode((prev) => {
      const next = !prev;
      const nextSource: 'closet' | 'bestForOccasion' = next ? 'closet' : 'bestForOccasion';
      setOutfitSourceModeState(nextSource);
      runWithLoading(occasion, next, nextSource);
      if (next) {
        triggerSmartAlert({
          type: 'Sustainability',
          title: '♻ No New Clothes Mode Active',
          body: 'Prioritizing unworn clothes in your closet.',
          targetRoute: 'Wardrobe',
        }).catch(() => {});
      }
      return next;
    });
  }, [occasion, runWithLoading]);

  const generateOutfit = useCallback(() => {
    return runWithLoading(occasion);
  }, [occasion, runWithLoading]);

  const surpriseMe = useCallback(() => {
    return runWithLoading('Any occasion');
  }, [runWithLoading]);

  const remixCurrentOutfit = useCallback(async () => {
    if (currentOutfit && session?.access_token) {
      await updateRecommendation(currentOutfit.id, { eventType: 'SKIP' }, session.access_token).catch(() => {});
    }
    await runWithLoading(occasion);
  }, [currentOutfit, occasion, runWithLoading, session]);

  const updateOutfitEverywhere = useCallback(
    (id: string, updates: Partial<GeneratedOutfit>) => {
      setCurrentOutfit((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
      setCurrentOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
      setSavedOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
      setHistory((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...updates } } : prev));
      persistLocalPref(id, updates);
    },
    [persistLocalPref]
  );

  const findTargetOutfit = useCallback(
    (id: string): GeneratedOutfit | undefined => {
      if (currentOutfit?.id === id) return currentOutfit;
      return (
        currentOutfits.find((o) => o.id === id) ??
        history[id] ??
        savedOutfits.find((o) => o.id === id)
      );
    },
    [currentOutfit, currentOutfits, history, savedOutfits]
  );

  const toggleSave = useCallback(
    async (id: string) => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const nextSaved = !target.saved;
      const validId = isUuid(id) ? id : Crypto.randomUUID();
      const updatedTarget: GeneratedOutfit = {
        ...target,
        id: validId,
        saved: nextSaved,
        favorited: nextSaved ? true : target.favorited,
      };

      updateOutfitEverywhere(id, { id: validId, saved: nextSaved, favorited: nextSaved ? true : target.favorited });

      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);

      setSavedOutfits((prev) => {
        let next: GeneratedOutfit[];
        if (nextSaved) {
          const exists = prev.some((o) => o.id === validId || o.id === id);
          next = exists
            ? prev.map((o) => (o.id === validId || o.id === id ? updatedTarget : o))
            : [updatedTarget, ...prev];
        } else {
          next = prev.filter((o) => o.id !== id && o.id !== validId);
        }
        if (userId) {
          AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
        }
        return next;
      });

      if (session?.access_token) {
        if (nextSaved) {
          saveOutfitToApi(updatedTarget, session.access_token).catch(() => {});
        } else {
          deleteOutfitFromApi(validId, session.access_token).catch(() => {});
        }
      }

      if (userId) {
        const itemIds = (updatedTarget.clothingItems || [])
          .map((i) => i.id)
          .filter((iId) => isUuid(iId));
        Promise.resolve(
          supabase
            .from('outfit_recommendations' as any)
            .upsert({
              id: validId,
              user_id: userId,
              occasion: updatedTarget.occasionLabel || 'Casual',
              item_ids: itemIds,
              score: updatedTarget.matchPercent || 88,
              reasons: (updatedTarget.whyReasons || []).map((r) => `${r.title}: ${r.description}`),
              is_saved: nextSaved,
              is_worn: Boolean(updatedTarget.worn),
              updated_at: new Date().toISOString(),
            })
        ).catch(() => {});
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, session]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const nextFav = !target.favorited;
      updateOutfitEverywhere(id, { favorited: nextFav, disliked: false });
      if (nextFav) {
        if (!target.saved) {
          toggleSave(id);
        }
      } else {
        if (session?.access_token) {
          updateRecommendation(
            id,
            { eventType: 'UNSAVE', isSaved: false },
            session.access_token
          ).catch(() => {});
        }
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, toggleSave, session]
  );

  const markAsWorn = useCallback(
    async (id: string) => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const nextWorn = !target.worn;
      updateOutfitEverywhere(id, { worn: nextWorn });

      if (session?.access_token) {
        updateRecommendation(
          id,
          { isWorn: nextWorn, eventType: nextWorn ? 'WORN' : 'UNSAVE' },
          session.access_token
        ).catch(() => {});
      }

      if (target?.clothingItems?.length) {
        const itemIds = target.clothingItems
          .filter((item) => !item.isSuggested && !item.id.startsWith('suggested-'))
          .map((item) => item.id);
        if (itemIds.length > 0) {
          if (nextWorn) {
            await wardrobe.recordWear(itemIds);
          } else {
            await wardrobe.unrecordWear(itemIds);
          }
        }
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, session, wardrobe]
  );

  const submitWearFeedback = useCallback(
    (id: string, rating: number, notes: string) => {
      updateOutfitEverywhere(id, { wearRating: rating, wearNotes: notes });
      if (session?.access_token) {
        updateRecommendation(
          id,
          {
            rating,
            note: notes,
            eventType: rating >= 4 ? 'LIKE' : rating <= 2 ? 'DISLIKE' : 'RATING',
          },
          session.access_token
        ).catch(() => {});
      }
    },
    [updateOutfitEverywhere, session]
  );

  const submitPreferenceEvent = useCallback(
    (id: string, eventType: 'LIKE' | 'DISLIKE') => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const isLike = eventType === 'LIKE';
      updateOutfitEverywhere(id, { favorited: isLike, disliked: !isLike });
      if (session?.access_token) {
        updateRecommendation(id, { eventType }, session.access_token).catch(() => {});
      }
      if (isLike && !target.saved) {
        toggleSave(id);
      }
    },
    [findTargetOutfit, session, updateOutfitEverywhere, toggleSave]
  );

  const renameSavedOutfit = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      updateOutfitEverywhere(id, { name: trimmed });
      const userId = session?.user?.id;
      if (userId) {
        const userKey = getUserSavedKey(userId);
        setSavedOutfits((prev) => {
          const next = prev.map((o) => (o.id === id ? { ...o, name: trimmed } : o));
          AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
      }
    },
    [updateOutfitEverywhere, session]
  );

  const deleteSavedOutfit = useCallback(
    (id: string) => {
      updateOutfitEverywhere(id, { saved: false });
      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);
      setSavedOutfits((prev) => {
        const next = prev.filter((o) => o.id !== id);
        if (userId) {
          AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
        }
        return next;
      });
      if (session?.access_token) {
        deleteOutfitFromApi(id, session.access_token).catch(() => {});
      }
      if (userId && isUuid(id)) {
        Promise.resolve(
          supabase
            .from('outfit_recommendations' as any)
            .update({ is_saved: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
        ).catch(() => {});
      }
    },
    [updateOutfitEverywhere, session]
  );

  const getOutfit = useCallback(
    (id: string) => findTargetOutfit(id),
    [findTargetOutfit]
  );

  return (
    <OutfitContext.Provider
      value={{
        occasion,
        setOccasion,
        noNewClothesMode,
        setNoNewClothesMode,
        toggleNoNewClothesMode,
        outfitSourceMode,
        setOutfitSourceMode,
        currentOutfit,
        currentOutfits,
        isLoading,
        savedOutfits,
        generateOutfit,
        surpriseMe,
        remixCurrentOutfit,
        toggleFavorite,
        toggleSave,
        markAsWorn,
        submitWearFeedback,
        submitPreferenceEvent,
        renameSavedOutfit,
        deleteSavedOutfit,
        getOutfit,
        updateOutfitEverywhere,
      }}
    >
      {children}
    </OutfitContext.Provider>
  );
}

export function useOutfit() {
  const ctx = useContext(OutfitContext);
  if (!ctx) throw new Error('useOutfit must be used within OutfitProvider');
  return ctx;
}
