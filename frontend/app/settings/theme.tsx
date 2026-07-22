import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check } from 'lucide-react-native';
import { useTheme, PRESETS, suggestDarkSurface } from '../../src/contexts/ThemeContext';
import { PrimaryButton } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';

export default function ThemeSettings() {
  const t = useTheme();
  const router = useRouter();
  const [hex, setHex] = useState('#2461E8');

  const isHex = /^#[0-9a-fA-F]{6}$/.test(hex);

  const applyCustom = async () => {
    if (!isHex) { Alert.alert('Invalid color', 'Use a 6-digit hex like #2461E8'); return; }
    const { dark, surface } = suggestDarkSurface(hex);
    await t.setCustom(hex, dark, surface);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="theme-back-btn"><ChevronLeft color={colors.textPrimary} size={22} /></TouchableOpacity>
        <Text style={styles.topTitle}>Appearance</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.xxl, paddingBottom: 60 }}>
        <Text style={styles.h1}>Theme</Text>
        <Text style={styles.h2}>Pick a preset or use any custom color. Your reminder/status colors stay universal.</Text>

        <View style={styles.previewCard} testID="theme-preview">
          <View style={[styles.previewBg, { backgroundColor: t.accentDark }]}>
            <Text style={styles.previewTitle}>Vault Health</Text>
            <Text style={styles.previewVal}>92%</Text>
          </View>
          <View style={{ padding: spacing.md, gap: 8 }}>
            <View style={[styles.previewChip, { backgroundColor: t.accentDark }]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Active chip</Text></View>
            <View style={[styles.previewChip, { backgroundColor: t.accentSurface }]}><Text style={{ color: t.accent, fontWeight: '700', fontSize: 12 }}>Surface tint</Text></View>
          </View>
        </View>

        <Text style={styles.section}>Presets</Text>
        <View style={styles.grid}>
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => {
            const p = PRESETS[k];
            const selected = t.preset === k;
            return (
              <TouchableOpacity key={k} style={styles.tile} onPress={() => t.setPreset(k)} testID={`theme-${k}`} activeOpacity={0.85}>
                <View style={[styles.tileSwatch, { backgroundColor: p.dark }]}>
                  <View style={[styles.tileDot, { backgroundColor: p.primary }]} />
                  <View style={[styles.tileDot, { backgroundColor: p.surface, position: 'absolute', right: 8, bottom: 8 }]} />
                  {selected && (
                    <View style={styles.checkBadge}><Check color="#fff" size={14} strokeWidth={3} /></View>
                  )}
                </View>
                <Text style={styles.tileName}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.section}>Custom color</Text>
        <View style={[styles.customRow, { borderColor: isHex ? hex : colors.border }]}>
          <View style={[styles.customSwatch, { backgroundColor: isHex ? hex : colors.elevated }]} />
          <TextInput value={hex} onChangeText={setHex} style={styles.hexInput} placeholder="#RRGGBB" placeholderTextColor={colors.textTertiary} autoCapitalize="characters" testID="theme-custom-hex" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md }}>
          {['#4A7D6A', '#3D6E8F', '#6E5AAB', '#D17A4A', '#3F4146', '#B94C5C', '#0E7C7B', '#A06845', '#3F5897'].map((c) => (
            <TouchableOpacity key={c} onPress={() => setHex(c)} style={[styles.swatchBtn, { backgroundColor: c }]} testID={`swatch-${c}`} />
          ))}
        </View>
        <PrimaryButton title="Apply custom theme" onPress={applyCustom} variant="dark" testID="theme-apply-custom" style={{ marginTop: spacing.lg }} disabled={!isHex} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  h1: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  section: { fontSize: 12, fontWeight: '800', color: colors.textTertiary, letterSpacing: 2, textTransform: 'uppercase', marginTop: spacing.xxl, marginBottom: spacing.md },
  previewCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg },
  previewBg: { padding: spacing.lg },
  previewTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  previewVal: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  previewChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '47%' },
  tileSwatch: { height: 90, borderRadius: radius.lg, padding: 12, position: 'relative', overflow: 'hidden' },
  tileDot: { width: 32, height: 32, borderRadius: 16, position: 'absolute', left: 12, top: 12 },
  tileName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 6 },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: radius.lg, borderWidth: 1.5, backgroundColor: colors.surface },
  customSwatch: { width: 44, height: 44, borderRadius: 12 },
  hexInput: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textPrimary, padding: 0 },
  swatchBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
});
