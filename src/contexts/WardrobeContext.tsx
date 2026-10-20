import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClothingItem, LaundryStatus } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../integrations/supabase/client';
import { triggerSmartAlert } from '../services/notificationService';

const CATEGORY_TO_DISPLAY: Record<string, string> = {
  TOP: 'Tops',
  BOTTOM: 'Bottoms',
  SHOES: 'Shoes',
  OUTERWEAR: 'Outerwear',
  ACCESSORIES: 'Accessories',
};

const CATEGORY_TO_DATABASE: Record<string, string> = {
  Tops: 'TOP',
  Bottoms: 'BOTTOM',
  Shoes: 'SHOES',
  Outerwear: 'OUTERWEAR',
  Accessories: 'ACCESSORIES',
};

const STYLE_TO_DATABASE: Record<string, string> = { Casual: 'CASUAL', Formal: 'FORMAL', Business: 'FORMAL', Streetwear: 'STREETWEAR', Athletic: 'SPORTY', Bohemian: 'BOHEMIAN' };
const SEASON_TO_DATABASE: Record<string, string> = { Spring: 'SPRING', Summer: 'SUMMER', Fall: 'AUTUMN', Winter: 'WINTER', All: 'ALL_SEASONS' };
const OCCASION_TO_DATABASE: Record<string, string> = { Academic: 'ACADEMIC', Office: 'WORK', Work: 'WORK', Formal: 'FORMAL', Casual: 'CASUAL', Workout: 'SPORT', Sport: 'SPORT' };

export const ACCESSORY_NAME_REGEX = /\b(watch|smartwatch|casio|bag|tote|belt|cap|hat|glasses|sunglasses|necklace|ring|bracelet|jewelry|earring|wallet|backpack|purse)\b/i;

export function isAccessoryItem(category?: string | null, name?: string | null): boolean {
  const cat = (category || '').toUpperCase().trim();
  if (cat === 'ACCESSORIES' || cat === 'ACCESSORY' || cat.startsWith('ACCESSOR')) {
    return true;
  }
  if (name && ACCESSORY_NAME_REGEX.test(name)) {
    return true;
  }
  return false;
}

function mapSupabaseToMobile(row: any): ClothingItem {
  const timesWorn = row.wear_count || 0;
  const price = row.estimated_price ? parseFloat(row.estimated_price) : 0;
  const displayCategory = CATEGORY_TO_DISPLAY[row.category] || row.category || '';
  const itemName = row.clothing_name || '';
  const isAccessory = isAccessoryItem(displayCategory, itemName);

  return {
    id: row.id,
    name: itemName,
    category: isAccessory && !displayCategory ? 'Accessories' : displayCategory,
    color: row.color || '',
    brand: row.brand || '',
    material: row.material || '',
    style: row.style || '',
    seasons: row.seasons || (row.season ? [row.season] : []),
    occasions: row.occasions || (row.occasion ? [row.occasion] : []),
    image: row.image_url || '',
    status: (isAccessory ? 'clean' : row.laundry_status === 'CLEAN' ? 'clean' : 'needs-washing') as LaundryStatus,
    favorite: row.is_favorite || false,
    timesWorn,
    lastWorn: row.last_worn_at ? new Date(row.last_worn_at).toISOString().split('T')[0] : '',
    costPerWear: timesWorn > 0 ? price / timesWorn : price,
    wearCountSinceWash: isAccessory ? 0 : row.wear_count_since_wash || 0,
    washThreshold: row.wash_threshold || 5,
    avgWearsPerMonth: row.avg_wears_per_month || 0,
    sinceLast: row.last_worn_at 
      ? `${Math.round((Date.now() - new Date(row.last_worn_at).getTime()) / (1000 * 60 * 60 * 24))}d ago` 
      : 'Never',
    wearHistory: row.wear_history || [],
    addedDate: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  };
}

function mapMobileToSupabase(item: Partial<ClothingItem>): any {
  const row: any = {};
  const isAccessory = isAccessoryItem(item.category, item.name);
  
  if (item.name !== undefined) row.clothing_name = item.name;
  if (item.category !== undefined) row.category = CATEGORY_TO_DATABASE[item.category] || item.category;
  if (item.color !== undefined) row.color = item.color;
  if (item.brand !== undefined) row.brand = item.brand;
  if (item.material !== undefined) row.material = item.material;
  if (item.style !== undefined) row.style = STYLE_TO_DATABASE[item.style] || item.style;
  
  if (item.seasons !== undefined) {
    row.seasons = item.seasons.map((season) => SEASON_TO_DATABASE[season] || season);
    row.season = row.seasons[0] || null;
  }
  
  if (item.occasions !== undefined) {
    row.occasions = item.occasions.map((occasion) => OCCASION_TO_DATABASE[occasion] || occasion);
    row.occasion = row.occasions[0] || null;
  }
  
  if (item.image !== undefined) row.image_url = item.image;
  if (isAccessory) {
    row.laundry_status = 'CLEAN';
  } else if (item.status !== undefined) {
    row.laundry_status = item.status === 'clean' ? 'CLEAN' : 'NEEDS_WASHING';
  }
  if (item.favorite !== undefined) row.is_favorite = item.favorite;
  if (item.timesWorn !== undefined) row.wear_count = item.timesWorn;
  
  if (item.lastWorn !== undefined) {
    row.last_worn_at = item.lastWorn ? new Date(item.lastWorn).toISOString() : null;
  }
  
  return row;
}

