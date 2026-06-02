import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { VaultProvider } from '../src/contexts/VaultContext';
import { UploadProvider } from '../src/contexts/UploadContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { PermissionsProvider } from '../src/contexts/PermissionsContext';
import { NetworkProvider } from '../src/contexts/NetworkContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { BiometricGate } from '../src/components/BiometricGate';
import { NotificationResponseHandler } from '../src/components/NotificationResponseHandler';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NetworkProvider>
            <ThemeProvider>
              <BiometricGate>
                <PermissionsProvider>
                  <AuthProvider>
                    <VaultProvider>
                      <UploadProvider>
                        <StatusBar style="dark" />
                        <NotificationResponseHandler />
                        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FCFCFA' } }}>
                          <Stack.Screen name="index" />
                          <Stack.Screen name="login" />
                          <Stack.Screen name="onboarding" />
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
                          <Stack.Screen name="document/[id]" />
                          <Stack.Screen name="family" />
                          <Stack.Screen name="settings/theme" />
                        </Stack>
                      </UploadProvider>
                    </VaultProvider>
                  </AuthProvider>
                </PermissionsProvider>
              </BiometricGate>
            </ThemeProvider>
          </NetworkProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
