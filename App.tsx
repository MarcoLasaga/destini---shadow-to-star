import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initNotifications } from './src/services/notificationService';

LogBox.ignoreLogs([
  "The action 'RESET' with payload",
  "The action 'NAVIGATE' with payload",
]);
import RootNavigator from './src/navigation/RootNavigator';
import { WardrobeProvider } from './src/contexts/WardrobeContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { PackingProvider } from './src/contexts/PackingContext';
import { OutfitProvider } from './src/contexts/OutfitContext';
import { PlannerProvider } from './src/contexts/PlannerContext';
import { CommunityProvider } from './src/contexts/CommunityContext';
import { useAppTheme } from './src/hooks/useAppTheme';

const queryClient = new QueryClient();

function AppContent() {
  const theme = useAppTheme();

  useEffect(() => {
    initNotifications();
  }, []);

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ProfileProvider>
            <SettingsProvider>
              <WardrobeProvider>
                <OutfitProvider>
                  <PlannerProvider>
                    <CommunityProvider>
                      <PackingProvider>
                        <ToastProvider>
                          <AppContent />
                        </ToastProvider>
                      </PackingProvider>
                    </CommunityProvider>
                  </PlannerProvider>
                </OutfitProvider>
              </WardrobeProvider>
            </SettingsProvider>
          </ProfileProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
