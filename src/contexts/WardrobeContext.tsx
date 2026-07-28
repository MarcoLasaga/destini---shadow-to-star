import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClothingItem, LaundryStatus } from '../types';
import { useAuth } from './AuthContext';
import { supabase } from '../integrations/supabase/client';

function mapSupabaseToMobile(row: any): ClothingItem {
  const timesWorn = row.wear_count || 0;
  const price = row.estimated_price ? parseFloat(row.estimated_price) : 0;
  
  return {
    id: row.id,
    name: row.clothing_name || '',
    category: row.category || '',
    color: row.color || '',
    brand: row.brand || '',
    material: row.material || '',
    style: row.style || '',
    seasons: row.seasons || (row.season ? [row.season] : []),
    occasions: row.occasions || (row.occasion ? [row.occasion] : []),
    image: row.image_url || '',
    status: (row.laundry_status === 'CLEAN' ? 'clean' : 'needs-washing') as LaundryStatus,
    favorite: row.is_favorite || false,
    timesWorn,
    lastWorn: row.last_worn_at ? new Date(row.last_worn_at).toISOString().split('T')[0] : '',
    costPerWear: timesWorn > 0 ? price / timesWorn : price,
    wearCountSinceWash: row.wear_count_since_wash || 0,
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
  
  if (item.name !== undefined) row.clothing_name = item.name;
  if (item.category !== undefined) row.category = item.category;
  if (item.color !== undefined) row.color = item.color;
  if (item.brand !== undefined) row.brand = item.brand;
  if (item.material !== undefined) row.material = item.material;
  if (item.style !== undefined) row.style = item.style;
  
  if (item.seasons !== undefined) {
    row.seasons = item.seasons;
    row.season = item.seasons[0] || null;
  }
  
  if (item.occasions !== undefined) {
    row.occasions = item.occasions;
    row.occasion = item.occasions[0] || null;
  }
  
  if (item.image !== undefined) row.image_url = item.image;
  if (item.status !== undefined) row.laundry_status = item.status === 'clean' ? 'CLEAN' : 'NEEDS_WASHING';
  if (item.favorite !== undefined) row.is_favorite = item.favorite;
  if (item.timesWorn !== undefined) row.wear_count = item.timesWorn;
  
  if (item.lastWorn !== undefined) {
    row.last_worn_at = item.lastWorn ? new Date(item.lastWorn).toISOString() : null;
  }
  
  return row;
}

interface WardrobeContextValue {
  items: ClothingItem[];
  toggleFavorite: (id: string) => void;
  deleteItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
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

  const getItem = useCallback((id: string) => items.find((item) => item.id === id), [items]);

  return (
    <WardrobeContext.Provider value={{ items, toggleFavorite, deleteItem, updateItem, getItem }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext);
  if (!ctx) throw new Error('useWardrobe must be used within WardrobeProvider');
  return ctx;
}