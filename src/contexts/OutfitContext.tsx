import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeneratedOutfit } from '../types';
import { useAuth } from './AuthContext';
import { useWardrobe } from './WardrobeContext';
import { useWeather } from '../hooks/useWeather';
import {
  generateRecommendations,
  getRecommendationHistory,
  updateRecommendation,
} from '../services/outfitRecommendationService';
import { triggerSmartAlert } from '../services/notificationService';

const LOCAL_OUTFIT_PREFS_KEY = '@stylesense_outfit_prefs_v1';

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
  const [noNewClothesMode, setNoNewClothesMode] = useState(false);
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

  const refreshHistory = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const outfits = await getRecommendationHistory(session.access_token);
      setHistory(Object.fromEntries(outfits.map((outfit) => [outfit.id, outfit])));
      setSavedOutfits(outfits.filter((outfit) => outfit.saved));
    } catch {
      // Silently ignore history fetch errors
    }
  }, [session]);

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
      runWithLoading(occasion, next, outfitSourceMode);
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
  }, [occasion, outfitSourceMode, runWithLoading]);

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

  const toggleFavorite = useCallback(
    (id: string) => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const nextFav = !target.favorited;
      updateOutfitEverywhere(id, { favorited: nextFav, disliked: false });
      if (session?.access_token) {
        updateRecommendation(
          id,
          { eventType: nextFav ? 'LIKE' : 'UNSAVE', isSaved: nextFav },
          session.access_token
        ).catch(() => {});
      }
    },
    [findTargetOutfit, updateOutfitEverywhere, session]
  );

  const toggleSave = useCallback(
    (id: string) => {
      const target = findTargetOutfit(id);
      if (!target) return;
      const nextSaved = !target.saved;
      updateOutfitEverywhere(id, { saved: nextSaved });
      if (session?.access_token) {
        updateRecommendation(
          id,
          { isSaved: nextSaved, eventType: nextSaved ? 'SAVE' : 'UNSAVE' },
          session.access_token
        ).catch(() => {});
      }
      setSavedOutfits((prev) => {
        if (nextSaved) {
          const alreadyIn = prev.some((o) => o.id === id);
          return alreadyIn ? prev : [{ ...target, saved: true }, ...prev];
        }
        return prev.filter((o) => o.id !== id);
      });
    },
    [findTargetOutfit, updateOutfitEverywhere, session]
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
    },
    [findTargetOutfit, session, updateOutfitEverywhere]
  );

  const renameSavedOutfit = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      updateOutfitEverywhere(id, { name: trimmed });
    },
    [updateOutfitEverywhere]
  );

  const deleteSavedOutfit = useCallback(
    (id: string) => {
      updateOutfitEverywhere(id, { saved: false });
      setSavedOutfits((prev) => prev.filter((o) => o.id !== id));
      if (session?.access_token) {
        updateRecommendation(
          id,
          { isSaved: false, eventType: 'UNSAVE' },
          session.access_token
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