interface WardrobeContextValue {
  items: ClothingItem[];
  addItem: (item: Omit<ClothingItem, 'id' | 'addedDate'>) => Promise<ClothingItem>;
  toggleFavorite: (id: string) => void;
  deleteItem: (id: string) => void;
  deleteItems: (ids: string[]) => Promise<void>;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
  recordWear: (itemIds: string[]) => Promise<void>;
  unrecordWear: (itemIds: string[]) => Promise<void>;
  getItem: (id: string) => ClothingItem | undefined;
}

const WardrobeContext = createContext<WardrobeContextValue | undefined>(undefined);

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoggedIn } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);

  const fetchItems = useCallback(async () => {
    const user = session?.user;
    if (!user) {
      setItems([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('wardrobe_items')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching wardrobe items from Supabase:', error);
      } else if (data) {
        setItems(data.map(mapSupabaseToMobile));
        // Sanitize any existing accessory rows that were accidentally marked NEEDS_WASHING in DB
        const dirtyAccessoryIds = data
          .filter((row: any) => row.laundry_status !== 'CLEAN' && isAccessoryItem(row.category, row.clothing_name))
          .map((row: any) => row.id);
        if (dirtyAccessoryIds.length > 0) {
          supabase
            .from('wardrobe_items')
            .update({ laundry_status: 'CLEAN' })
            .in('id', dirtyAccessoryIds)
            .then(() => {});
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching wardrobe items:', err);
    }
  }, [session]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchItems();
    } else {
      setItems([]);
    }
  }, [isLoggedIn, fetchItems]);

  const toggleFavorite = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const newFavorite = !item.favorite;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, favorite: newFavorite } : i))
    );

    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .update({ is_favorite: newFavorite })
        .eq('id', id);

      if (error) {
        console.error('Error toggling favorite in Supabase:', error);
        // Revert
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, favorite: !newFavorite } : i))
        );
      }
    } catch (err) {
      console.error('Unexpected error toggling favorite:', err);
      // Revert
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, favorite: !newFavorite } : i))
      );
    }
  }, [items]);

  const addItem = useCallback(async (item: Omit<ClothingItem, 'id' | 'addedDate'>) => {
    const user = session?.user;
    if (!user) throw new Error('Please sign in before adding clothing.');

    const payload = {
      user_id: user.id,
      ...mapMobileToSupabase(item),
      laundry_status: 'CLEAN',
      is_favorite: false,
      wear_count: 0,
      wash_count: 0,
    };
    const { data, error } = await supabase
      .from('wardrobe_items')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    const created = mapSupabaseToMobile(data);
    setItems((previous) => [created, ...previous]);
    return created;
  }, [session]);

  const deleteItem = useCallback(async (id: string) => {
    // Optimistic update
    setItems((prev) => prev.filter((i) => i.id !== id));

    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting item in Supabase:', error);
        fetchItems();
      }
    } catch (err) {
      console.error('Unexpected error deleting item:', err);
      fetchItems();
    }
  }, [fetchItems]);

  const deleteItems = useCallback(async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((i) => !idSet.has(i.id)));

    try {
      const { error } = await supabase
        .from('wardrobe_items')
        .delete()
        .in('id', ids);

      if (error) {
        console.error('Error batch deleting items in Supabase:', error);
        fetchItems();
      }
    } catch (err) {
      console.error('Unexpected error batch deleting items:', err);
      fetchItems();
    }
  }, [fetchItems]);

  const updateItem = useCallback(async (id: string, updates: Partial<ClothingItem>) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );

    try {
      const mapped = mapMobileToSupabase(updates);
      const { error } = await supabase
        .from('wardrobe_items')
        .update(mapped)
        .eq('id', id);

      if (error) {
        console.error('Error updating item in Supabase:', error);
        fetchItems();
      }
    } catch (err) {
      console.error('Unexpected error updating item:', err);
      fetchItems();
    }
  }, [fetchItems]);

  const recordWear = useCallback(async (itemIds: string[]) => {
    if (!itemIds || !itemIds.length) return;
    const nowISO = new Date().toISOString();
    const todayStr = nowISO.split('T')[0];

    // Optimistically increment wear count and update laundry status if wash threshold reached (never mark Accessories as needing wash!)
    setItems((prev) =>
      prev.map((item) => {
        if (!itemIds.includes(item.id)) return item;
        const nextTimesWorn = item.timesWorn + 1;
        const isAccessory = isAccessoryItem(item.category, item.name);
        const nextWearSinceWash = isAccessory ? 0 : item.wearCountSinceWash + 1;
        const threshold = item.washThreshold || 3;
        const nextStatus: LaundryStatus = isAccessory
          ? 'clean'
          : nextWearSinceWash >= threshold || nextTimesWorn % 3 === 0
          ? 'needs-washing'
          : item.status;

        return {
          ...item,
          timesWorn: nextTimesWorn,
          wearCountSinceWash: nextWearSinceWash,
          status: nextStatus,
          lastWorn: todayStr,
          sinceLast: 'Today',
        };
      })
    );

    // Trigger smart alert for items transitioning to needs-washing (excluding Accessories)
    const newlyNeedingWash = items.filter((item) => {
      if (!itemIds.includes(item.id)) return false;
      if (isAccessoryItem(item.category, item.name)) return false;
      if (item.status === 'needs-washing') return false;
      const nextTimesWorn = item.timesWorn + 1;
      const nextWearSinceWash = item.wearCountSinceWash + 1;
      const threshold = item.washThreshold || 3;
      return nextWearSinceWash >= threshold || nextTimesWorn % 3 === 0;
    });

    newlyNeedingWash.forEach((garment) => {
      triggerSmartAlert({
        type: 'Laundry',
        title: `🧺 Laundry Alert: ${garment.name} needs washing`,
        body: 'Logged wear! Marked as Needs Washing to keep your rotation fresh.',
        targetRoute: 'Wardrobe',
      });
    });

    try {
      await Promise.all(
        itemIds.map(async (id) => {
          const current = items.find((i) => i.id === id);
          const isAccessory = isAccessoryItem(current?.category, current?.name);
          const nextTimesWorn = (current?.timesWorn || 0) + 1;
          const nextWearSinceWash = isAccessory ? 0 : (current?.wearCountSinceWash || 0) + 1;
          const threshold = current?.washThreshold || 3;
          const laundryStatus = isAccessory
            ? 'CLEAN'
            : nextWearSinceWash >= threshold || nextTimesWorn % 3 === 0
            ? 'NEEDS_WASHING'
            : 'CLEAN';

          return supabase
            .from('wardrobe_items')
            .update({
              wear_count: nextTimesWorn,
              last_worn_at: nowISO,
              laundry_status: laundryStatus,
              updated_at: nowISO,
            })
            .eq('id', id);
        })
      );
    } catch (err) {
      console.warn('Error recording wear in Supabase:', err);
    }
  }, [items]);

  const unrecordWear = useCallback(
    async (itemIds: string[]) => {
      if (!itemIds.length) return;
      const nowISO = new Date().toISOString();

      // Optimistically decrement wear count and revert laundry status to CLEAN
      setItems((prev) =>
        prev.map((item) => {
          if (!itemIds.includes(item.id)) return item;
          const nextTimesWorn = Math.max(0, item.timesWorn - 1);
          const nextWearSinceWash = Math.max(0, item.wearCountSinceWash - 1);

          return {
            ...item,
            timesWorn: nextTimesWorn,
            wearCountSinceWash: nextWearSinceWash,
            status: 'clean' as LaundryStatus,
          };
        })
      );

      try {
        await Promise.all(
          itemIds.map(async (id) => {
            const current = items.find((i) => i.id === id);
            const nextTimesWorn = Math.max(0, (current?.timesWorn || 1) - 1);

            return supabase
              .from('wardrobe_items')
              .update({
                wear_count: nextTimesWorn,
                laundry_status: 'CLEAN',
                updated_at: nowISO,
              })
              .eq('id', id);
          })
        );
      } catch (err) {
        console.warn('Error reverting wear in Supabase:', err);
      }
    },
    [items]
  );

  const getItem = useCallback((id: string) => items.find((item) => item.id === id), [items]);

  return (
    <WardrobeContext.Provider value={{ items, addItem, toggleFavorite, deleteItem, deleteItems, updateItem, recordWear, unrecordWear, getItem }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error('useWardrobe must be used within WardrobeProvider');
  return ctx;
}
