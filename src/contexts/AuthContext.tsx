import React, { createContext, useContext, useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../integrations/supabase/client';
import { Session } from '@supabase/supabase-js';

// Register WebBrowser auth session completing handler (required for Web/Android redirect flows)
WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  isLoggedIn: boolean;
  session: Session | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string, firstName: string, lastName: string) => Promise<void>;
  loginWithOAuth: (provider: 'google' | 'facebook') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Helper to extract params from redirect URL (handles both query params and hash fragments)
const extractParams = (url: string) => {
  const params: { [key: string]: string } = {};
  
  // Parse query parameters (?) and hash fragments (#)
  const regex = /[?&#]([^=#]+)=([^&#]*)/g;
  let match;
  while ((match = regex.exec(url)) !== null) {
    try {
      params[match[1]] = decodeURIComponent(match[2]);
    } catch (e) {
      params[match[1]] = match[2];
    }
  }
  return params;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error('Error getting initial session:', err);
      setLoading(false);
    });

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    if (error) throw error;
  };

  const loginWithOAuth = async (provider: 'google' | 'facebook') => {
    try {
      const redirectUrl = Linking.createURL('callback');
      console.log('--- GENERATED REDIRECT URL ---', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Failed to retrieve authorization URL');
      console.log('--- SUPABASE AUTH URL ---', data.url);

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        const params = extractParams(result.url);
        
        // 1. PKCE flow - exchange code for session
        if (params.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
          if (exchangeError) throw exchangeError;
        } 
        // 2. Implicit flow - set session directly from tokens
        else if (params.access_token && params.refresh_token) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (setSessionError) throw setSessionError;
        } else {
          throw new Error('OAuth redirect URL did not contain expected session tokens or code.');
        }
      }
    } catch (err) {
      console.error(`OAuth flow failed for ${provider}:`, err);
      throw err;
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value: AuthContextValue = {
    isLoggedIn: !!session?.user,
    session,
    loading,
    loginWithEmail,
    signUpWithEmail,
    loginWithOAuth,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
