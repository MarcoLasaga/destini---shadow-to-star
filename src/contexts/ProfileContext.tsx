import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserProfile } from '../types';
import { initialProfile } from '../constants/profileMockData';

interface ProfileContextValue {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setAvatar: (uri: string | null) => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const setAvatar = useCallback((uri: string | null) => {
    setProfile((prev) => ({ ...prev, avatarUri: uri }));
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, setAvatar }}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}