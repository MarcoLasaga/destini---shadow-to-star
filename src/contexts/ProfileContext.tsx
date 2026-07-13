import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { initialProfile } from '../constants/profileMockData';
import { useAuth } from './AuthContext';
import { supabase } from '../integrations/supabase/client';

interface ProfileContextValue {
  profile: UserProfile;
  loading: boolean;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setAvatar: (uri: string | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [loading, setLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    const user = session?.user;
    if (!user) {
      setProfile(initialProfile);
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch profile details from Supabase profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, current_size, preferred_styles, created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile from Supabase:', profileError);
      }

      // 2. Synchronize avatar from OAuth metadata if missing in DB profiles
      let avatarUrl = profileData?.avatar_url || null;
      const oauthAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      if (!avatarUrl && oauthAvatar) {
        avatarUrl = oauthAvatar;
        await supabase
          .from('profiles')
          .update({ avatar_url: oauthAvatar })
          .eq('id', user.id);
      }

      // 3. Format memberSince (e.g. "July 2026")
      let memberSince = 'July 2026';
      if (profileData?.created_at) {
        const date = new Date(profileData.created_at);
        memberSince = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      }

      const displayName = profileData?.display_name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
      const parts = displayName.split(' ');
      const firstName = user.user_metadata?.first_name || parts[0] || '';
      const lastName = user.user_metadata?.last_name || parts.slice(1).join(' ') || '';

      setProfile({
        firstName,
        lastName,
        displayName,
        email: user.email || '',
        memberSince,
        avatarUri: avatarUrl,
        clothingSize: profileData?.current_size || '',
        preferredSize: profileData?.current_size || '',
        location: user.user_metadata?.location || 'Quezon City, PH',
      });
    } catch (e) {
      console.error('Error in fetchProfile:', e);
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Fetch profile when logged in status or session changes
  useEffect(() => {
    if (isLoggedIn) {
      fetchProfile();
    } else {
      setProfile(initialProfile);
    }
  }, [isLoggedIn, fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const user = session?.user;
    if (!user) return;

    // Optimistically update local state
    setProfile((prev) => ({ ...prev, ...updates }));

    try {
      // 1. Sync display_name, avatar_url, and current_size to public.profiles table
      const profileUpdate: any = {};
      if (updates.displayName !== undefined) profileUpdate.display_name = updates.displayName;
      if (updates.clothingSize !== undefined) profileUpdate.current_size = updates.clothingSize;
      if (updates.avatarUri !== undefined) profileUpdate.avatar_url = updates.avatarUri;

      if (Object.keys(profileUpdate).length > 0) {
        await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', user.id);
      }

      // 2. Sync first_name, last_name, and location to auth user metadata
      const metaUpdate: any = {};
      if (updates.firstName !== undefined) metaUpdate.first_name = updates.firstName;
      if (updates.lastName !== undefined) metaUpdate.last_name = updates.lastName;
      if (updates.location !== undefined) metaUpdate.location = updates.location;
      if (updates.displayName !== undefined) metaUpdate.display_name = updates.displayName;

      if (Object.keys(metaUpdate).length > 0) {
        await supabase.auth.updateUser({
          data: metaUpdate,
        });
      }
    } catch (e) {
      console.error('Error updating profile in Supabase:', e);
    }
  }, [session]);

  const setAvatar = useCallback(async (uri: string | null) => {
    await updateProfile({ avatarUri: uri });
  }, [updateProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, setAvatar, refreshProfile: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}