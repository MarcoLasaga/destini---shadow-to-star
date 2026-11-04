import React, { useEffect } from 'react';
import { AppState, Platform, StatusBar as RNStatusBar } from 'react-native';
import {
  StatusBar,
  setStatusBarHidden,
  setStatusBarTranslucent,
  setStatusBarBackgroundColor,
} from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { ProfileProvider } from './src/contexts/ProfileContext';
import { WardrobeProvider } from './src/contexts/WardrobeContext';
import { OutfitProvider } from './src/contexts/OutfitContext';
import { CommunityProvider } from './src/contexts/CommunityContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { PackingProvider } from './src/contexts/PackingContext';
import RootNavigator from './src/navigation/RootNavigator';

export function enforceAppFullscreen() {
  try {
    setStatusBarHidden(true, 'none');
    RNStatusBar.setHidden(true, 'none');
    if (Platform.OS === 'android') {
      setStatusBarTranslucent(true);
      setStatusBarBackgroundColor('transparent', false);
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor('transparent', false);
    }
  } catch {
    // ignore on unsupported platforms
  }
}

export default function App() {
  useEffect(() => {
    enforceAppFullscreen();

    // Re-enforce after short delays in case native splash/activity transition resets flags
    const t1 = setTimeout(enforceAppFullscreen, 150);
    const t2 = setTimeout(enforceAppFullscreen, 600);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        enforceAppFullscreen();
        setTimeout(enforceAppFullscreen, 120);
      }
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      sub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar hidden={true} translucent={true} backgroundColor="transparent" style="light" />
        <SettingsProvider>
          <ToastProvider>
            <AuthProvider>
              <ProfileProvider>
                <WardrobeProvider>
                  <OutfitProvider>
                    <PackingProvider>
                      <CommunityProvider>
                        <RootNavigator />
                      </CommunityProvider>
                    </PackingProvider>
                  </OutfitProvider>
                </WardrobeProvider>
              </ProfileProvider>
            </AuthProvider>
          </ToastProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
