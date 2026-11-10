import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { GeneratedOutfit, OutfitClothingItem } from '../types';
import { useAuth } from './AuthContext';
import { useWardrobe } from './WardrobeContext';
import { useProfile } from './ProfileContext';
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
const getUserDeletedKey = (userId?: string) =>
  userId ? `@stylesense_deleted_outfit_ids_${userId}` : '@stylesense_deleted_outfit_ids_guest';

export function getOutfitItemsSignature(outfit?: GeneratedOutfit | null): string {
  if (!outfit || !Array.isArray(outfit.clothingItems) || outfit.clothingItems.length === 0) {
    return '';
  }
  return outfit.clothingItems
    .map((i) => String(i.id || i.name || '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('__');
}

export function isPlaceholderOrEmptyOutfit(outfit?: GeneratedOutfit | null): boolean {
  if (!outfit) return true;
  const title = String(outfit.name || '').trim();
  if (/^(Curated Look #\d+|Optimal Hybrid Outfit)$/i.test(title)) {
    return true;
  }
  if (!Array.isArray(outfit.clothingItems) || outfit.clothingItems.length === 0) {
    return true;
  }
  return false;
}

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
  const { profile } = useProfile();
  const { weather } = useWeather();

  const [occasion, setOccasionState] = useState('Any occasion');
  const [noNewClothesMode, setNoNewClothesMode] = useState(true);
  const [outfitSourceMode, setOutfitSourceModeState] = useState<'closet' | 'bestForOccasion'>('closet');
  const [currentOutfit, setCurrentOutfit] = useState<GeneratedOutfit | null>(null);
  const [currentOutfits, setCurrentOutfits] = useState<GeneratedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<GeneratedOutfit[]>([]);
  const [deletedOutfitIds, setDeletedOutfitIds] = useState<Set<string>>(new Set());
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

  const recordDeletedOutfit = useCallback(
    (id: string, sig?: string, userId?: string) => {
      const delKey = getUserDeletedKey(userId);
      setDeletedOutfitIds((prev) => {
        const next = new Set(prev);
        if (id) next.add(id);
        if (sig) next.add(sig);
        AsyncStorage.setItem(delKey, JSON.stringify(Array.from(next))).catch(() => {});
        return next;
      });
    },
    []
  );

  const unrecordDeletedOutfit = useCallback(
    (id: string, sig?: string, userId?: string) => {
      const delKey = getUserDeletedKey(userId);
      setDeletedOutfitIds((prev) => {
        const next = new Set(prev);
        if (id) next.delete(id);
        if (sig) next.delete(sig);
        AsyncStorage.setItem(delKey, JSON.stringify(Array.from(next))).catch(() => {});
        return next;
      });
    },
    []
  );

  // Load user-scoped saved outfits and deleted outfit IDs immediately when the logged in user changes
  useEffect(() => {
    const userId = session?.user?.id;
    const userKey = getUserSavedKey(userId);
    const delKey = getUserDeletedKey(userId);

    Promise.all([AsyncStorage.getItem(userKey), AsyncStorage.getItem(delKey)])
      .then(([rawSaved, rawDeleted]) => {
        const delSet = new Set<string>();
        if (rawDeleted) {
          try {
            const parsedDel = JSON.parse(rawDeleted);
            if (Array.isArray(parsedDel)) {
              parsedDel.forEach((entry) => delSet.add(String(entry)));
            }
          } catch {}
        }
        setDeletedOutfitIds(delSet);

        if (!userId) {
          setSavedOutfits([]);
          return;
        }

        if (rawSaved) {
          try {
            const cached = JSON.parse(rawSaved);
            if (Array.isArray(cached)) {
              const filtered = cached.filter((o: GeneratedOutfit) => {
                if (isPlaceholderOrEmptyOutfit(o)) return false;
                if (o.saved === false) return false;
                const sig = getOutfitItemsSignature(o);
                if (delSet.has(o.id) || (sig && delSet.has(sig))) return false;
                return true;
              });
              setSavedOutfits(filtered);
              if (filtered.length !== cached.length) {
                AsyncStorage.setItem(userKey, JSON.stringify(filtered)).catch(() => {});
              }
            }
          } catch {}
        } else {
          setSavedOutfits([]);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  const refreshHistory = useCallback(async () => {
    const userId = session?.user?.id;
    const token = session?.access_token;
    if (!userId) return;

    const userKey = getUserSavedKey(userId);
    const delKey = getUserDeletedKey(userId);

    // 0. Load deleted outfit IDs / signatures
    const delSet = new Set<string>(deletedOutfitIds);
    try {
      const rawDel = await AsyncStorage.getItem(delKey);
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (Array.isArray(parsedDel)) {
          parsedDel.forEach((d) => delSet.add(String(d)));
        }
      }
    } catch {}

    // 1. Load local cached saved outfits (excluding placeholder/empty or deleted outfits)
    let localSaved: GeneratedOutfit[] = [];
    try {
      const raw = await AsyncStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localSaved = parsed.filter((o: GeneratedOutfit) => {
            if (isPlaceholderOrEmptyOutfit(o) || o.saved === false) return false;
            const sig = getOutfitItemsSignature(o);
            return !delSet.has(o.id) && (!sig || !delSet.has(sig));
          });
        }
      }
    } catch {}

    // 2. Fetch remote saved outfits from backend /outfits
    let remoteSaved: GeneratedOutfit[] = [];
    if (token) {
      try {
        const apiList = await fetchSavedOutfitsFromApi(token);
        for (const ro of apiList) {
          const sig = getOutfitItemsSignature(ro);
          if (isPlaceholderOrEmptyOutfit(ro) || delSet.has(ro.id) || (sig && delSet.has(sig))) {
            // Proactively purge placeholder or deleted outfit from backend & Supabase
            deleteOutfitFromApi(ro.id, token).catch(() => {});
            if (isUuid(ro.id)) {
              Promise.resolve(
                supabase
                  .from('outfit_recommendations' as any)
                  .delete()
                  .eq('id', ro.id)
                  .eq('user_id', userId)
              ).catch(() => {});
            }
          } else {
            remoteSaved.push(ro);
          }
        }
      } catch {}
    }

    // 3. Fallback check to Supabase directly if remoteSaved returned empty (never generating "Curated Look #2, #3, #4" with empty items)
    if (remoteSaved.length === 0) {
      try {
        const { data: dbRows } = await supabase
          .from('outfit_recommendations' as any)
          .select('*')
          .eq('user_id', userId)
          .eq('is_saved', true)
          .order('created_at', { ascending: false });

        if (dbRows && dbRows.length > 0) {
          for (const row of dbRows as any[]) {
            if (delSet.has(row.id)) continue;
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

            // Never create empty white box "Curated Look #2, #3, #4" entries when items are missing
            if (matchedItems.length === 0) {
              Promise.resolve(
                supabase
                  .from('outfit_recommendations' as any)
                  .update({ is_saved: false })
                  .eq('id', row.id)
                  .eq('user_id', userId)
              ).catch(() => {});
              continue;
            }

            const candidate: GeneratedOutfit = {
              id: row.id,
              name: `${row.occasion || 'Casual'} Look · ${matchedItems[0].name}`,
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
            const sig = getOutfitItemsSignature(candidate);
            if (!sig || !delSet.has(sig)) {
              remoteSaved.push(candidate);
            }
          }
        }
      } catch {}
    }

    // 4. Merge strategy: combine local and remote while excluding deleted & placeholder outfits
    const mergedMap = new Map<string, GeneratedOutfit>();
    const seenSigs = new Set<string>();
    for (const outfit of localSaved) {
      if (outfit?.id && outfit.saved !== false && !isPlaceholderOrEmptyOutfit(outfit)) {
        const sig = getOutfitItemsSignature(outfit);
        if (!delSet.has(outfit.id) && (!sig || !delSet.has(sig))) {
          mergedMap.set(outfit.id, outfit);
          if (sig) seenSigs.add(sig);
        }
      }
    }
    for (const outfit of remoteSaved) {
      if (outfit?.id && !isPlaceholderOrEmptyOutfit(outfit)) {
        const sig = getOutfitItemsSignature(outfit);
        if (!delSet.has(outfit.id) && (!sig || (!delSet.has(sig) && !seenSigs.has(sig)))) {
          const existing = mergedMap.get(outfit.id);
          mergedMap.set(outfit.id, { ...(existing || {}), ...outfit, saved: true });
          if (sig) seenSigs.add(sig);
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());
    setSavedOutfits(mergedList);
    AsyncStorage.setItem(userKey, JSON.stringify(mergedList)).catch(() => {});

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
          actorGender: profile.gender === 'female' ? 'female' : profile.gender === 'male' ? 'male' : 'unknown',
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
    [session, noNewClothesMode, outfitSourceMode, weather, wardrobe.items, localPrefs, profile.gender]
  );

  const setOccasion = useCallback((newOccasion: string) => {
    setOccasionState(newOccasion);
  }, []);

  const setOutfitSourceMode = useCallback((newSourceMode: 'closet' | 'bestForOccasion') => {
    setOutfitSourceModeState(newSourceMode);
  }, []);

  const toggleNoNewClothesMode = useCallback(() => {
    setNoNewClothesMode((prev) => {
      const next = !prev;
      const nextSource: 'closet' | 'bestForOccasion' = next ? 'closet' : 'bestForOccasion';
      setOutfitSourceModeState(nextSource);
      runWithLoading(occasion, next, nextSource);
      if (next) {
        triggerSmartAlert({
          type: 'Sustainability',
          title: 'No New Clothes Mode Active',
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
      const targetSig = getOutfitItemsSignature(target);
      const updatedTarget: GeneratedOutfit = {
        ...target,
        id: validId,
        saved: nextSaved,
        favorited: nextSaved ? true : false,
      };

      updateOutfitEverywhere(id, {
        id: validId,
        saved: nextSaved,
        favorited: nextSaved ? true : false,
      });

      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);

      if (nextSaved) {
        unrecordDeletedOutfit(validId, targetSig, userId);
        unrecordDeletedOutfit(id, targetSig, userId);
      } else {
        recordDeletedOutfit(validId, targetSig, userId);
        recordDeletedOutfit(id, targetSig, userId);
      }

      setSavedOutfits((prev) => {
        let next: GeneratedOutfit[];
        if (nextSaved) {
          const exists = prev.some(
            (o) =>
              o.id === validId ||
              o.id === id ||
              (targetSig && getOutfitItemsSignature(o) === targetSig)
          );
          next = exists
            ? prev.map((o) =>
                o.id === validId ||
                o.id === id ||
                (targetSig && getOutfitItemsSignature(o) === targetSig)
                  ? updatedTarget
                  : o
              )
            : [updatedTarget, ...prev];
        } else {
          next = prev.filter(
            (o) =>
              o.id !== id &&
              o.id !== validId &&
              (!targetSig || getOutfitItemsSignature(o) !== targetSig)
          );
        }
        AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
        return next;
      });

      if (session?.access_token) {
        if (nextSaved) {
          saveOutfitToApi(updatedTarget, session.access_token).catch(() => {});
        } else {
          deleteOutfitFromApi(validId, session.access_token).catch(() => {});
          if (id !== validId) {
            deleteOutfitFromApi(id, session.access_token).catch(() => {});
          }
        }
      }

      if (userId) {
        if (nextSaved) {
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
                reasons: (updatedTarget.whyReasons || []).map(
                  (r) => `${r.title}: ${r.description}`
                ),
                is_saved: true,
                is_worn: Boolean(updatedTarget.worn),
                updated_at: new Date().toISOString(),
              })
          ).catch(() => {});
        } else {
          Promise.resolve(
            supabase
              .from('outfit_recommendations' as any)
              .delete()
              .in('id', [id, validId].filter(isUuid))
              .eq('user_id', userId)
          ).catch(() => {});
        }
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, session, recordDeletedOutfit, unrecordDeletedOutfit]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const nextFav = !target.favorited;
      const targetSig = getOutfitItemsSignature(target);
      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);

      if (nextFav) {
        // Liking -> set favorited: true, saved: true, and add to savedOutfits
        const validId = isUuid(id) ? id : Crypto.randomUUID();
        const updatedTarget: GeneratedOutfit = {
          ...target,
          id: validId,
          favorited: true,
          saved: true,
          disliked: false,
        };
        updateOutfitEverywhere(id, {
          id: validId,
          favorited: true,
          saved: true,
          disliked: false,
        });
        unrecordDeletedOutfit(validId, targetSig, userId);
        unrecordDeletedOutfit(id, targetSig, userId);

        setSavedOutfits((prev) => {
          const exists = prev.some(
            (o) =>
              o.id === validId ||
              o.id === id ||
              (targetSig && getOutfitItemsSignature(o) === targetSig)
          );
          const next = exists
            ? prev.map((o) =>
                o.id === validId ||
                o.id === id ||
                (targetSig && getOutfitItemsSignature(o) === targetSig)
                  ? updatedTarget
                  : o
              )
            : [updatedTarget, ...prev];
          AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
          return next;
        });

        if (session?.access_token) {
          saveOutfitToApi(updatedTarget, session.access_token).catch(() => {});
        }
      } else {
        // Untoggling Like (abstaining) -> set favorited: false, saved: false, and immediately remove from savedOutfits
        updateOutfitEverywhere(id, {
          favorited: false,
          saved: false,
          disliked: false,
        });
        recordDeletedOutfit(id, targetSig, userId);

        setSavedOutfits((prev) => {
          const removedIds = prev
            .filter(
              (o) =>
                o.id === id ||
                (targetSig && getOutfitItemsSignature(o) === targetSig)
            )
            .map((o) => o.id);
          const next = prev.filter(
            (o) =>
              o.id !== id &&
              (!targetSig || getOutfitItemsSignature(o) !== targetSig)
          );
          AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
          if (session?.access_token) {
            [id, ...removedIds].forEach((rId) => {
              deleteOutfitFromApi(rId, session.access_token!).catch(() => {});
              updateRecommendation(
                rId,
                { eventType: 'UNSAVE', isSaved: false },
                session.access_token!
              ).catch(() => {});
            });
          }
          if (userId) {
            const uuids = Array.from(new Set([id, ...removedIds].filter(isUuid)));
            if (uuids.length > 0) {
              Promise.resolve(
                supabase
                  .from('outfit_recommendations' as any)
                  .delete()
                  .in('id', uuids)
                  .eq('user_id', userId)
              ).catch(() => {});
            }
          }
          return next;
        });
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, session, recordDeletedOutfit, unrecordDeletedOutfit]
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
      const targetSig = getOutfitItemsSignature(target);
      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);

      if (isLike) {
        if (!target.favorited) {
          toggleFavorite(id);
        }
      } else {
        // Switching to DISLIKE -> remove from likedOutfits and savedOutfits immediately
        updateOutfitEverywhere(id, { favorited: false, saved: false, disliked: true });
        recordDeletedOutfit(id, targetSig, userId);
        setSavedOutfits((prev) => {
          const next = prev.filter(
            (o) =>
              o.id !== id &&
              (!targetSig || getOutfitItemsSignature(o) !== targetSig)
          );
          AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
          return next;
        });
        if (session?.access_token) {
          deleteOutfitFromApi(id, session.access_token).catch(() => {});
        }
      }

      if (session?.access_token) {
        updateRecommendation(id, { eventType }, session.access_token).catch(() => {});
      }
    },
    [findTargetOutfit, session, updateOutfitEverywhere, toggleFavorite, recordDeletedOutfit]
  );

  const renameSavedOutfit = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      updateOutfitEverywhere(id, { name: trimmed });
      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);
      setSavedOutfits((prev) => {
        const next = prev.map((o) => (o.id === id ? { ...o, name: trimmed } : o));
        AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [updateOutfitEverywhere, session]
  );

  const deleteSavedOutfit = useCallback(
    (id: string) => {
      const target = findTargetOutfit(id);
      const targetSig = getOutfitItemsSignature(target);
      const userId = session?.user?.id;
      const userKey = getUserSavedKey(userId);

      updateOutfitEverywhere(id, { saved: false, favorited: false });
      recordDeletedOutfit(id, targetSig, userId);

      setSavedOutfits((prev) => {
        const next = prev.filter(
          (o) =>
            o.id !== id &&
            (!targetSig || getOutfitItemsSignature(o) !== targetSig)
        );
        AsyncStorage.setItem(userKey, JSON.stringify(next)).catch(() => {});
        return next;
      });

      if (session?.access_token) {
        deleteOutfitFromApi(id, session.access_token).catch(() => {});
      }
      if (userId && isUuid(id)) {
        Promise.resolve(
          supabase
            .from('outfit_recommendations' as any)
            .delete()
            .eq('id', id)
            .eq('user_id', userId)
        ).catch(() => {});
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, session, recordDeletedOutfit]
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
