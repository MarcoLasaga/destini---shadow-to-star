import React, { createContext, useCallback, useContext, useRef, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommunityFeedMode } from '../types';
import {
  CommunityOutfit,
  fetchCommunityFeed,
  rateOutfit,
  setLike,
  setSave,
} from '../services/communityService';
import { useProfile } from './ProfileContext';
import { supabase } from '../integrations/supabase/client';

type ContextValue = {
  feed: CommunityOutfit[];
  mode: CommunityFeedMode;
  occasion: string;
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  error: string | null;
  setMode: (mode: CommunityFeedMode) => void;
  setOccasion: (occasion: string) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  toggleLike: (outfit: CommunityOutfit) => Promise<void>;
  toggleSave: (outfit: CommunityOutfit) => Promise<void>;
  rate: (outfit: CommunityOutfit, rating: number) => Promise<void>;
  deletePost: (outfitId: string) => Promise<void>;
  hidePost: (outfitId: string) => Promise<void>;
};

const CommunityContext = createContext<ContextValue | undefined>(undefined);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfile } = useProfile();
  const [feed, setFeed] = useState<CommunityOutfit[]>([]);
  const [mode, setMode] = useState<CommunityFeedMode>('recent');
  const [occasion, setOccasion] = useState('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(false);

  const getHiddenPostIds = async (): Promise<string[]> => {
    try {
      const raw = await AsyncStorage.getItem('@stylesense_hidden_posts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const load = useCallback(
    async (reset: boolean) => {
      if (request.current) return;
      request.current = true;
      reset ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const hiddenIds = await getHiddenPostIds();
        const result = await fetchCommunityFeed(mode, occasion, reset ? 0 : feed.length);
        const filteredNewItems = result.items.filter((item) => !hiddenIds.includes(item.id));
        setFeed((old) => (reset ? filteredNewItems : [...old, ...filteredNewItems]));
        setHasMore(result.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load the community feed.');
      } finally {
        request.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, occasion, feed.length]
  );

  const refresh = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => (hasMore ? load(false) : Promise.resolve()), [hasMore, load]);

  const update = useCallback(
    async (
      outfit: CommunityOutfit,
      field: 'liked' | 'saved',
      fn: (id: string, active: boolean) => Promise<void>
    ) => {
      const next = !outfit[field];
      setFeed((items) =>
        items.map((item) =>
          item.id === outfit.id
            ? {
                ...item,
                [field]: next,
                ...(field === 'liked'
                  ? { like_count: Math.max(0, item.like_count + (next ? 1 : -1)) }
                  : { save_count: Math.max(0, item.save_count + (next ? 1 : -1)) }),
              }
            : item
        )
      );
      try {
        await fn(outfit.id, next);
      } catch (err) {
        setFeed((items) => items.map((item) => (item.id === outfit.id ? outfit : item)));
        throw err;
      }
    },
    []
  );

  const deletePost = useCallback(async (outfitId: string) => {
    setFeed((items) => items.filter((item) => item.id !== outfitId));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('shared_outfits').delete().eq('id', outfitId).eq('user_id', user.id);
      }
    } catch (err) {
      console.error('Error deleting shared outfit:', err);
    }
  }, []);

  const hidePost = useCallback(async (outfitId: string) => {
    setFeed((items) => items.filter((item) => item.id !== outfitId));
    try {
      const raw = await AsyncStorage.getItem('@stylesense_hidden_posts');
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(outfitId)) {
        list.push(outfitId);
        await AsyncStorage.setItem('@stylesense_hidden_posts', JSON.stringify(list));
      }
    } catch (err) {
      console.error('Error hiding post:', err);
    }
  }, []);

  const actorGender =
    profile.gender === 'female' ? 'female' : profile.gender === 'male' ? 'male' : 'unknown';

  const value = {
    feed,
    mode,
    occasion,
    loading,
    refreshing,
    hasMore,
    error,
    setMode,
    setOccasion,
    refresh,
    loadMore,
    toggleLike: (o: CommunityOutfit) => {
      const postStyle = o.style || o.occasion || 'Casual';
      const postColors = (o.items || []).map((i) => i.color).filter(Boolean) as string[];
      const isCrossGender =
        (o.authorGender === 'male' && actorGender === 'female') ||
        (o.authorGender === 'female' && actorGender === 'male');
      if (!o.liked && isCrossGender) {
        const nextLikedStyles = Array.from(new Set([...(profile.likedStyles || []), postStyle]));
        const nextLikedColors = Array.from(new Set([...(profile.likedColors || []), ...postColors]));
        updateProfile({
          likedStyles: nextLikedStyles,
          likedColors: nextLikedColors,
          crossGenderAffinity: true,
        }).catch(() => {});
      }
      return update(o, 'liked', (id, active) =>
        setLike(id, active, {
          authorGender: o.authorGender,
          actorGender,
          style: postStyle,
          colors: postColors,
          subtypes: (o.items || []).map((i) => i.category),
        })
      );
    },
    toggleSave: (o: CommunityOutfit) => {
      const postStyle = o.style || o.occasion || 'Casual';
      const postColors = (o.items || []).map((i) => i.color).filter(Boolean) as string[];
      const isCrossGender =
        (o.authorGender === 'male' && actorGender === 'female') ||
        (o.authorGender === 'female' && actorGender === 'male');
      if (!o.saved && isCrossGender) {
        const nextLikedStyles = Array.from(new Set([...(profile.likedStyles || []), postStyle]));
        const nextLikedColors = Array.from(new Set([...(profile.likedColors || []), ...postColors]));
        updateProfile({
          likedStyles: nextLikedStyles,
          likedColors: nextLikedColors,
          crossGenderAffinity: true,
        }).catch(() => {});
      }
      return update(o, 'saved', (id, active) =>
        setSave(id, active, {
          authorGender: o.authorGender,
          actorGender,
          style: postStyle,
          colors: postColors,
          subtypes: (o.items || []).map((i) => i.category),
        })
      );
    },
    rate: async (o: CommunityOutfit, rating: number) => {
      await rateOutfit(o.id, rating);
      setFeed((items) => items.map((item) => (item.id === o.id ? { ...item, myRating: rating } : item)));
    },
    deletePost,
    hidePost,
  };

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const value = useContext(CommunityContext);
  if (!value) throw new Error('useCommunity must be used within CommunityProvider');
  return value;
}
