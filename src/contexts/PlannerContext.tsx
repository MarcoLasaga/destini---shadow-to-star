import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GeneratedOutfit, PlannedDayOutfit } from '../types';
import { useWardrobe } from './WardrobeContext';

const STORAGE_KEY_PLANS = '@stylesense_planned_calendar_outfits';

interface PlannerContextValue {
  plans: Record<string, PlannedDayOutfit>;
  getPlanForDate: (date: string) => PlannedDayOutfit | undefined;
  scheduleOutfit: (
    date: string,
    outfit: GeneratedOutfit,
    options?: { notes?: string; force?: boolean }
  ) => Promise<{ success: boolean; conflict: boolean }>;
  removePlan: (date: string) => Promise<void>;
  markPlanAsWorn: (date: string) => Promise<void>;
}

const PlannerContext = createContext<PlannerContextValue | undefined>(undefined);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<Record<string, PlannedDayOutfit>>({});
  const wardrobe = useWardrobe();

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_PLANS);
        if (stored) {
          setPlans(JSON.parse(stored));
        }
      } catch (err) {
        console.warn('Failed to load planned outfits from storage', err);
      }
    })();
  }, []);

  const persistPlans = async (updated: Record<string, PlannedDayOutfit>) => {
    setPlans(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to persist planned outfits', err);
    }
  };

  const getPlanForDate = useCallback(
    (date: string) => {
      return plans[date];
    },
    [plans]
  );

  const scheduleOutfit = useCallback(
    async (
      date: string,
      outfit: GeneratedOutfit,
      options?: { notes?: string; force?: boolean }
    ): Promise<{ success: boolean; conflict: boolean }> => {
      if (plans[date] && !options?.force) {
        return { success: false, conflict: true };
      }

      const newPlan: PlannedDayOutfit = {
        date,
        outfit,
        occasion: outfit.occasionLabel || 'Casual',
        notes: options?.notes,
        plannedAt: new Date().toISOString(),
      };

      const updated = {
        ...plans,
        [date]: newPlan,
      };

      await persistPlans(updated);
      return { success: true, conflict: false };
    },
    [plans]
  );

  const removePlan = useCallback(
    async (date: string) => {
      const updated = { ...plans };
      delete updated[date];
      await persistPlans(updated);
    },
    [plans]
  );

  const markPlanAsWorn = useCallback(
    async (date: string) => {
      const plan = plans[date];
      if (!plan) return;

      const updatedOutfit: GeneratedOutfit = { ...plan.outfit, worn: true };
      const updated = {
        ...plans,
        [date]: { ...plan, outfit: updatedOutfit },
      };
      await persistPlans(updated);

      // Immediately increment wear count and laundry status in Wardrobe
      if (plan.outfit.clothingItems?.length) {
        await wardrobe.recordWear(plan.outfit.clothingItems.map((item) => item.id));
      }
    },
    [plans, wardrobe]
  );

  return (
    <PlannerContext.Provider
      value={{
        plans,
        getPlanForDate,
        scheduleOutfit,
        removePlan,
        markPlanAsWorn,
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used within PlannerProvider');
  return ctx;
}

