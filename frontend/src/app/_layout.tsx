import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationBar } from 'expo-navigation-bar';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

SplashScreen.preventAutoHideAsync();

function hideAndroidNavBar() {
  if (Platform.OS !== 'android') return;
  NavigationBar.setHidden(true);
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    hideAndroidNavBar();
    // Android reveals the bar on swipe-up; re-hide when the app regains focus.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') hideAndroidNavBar();
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
