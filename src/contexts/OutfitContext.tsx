import React, { createContext, useContext, useState, useCallback } from 'react';
import { GeneratedOutfit } from '../types';
import { useAuth } from './AuthContext';
import { generateRecommendations, updateRecommendation } from '../services/outfitRecommendationService';

interface OutfitContextValue {
  occasion: string;
  setOccasion: (value: string) => void;
  currentOutfit: GeneratedOutfit | null;
  isLoading: boolean;
  savedOutfits: GeneratedOutfit[];
  generateOutfit: () => Promise<void>;
  surpriseMe: () => Promise<void>;
  remixCurrentOutfit: () => void;
  toggleFavorite: (id: string) => void;
  toggleSave: (id: string) => void;
  markAsWorn: (id: string) => void;
  submitWearFeedback: (id: string, rating: number, notes: string) => void;
  getOutfit: (id: string) => GeneratedOutfit | undefined;
}

const OutfitContext = createContext<OutfitContextValue | undefined>(undefined);

export function OutfitProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [occasion, setOccasion] = useState('Any occasion');
  const [currentOutfit, setCurrentOutfit] = useState<GeneratedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<GeneratedOutfit[]>([]);
  const [history, setHistory] = useState<Record<string, GeneratedOutfit>>({});

  const runWithLoading = useCallback(async (selectedOccasion: string) => {
    if (!session?.access_token) return;
    setIsLoading(true);
    try {
      const outfits = await generateRecommendations(selectedOccasion, session.access_token);
      const outfit = outfits[0] ?? null;
      setCurrentOutfit(outfit);
      if (outfit) setHistory((prev) => ({ ...prev, [outfit.id]: outfit }));
    } finally { setIsLoading(false); }
  }, [session]);

  const generateOutfit = useCallback(() => {
    return runWithLoading(occasion);
  }, [occasion, runWithLoading]);

  const surpriseMe = useCallback(() => {
    return runWithLoading('Any occasion');
  }, [runWithLoading]);

  const remixCurrentOutfit = useCallback(() => {
    return runWithLoading(occasion);
  }, [currentOutfit, runWithLoading]);

  const updateOutfitEverywhere = useCallback((id: string, updates: Partial<GeneratedOutfit>) => {
    setCurrentOutfit((prev) => (prev && prev.id === id ? { ...prev, ...updates } : prev));
    setSavedOutfits((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    setHistory((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...updates } } : prev));
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      const target = currentOutfit?.id === id ? currentOutfit : history[id];
      if (!target) return;
      updateOutfitEverywhere(id, { favorited: !target.favorited });
    },
    [currentOutfit, history, updateOutfitEverywhere]
  );

  const toggleSave = useCallback(
    (id: string) => {
      const target = currentOutfit?.id === id ? currentOutfit : history[id];
      if (!target) return;
      const nextSaved = !target.saved;
      updateOutfitEverywhere(id, { saved: nextSaved, favorited: nextSaved });
      if (session?.access_token) updateRecommendation(id, { isSaved: nextSaved }, session.access_token).catch(console.error);
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
    (id: string) => {
      updateOutfitEverywhere(id, { worn: true });
      if (session?.access_token) updateRecommendation(id, { isWorn: true }, session.access_token).catch(console.error);
    },
    [updateOutfitEverywhere, session]
  );

  const submitWearFeedback = useCallback(
    (id: string, rating: number, notes: string) => {
      updateOutfitEverywhere(id, { wearRating: rating, wearNotes: notes });
      if (session?.access_token) updateRecommendation(id, { rating, note: notes }, session.access_token).catch(console.error);
    },
    [updateOutfitEverywhere, session]
  );

  const getOutfit = useCallback(
    (id: string) => {
      if (currentOutfit?.id === id) return currentOutfit;
      return history[id] ?? savedOutfits.find((o) => o.id === id);
    },
    [currentOutfit, history, savedOutfits]
  );

  return (
    <OutfitContext.Provider
      value={{
        occasion,
        setOccasion,
        currentOutfit,
        isLoading,
        savedOutfits,
        generateOutfit,
        surpriseMe,
        remixCurrentOutfit,
        toggleFavorite,
        toggleSave,
        markAsWorn,
        submitWearFeedback,
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
