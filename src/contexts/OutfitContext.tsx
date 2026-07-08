import React, { createContext, useContext, useState, useCallback } from 'react';
import { GeneratedOutfit } from '../types';
import { buildOutfitFromTemplate, buildSurpriseOutfit, remixOutfit } from '../constants/outfitMockData';

interface OutfitContextValue {
  occasion: string;
  setOccasion: (value: string) => void;
  currentOutfit: GeneratedOutfit | null;
  isLoading: boolean;
  savedOutfits: GeneratedOutfit[];
  generateOutfit: () => void;
  surpriseMe: () => void;
  remixCurrentOutfit: () => void;
  toggleFavorite: (id: string) => void;
  toggleSave: (id: string) => void;
  markAsWorn: (id: string) => void;
  submitWearFeedback: (id: string, rating: number, notes: string) => void;
  getOutfit: (id: string) => GeneratedOutfit | undefined;
}

const OutfitContext = createContext<OutfitContextValue | undefined>(undefined);

const LOADING_DURATION = 1400;

export function OutfitProvider({ children }: { children: React.ReactNode }) {
  const [occasion, setOccasion] = useState('Any occasion');
  const [currentOutfit, setCurrentOutfit] = useState<GeneratedOutfit | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedOutfits, setSavedOutfits] = useState<GeneratedOutfit[]>([]);
  const [history, setHistory] = useState<Record<string, GeneratedOutfit>>({});

  const runWithLoading = useCallback((builder: () => GeneratedOutfit) => {
    setIsLoading(true);
    setTimeout(() => {
      const outfit = builder();
      setCurrentOutfit(outfit);
      setHistory((prev) => ({ ...prev, [outfit.id]: outfit }));
      setIsLoading(false);
    }, LOADING_DURATION);
  }, []);

  const generateOutfit = useCallback(() => {
    runWithLoading(() => buildOutfitFromTemplate(occasion));
  }, [occasion, runWithLoading]);

  const surpriseMe = useCallback(() => {
    runWithLoading(() => buildSurpriseOutfit());
  }, [runWithLoading]);

  const remixCurrentOutfit = useCallback(() => {
    if (!currentOutfit) return;
    runWithLoading(() => remixOutfit(currentOutfit));
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
      updateOutfitEverywhere(id, { saved: nextSaved });
      setSavedOutfits((prev) => {
        if (nextSaved) {
          const alreadyIn = prev.some((o) => o.id === id);
          return alreadyIn ? prev : [{ ...target, saved: true }, ...prev];
        }
        return prev.filter((o) => o.id !== id);
      });
    },
    [currentOutfit, history, updateOutfitEverywhere]
  );

  const markAsWorn = useCallback(
    (id: string) => {
      updateOutfitEverywhere(id, { worn: true });
    },
    [updateOutfitEverywhere]
  );

  const submitWearFeedback = useCallback(
    (id: string, rating: number, notes: string) => {
      updateOutfitEverywhere(id, { wearRating: rating, wearNotes: notes });
    },
    [updateOutfitEverywhere]
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