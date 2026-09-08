import { useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { I18nextProvider } from 'react-i18next';

import { i18n, initI18n } from '../i18n';
import { useSyncUser } from '../hooks/use-sync-user';

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Set it in frontend/.env before starting the app.',
  );
}

function AppShell() {
  // Keeps the Neon users table in sync with Clerk for the signed-in user.
  useSyncUser();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="kundali" />
      <Stack.Screen name="palm" />
      <Stack.Screen name="face" />
      <Stack.Screen name="aura" />
      <Stack.Screen name="dream" />
      <Stack.Screen name="dreams" />
      <Stack.Screen name="vastu" />
      <Stack.Screen name="spaces" />
      <Stack.Screen name="temple" />
      <Stack.Screen name="puja-book" />
      <Stack.Screen name="puja-slip" />
      <Stack.Screen name="puja-bookings" />
      <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initI18n().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <I18nextProvider i18n={i18n}>
        <AppShell />
      </I18nextProvider>
    </ClerkProvider>
  );
}
