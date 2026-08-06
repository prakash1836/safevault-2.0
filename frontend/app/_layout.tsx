import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { VaultProvider } from '../src/contexts/VaultContext';
import { UploadProvider } from '../src/contexts/UploadContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { PermissionsProvider } from '../src/contexts/PermissionsContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PermissionsProvider>
            <AuthProvider>
              <VaultProvider>
                <UploadProvider>
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FCFCFA' } }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="document/[id]" />
                    <Stack.Screen name="family" />
                    <Stack.Screen name="settings/theme" />
                    <Stack.Screen name="settings/storage-security" />
                  </Stack>
                </UploadProvider>
              </VaultProvider>
            </AuthProvider>
          </PermissionsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
