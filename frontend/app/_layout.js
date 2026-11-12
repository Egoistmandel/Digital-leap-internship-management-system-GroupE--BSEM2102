/**
 * Root Layout — Digital LEAP
 * Wraps the entire app in AuthProvider and sets up the navigation stack.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../hooks/useAuth';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={Colors.primary} />
      <Stack
        screenOptions={{
          headerStyle:      { backgroundColor: Colors.primary },
          headerTintColor:  Colors.white,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          headerBackTitle:  'Back',
          contentStyle:     { backgroundColor: Colors.background },
        }}
      >
        {/* Auth screens — no header */}
        <Stack.Screen name="index"           options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login"    options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />

        {/* Dashboard tabs */}
        <Stack.Screen name="(tabs)"          options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
