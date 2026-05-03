import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreset = 'forest' | 'ocean' | 'royal' | 'sunset' | 'mono' | 'custom';

export const PRESETS: Record<Exclude<ThemePreset, 'custom'>, { name: string; primary: string; dark: string; surface: string }> = {
  forest: { name: 'Forest Green',  primary: '#4A7D6A', dark: '#1C3F3A', surface: '#E5EFEA' },
  ocean:  { name: 'Ocean Blue',    primary: '#3D6E8F', dark: '#163147', surface: '#E1ECF4' },
  royal:  { name: 'Royal Purple',  primary: '#6E5AAB', dark: '#2E2350', surface: '#ECE6F7' },
  sunset: { name: 'Sunset Orange', primary: '#D17A4A', dark: '#5C2C16', surface: '#F8E5D7' },
  mono:   { name: 'Charcoal',      primary: '#3F4146', dark: '#0F1012', surface: '#E8E9EB' },
};

interface ThemeShape {
  preset: ThemePreset;
  accent: string;
  accentDark: string;
  accentSurface: string;
  setPreset: (p: ThemePreset) => Promise<void>;
  setCustom: (primary: string, dark: string, surface: string) => Promise<void>;
}

const ThemeCtx = createContext<ThemeShape | null>(null);

const STORE = 'safevault.theme.v1';

function shadeHex(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0xff) + Math.round(2.55 * percent);
  let b = (num & 0xff) + Math.round(2.55 * percent);
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function softTint(hex: string): string {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  const r = (num >> 16); const g = (num >> 8) & 0xff; const b = num & 0xff;
  // Blend 12% with white
  const mix = (c: number) => Math.round(c * 0.12 + 255 * 0.88);
  const nr = mix(r), ng = mix(g), nb = mix(b);
  return '#' + ((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<ThemePreset>('forest');
  const [custom, setCustomState] = useState<{ primary: string; dark: string; surface: string } | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(STORE);
      if (raw) {
        try {
          const v = JSON.parse(raw);
          if (v.preset) setPresetState(v.preset);
          if (v.custom) setCustomState(v.custom);
        } catch {}
      }
    })();
  }, []);

  const persist = useCallback(async (p: ThemePreset, c: typeof custom) => {
    await AsyncStorage.setItem(STORE, JSON.stringify({ preset: p, custom: c }));
  }, []);

  const setPreset = useCallback(async (p: ThemePreset) => {
    setPresetState(p);
    await persist(p, custom);
  }, [persist, custom]);

  const setCustom = useCallback(async (primary: string, dark: string, surface: string) => {
    const c = { primary, dark, surface };
    setCustomState(c);
    setPresetState('custom');
    await persist('custom', c);
  }, [persist]);

  const value = useMemo<ThemeShape>(() => {
    let p = PRESETS.forest;
    if (preset === 'custom' && custom) {
      p = { name: 'Custom', ...custom };
    } else if (preset !== 'custom') {
      p = PRESETS[preset];
    }
    return {
      preset,
      accent: p.primary,
      accentDark: p.dark,
      accentSurface: p.surface,
      setPreset,
      setCustom,
    };
  }, [preset, custom, setPreset, setCustom]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}

export function suggestDarkSurface(primary: string) {
  return { dark: shadeHex(primary, -45), surface: softTint(primary) };
}
