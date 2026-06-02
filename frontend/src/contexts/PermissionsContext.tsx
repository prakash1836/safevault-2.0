import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';
import { initNotifications } from '../services/notifications';

export interface Permissions {
  notifications: boolean;
  drive: boolean; // user has connected real Google Drive (not demo)
  media: boolean;
  onboarded: boolean; // saw onboarding once
}

interface Ctx extends Permissions {
  refresh: () => Promise<void>;
  setOnboarded: () => Promise<void>;
  requestNotifications: () => Promise<boolean>;
  requestMedia: () => Promise<boolean>;
  setDriveConnected: (v: boolean) => void;
  warnings: string[];
}

const PermContext = createContext<Ctx | null>(null);
const STORE = 'safevault.perms.v1';

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Permissions>({ notifications: false, drive: false, media: false, onboarded: false });

  const persist = useCallback(async (s: Permissions) => {
    await AsyncStorage.setItem(STORE, JSON.stringify({ onboarded: s.onboarded, drive: s.drive }));
  }, []);

  const refresh = useCallback(async () => {
    let notif = false;
    let media = false;
    try {
      const n = await Notifications.getPermissionsAsync();
      notif = !!n.granted;
    } catch {}
    try {
      if (Platform.OS !== 'web') {
        const m = await MediaLibrary.getPermissionsAsync();
        media = !!m.granted;
      } else {
        media = true; // n/a on web
      }
    } catch { media = Platform.OS === 'web'; }
    const raw = await AsyncStorage.getItem(STORE);
    let onboarded = false; let drive = false;
    if (raw) {
      try { const p = JSON.parse(raw); onboarded = !!p.onboarded; drive = !!p.drive; } catch {}
    }
    setState({ notifications: notif, media, onboarded, drive });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setOnboarded = useCallback(async () => {
    const next = { ...state, onboarded: true };
    setState(next);
    await persist(next);
  }, [state, persist]);

  const requestNotifications = useCallback(async () => {
    try {
      // Initialize notification channel and handler first (idempotent)
      await initNotifications();
      const r = await Notifications.requestPermissionsAsync();
      const ok = !!r.granted;
      setState((s) => ({ ...s, notifications: ok }));
      // If permanently denied on Android, offer to open settings
      if (!ok && Platform.OS === 'android' && r.canAskAgain === false) {
        Alert.alert(
          'Notifications blocked',
          'Reminders need notification permission. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return ok;
    } catch (e) { 
      console.warn('Notification permission request failed:', e);
      return false; 
    }
  }, []);

  const requestMedia = useCallback(async () => {
    try {
      if (Platform.OS === 'web') { setState((s) => ({ ...s, media: true })); return true; }
      const r = await MediaLibrary.requestPermissionsAsync();
      const ok = !!r.granted;
      setState((s) => ({ ...s, media: ok }));
      // If permanently denied on Android, offer to open settings
      if (!ok && Platform.OS === 'android' && r.canAskAgain === false) {
        Alert.alert(
          'Photo access blocked',
          'To upload images, please allow Photos & Media access in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return ok;
    } catch (e) { 
      console.warn('Media permission request failed:', e);
      return false; 
    }
  }, []);

  const setDriveConnected = useCallback((v: boolean) => {
    setState((s) => {
      const next = { ...s, drive: v };
      persist(next);
      return next;
    });
  }, [persist]);

  const warnings: string[] = [];
  if (!state.notifications) warnings.push('Notifications disabled — you won\'t get expiry reminders');
  if (!state.media && Platform.OS !== 'web') warnings.push('Photo library access disabled — image uploads blocked');
  if (!state.drive) warnings.push('Google Drive not connected — files saved locally only');

  return (
    <PermContext.Provider value={{ ...state, refresh, setOnboarded, requestNotifications, requestMedia, setDriveConnected, warnings }}>
      {children}
    </PermContext.Provider>
  );
}

export function usePermissions() {
  const v = useContext(PermContext);
  if (!v) throw new Error('usePermissions outside provider');
  return v;
}
