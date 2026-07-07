import React, { createContext, useContext, useState, useCallback } from 'react';
import { ClothingItem } from '../types';
import { initialClothingItems } from '../constants/wardrobeMockData';

interface WardrobeContextValue {
  items: ClothingItem[];
  toggleFavorite: (id: string) => void;
  deleteItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ClothingItem>) => void;
  getItem: (id: string) => ClothingItem | undefined;
}

const WardrobeContext = createContext<WardrobeContextValue | undefined>(undefined);

export function WardrobeProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>(initialClothingItems);

  const toggleFavorite = useCallback((id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<ClothingItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

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