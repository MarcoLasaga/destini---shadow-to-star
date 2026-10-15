import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PackingTrip, PackingItem, ClothingItem } from '../types';
import { buildPackingChecklist, daysBetween } from '../utils/packingChecklist';

const STORAGE_KEY_TRIPS = '@stylesense_packing_trips';

export interface CreateTripParams {
  destination: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  occasion: string;
  packingMode: 'light' | 'heavy';
  cleanWardrobeItems: ClothingItem[];
  avgTempF?: number;
  weatherCondition?: string;
}

interface PackingContextValue {
  trips: PackingTrip[];
  addTrip: (params: CreateTripParams) => Promise<string>;
  toggleItem: (tripId: string, itemId: string) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  getTrip: (tripId: string) => PackingTrip | undefined;
}

const PackingContext = createContext<PackingContextValue | undefined>(undefined);

export function PackingProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<PackingTrip[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_TRIPS);
        if (stored) {
          setTrips(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('Failed to load trips from storage', err);
      }
    })();
  }, []);

  const persistTrips = async (updated: PackingTrip[]) => {
    setTrips(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to persist packing trips', err);
    }
  };

  const addTrip = useCallback(
    async (params: CreateTripParams): Promise<string> => {
      const id = Date.now().toString();
      const tripDays = daysBetween(params.startDate, params.endDate);
      const generatedItems = buildPackingChecklist(params);

      const checklist: PackingItem[] = generatedItems.map((item, index) => ({
        id: `${id}-${index}`,
        label: item.label,
        category: item.category,
        checked: false,
        wardrobeItemId: item.wardrobeItemId,
      }));

      const newTrip: PackingTrip = {
        id,
        destination: params.destination,
        lat: params.lat,
        lon: params.lon,
        startDate: params.startDate,
        endDate: params.endDate,
        tripDays,
        occasion: params.occasion,
        packingMode: params.packingMode,
        checklist,
      };

      const updated = [newTrip, ...trips];
      await persistTrips(updated);
      return id;
    },
    [trips]
  );

  const toggleItem = useCallback(
    async (tripId: string, itemId: string) => {
      const updated = trips.map((trip) =>
        trip.id === tripId
          ? {
              ...trip,
              checklist: trip.checklist.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item
              ),
            }
          : trip
      );
      await persistTrips(updated);
    },
    [trips]
  );

  const deleteTrip = useCallback(
    async (tripId: string) => {
      const updated = trips.filter((t) => t.id !== tripId);
      await persistTrips(updated);
    },
    [trips]
  );

  const getTrip = useCallback((tripId: string) => trips.find((t) => t.id === tripId), [trips]);

  return (
    <PackingContext.Provider value={{ trips, addTrip, toggleItem, deleteTrip, getTrip }}>
      {children}
    </PackingContext.Provider>
  );
}

export function usePacking() {
  const ctx = useContext(PackingContext);
  if (!ctx) throw new Error('usePacking must be used within PackingProvider');
  return ctx;
}