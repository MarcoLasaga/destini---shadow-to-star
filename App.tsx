import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootNavigator from './src/navigation/RootNavigator';
import { WardrobeProvider } from './src/contexts/WardrobeContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { PackingProvider } from './src/contexts/PackingContext';
import { OutfitProvider } from './src/contexts/OutfitContext';

const queryClient = new QueryClient();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider>
          <SettingsProvider>
            <WardrobeProvider>
              <OutfitProvider>
                <PackingProvider>
                  <ToastProvider>
                    <StatusBar style="dark" />
                    <RootNavigator />
                  </ToastProvider>
                </PackingProvider>
              </OutfitProvider>
            </WardrobeProvider>
          </SettingsProvider>
        </ProfileProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}