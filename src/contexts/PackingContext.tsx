import React, { createContext, useContext, useState, useCallback } from 'react';
import { PackingTrip, PackingItem } from '../types';
import { buildPackingChecklist } from '../utils/packingChecklist';

interface PackingContextValue {
  trips: PackingTrip[];
  addTrip: (destination: string, lat: number, lon: number, startDate: string, endDate: string, avgTempF?: number) => string;
  toggleItem: (tripId: string, itemId: string) => void;
  getTrip: (tripId: string) => PackingTrip | undefined;
}

const PackingContext = createContext<PackingContextValue | undefined>(undefined);

export function PackingProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<PackingTrip[]>([]);

  const addTrip = useCallback(
    (destination: string, lat: number, lon: number, startDate: string, endDate: string, avgTempF?: number) => {
      const id = Date.now().toString();
      const checklist: PackingItem[] = buildPackingChecklist(startDate, endDate, avgTempF).map((label, index) => ({
        id: `${id}-${index}`,
        label: label.label,
        category: label.category,
        checked: false,
      }));

      const newTrip: PackingTrip = { id, destination, lat, lon, startDate, endDate, checklist };
      setTrips((prev) => [newTrip, ...prev]);
      return id;
    },
    []
  );

  const toggleItem = useCallback((tripId: string, itemId: string) => {
    setTrips((prev) =>
      prev.map((trip) =>
        trip.id === tripId
          ? {
              ...trip,
              checklist: trip.checklist.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item
              ),
            }
          : trip
      )
    );
  }, []);

  const getTrip = useCallback((tripId: string) => trips.find((t) => t.id === tripId), [trips]);

  return (
    <PackingContext.Provider value={{ trips, addTrip, toggleItem, getTrip }}>{children}</PackingContext.Provider>
  );
}

export function usePacking() {
  const ctx = useContext(PackingContext);
  if (!ctx) throw new Error('usePacking must be used within PackingProvider');
  return ctx;
}