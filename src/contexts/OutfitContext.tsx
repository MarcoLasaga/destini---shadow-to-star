import React, { createContext, useContext, useState, useCallback } from 'react';
import { GeneratedOutfit } from '../types';
import { useAuth } from './AuthContext';
import { generateRecommendations, getRecommendationHistory, updateRecommendation } from '../services/outfitRecommendationService';

interface OutfitContextValue {
  occasion: string;
  setOccasion: (value: string) => void;
  currentOutfit: GeneratedOutfit | null;
  isLoading: boolean;
  savedOutfits: GeneratedOutfit[];
  generateOutfit: () => Promise<void>;
  surpriseMe: () => Promise<void>;
  remixCurrentOutfit: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  toggleSave: (id: string) => void;
  markAsWorn: (id: string) => void;
  submitWearFeedback: (id: string, rating: number, notes: string) => void;
  submitPreferenceEvent: (id: string, eventType: 'LIKE' | 'DISLIKE') => void;
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

  React.useEffect(() => { refreshHistory(); }, [refreshHistory]);

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

  const remixCurrentOutfit = useCallback(async () => {
    if (currentOutfit && session?.access_token) await updateRecommendation(currentOutfit.id, { eventType: 'SKIP' }, session.access_token).catch(console.error);
    await runWithLoading(occasion);
  }, [currentOutfit, occasion, runWithLoading, session]);

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
      if (session?.access_token) updateRecommendation(id, { isSaved: nextSaved, eventType: nextSaved ? 'SAVE' : 'UNSAVE' }, session.access_token).catch(console.error);
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
      if (session?.access_token) updateRecommendation(id, { isWorn: true, eventType: 'WORN' }, session.access_token).catch(console.error);
    },
    [updateOutfitEverywhere, session]
  );

  const submitWearFeedback = useCallback(
    (id: string, rating: number, notes: string) => {
      updateOutfitEverywhere(id, { wearRating: rating, wearNotes: notes });
      if (session?.access_token) updateRecommendation(id, { rating, note: notes, eventType: rating >= 4 ? 'LIKE' : rating <= 2 ? 'DISLIKE' : 'RATING' }, session.access_token).catch(console.error);
    },
    [updateOutfitEverywhere, session]
  );

  const submitPreferenceEvent = useCallback((id: string, eventType: 'LIKE' | 'DISLIKE') => {
    const target = currentOutfit?.id === id ? currentOutfit : history[id];
    if (!target) return;
    updateOutfitEverywhere(id, { favorited: eventType === 'LIKE' });
    if (session?.access_token) updateRecommendation(id, { eventType }, session.access_token).catch(console.error);
  }, [currentOutfit, history, session, updateOutfitEverywhere]);

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
        submitPreferenceEvent,
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
