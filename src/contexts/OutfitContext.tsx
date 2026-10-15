import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GeneratedOutfit } from '../types';
import { useAuth } from './AuthContext';
import { useWardrobe } from './WardrobeContext';
import { useWeather } from '../hooks/useWeather';
import {
  generateRecommendations,
  getRecommendationHistory,
  updateRecommendation,
} from '../services/outfitRecommendationService';

interface OutfitContextValue {
  occasion: string;
  setOccasion: (value: string) => void;
  noNewClothesMode: boolean;
  setNoNewClothesMode: (value: boolean) => void;
  toggleNoNewClothesMode: () => void;
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
}

const OutfitContext = createContext<OutfitContextValue | undefined>(undefined);

export function OutfitProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const wardrobe = useWardrobe();
  const { weather } = useWeather();

  const [occasion, setOccasion] = useState('Any occasion');
  const [noNewClothesMode, setNoNewClothesMode] = useState(false);
  const [currentOutfit, setCurrentOutfit] = useState<GeneratedOutfit | null>(null);
  const [currentOutfits, setCurrentOutfits] = useState<GeneratedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<GeneratedOutfit[]>([]);
  const [history, setHistory] = useState<Record<string, GeneratedOutfit>>({});

  const refreshHistory = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const outfits = await getRecommendationHistory(session.access_token);
      setHistory(Object.fromEntries(outfits.map((outfit) => [outfit.id, outfit])));
      setSavedOutfits(outfits.filter((outfit) => outfit.saved));
    } catch (error) {
      console.warn('Unable to load outfit history', error);
    }
  }, [session]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const runWithLoading = useCallback(
    async (selectedOccasion: string, modeOverride?: boolean) => {
      if (!session?.access_token) return;
      setIsLoading(true);
      try {
        const activeNoNewClothes = modeOverride !== undefined ? modeOverride : noNewClothesMode;
        const outfits = await generateRecommendations(selectedOccasion, session.access_token, {
          noNewClothesMode: activeNoNewClothes,
          weather,
        });

        const top3 = outfits.slice(0, 3);
        const primary = top3[0] ?? null;
        setCurrentOutfits(top3);
        setCurrentOutfit(primary);

        if (top3.length) {
          setHistory((prev) => ({
            ...prev,
            ...Object.fromEntries(top3.map((item) => [item.id, item])),
          }));
        }
      } catch (err) {
        console.error('Failed to generate recommendations', err);
      } finally {
        setIsLoading(false);
      }
    },
    [session, noNewClothesMode, weather]
  );

  const toggleNoNewClothesMode = useCallback(() => {
    setNoNewClothesMode((prev) => {
      const next = !prev;
      runWithLoading(occasion, next);
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
      await updateRecommendation(currentOutfit.id, { eventType: 'SKIP' }, session.access_token).catch(
        console.error
      );
    }
    await runWithLoading(occasion);
  }, [currentOutfit, occasion, runWithLoading, session]);

  const updateOutfitEverywhere = useCallback((id: string, updates: Partial<GeneratedOutfit>) => {
    setCurrentOutfit((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
    setCurrentOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    setSavedOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    setHistory((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...updates } } : prev));
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      const target = currentOutfit?.id === id ? currentOutfit : history[id];
      if (!target) return;
      const nextFav = !target.favorited;
      updateOutfitEverywhere(id, { favorited: nextFav, disliked: false });
      if (session?.access_token) {
        updateRecommendation(
          id,
          { eventType: nextFav ? 'LIKE' : 'UNSAVE', isSaved: nextFav },
          session.access_token
        ).catch(console.error);
      }
    },
    [currentOutfit, history, updateOutfitEverywhere, session]
  );

  const toggleSave = useCallback(
    (id: string) => {
      const target = currentOutfit?.id === id ? currentOutfit : history[id];
      if (!target) return;
      const nextSaved = !target.saved;
      updateOutfitEverywhere(id, { saved: nextSaved });
      if (session?.access_token) {
        updateRecommendation(
          id,
          { isSaved: nextSaved, eventType: nextSaved ? 'SAVE' : 'UNSAVE' },
          session.access_token
        ).catch(console.error);
      }
      setSavedOutfits((prev) => {
        if (nextSaved) {
          const alreadyIn = prev.some((o) => o.id === id);
          return alreadyIn ? prev : [{ ...target, saved: true }, ...prev];
        }
        return prev.filter((o) => o.id !== id);
      });
    },
    [currentOutfit, history, updateOutfitEverywhere, session]
  );

  const markAsWorn = useCallback(
    async (id: string) => {
      const target = currentOutfit?.id === id ? currentOutfit : history[id] ?? currentOutfits.find((o) => o.id === id);
      if (!target) return;
      const nextWorn = !target.worn;
      updateOutfitEverywhere(id, { worn: nextWorn });

      // Update backend recommendation
      if (session?.access_token) {
        updateRecommendation(
          id,
          { isWorn: nextWorn, eventType: nextWorn ? 'WORN' : 'UNSAVE' },
          session.access_token
        ).catch(console.error);
      }

      // Immediately update wear_count and laundry_status for each garment in user's wardrobe
      if (target?.clothingItems?.length) {
        const itemIds = target.clothingItems.map((item) => item.id);
        if (nextWorn) {
          await wardrobe.recordWear(itemIds);
        } else {
          await wardrobe.unrecordWear(itemIds);
        }
      }
    },
    [currentOutfit, history, currentOutfits, updateOutfitEverywhere, session, wardrobe]
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
        ).catch(console.error);
      }
    },
    [updateOutfitEverywhere, session]
  );

  const submitPreferenceEvent = useCallback(
    (id: string, eventType: 'LIKE' | 'DISLIKE') => {
      const target = currentOutfit?.id === id ? currentOutfit : history[id];
      if (!target) return;
      const isLike = eventType === 'LIKE';
      updateOutfitEverywhere(id, { favorited: isLike, disliked: !isLike });
      if (session?.access_token) {
        updateRecommendation(id, { eventType }, session.access_token).catch(console.error);
      }
    },
    [currentOutfit, history, session, updateOutfitEverywhere]
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
        ).catch(console.error);
      }
    },
    [updateOutfitEverywhere, session]
  );

  const getOutfit = useCallback(
    (id: string) => {
      if (currentOutfit?.id === id) return currentOutfit;
      return history[id] ?? currentOutfits.find((o) => o.id === id) ?? savedOutfits.find((o) => o.id === id);
    },
    [currentOutfit, history, currentOutfits, savedOutfits]
  );

  return (
    <OutfitContext.Provider
      value={{
        occasion,
        setOccasion,
        noNewClothesMode,
        setNoNewClothesMode,
        toggleNoNewClothesMode,
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
