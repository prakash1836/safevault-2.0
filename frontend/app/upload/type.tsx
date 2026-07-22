import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShieldCheck, IdCard, HeartPulse, Landmark, GraduationCap, Home, Car, FileText, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { CATEGORIES } from '../../src/constants/categories';
import { useUpload } from '../../src/contexts/UploadContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { colors, radius, spacing, typography } from '../../src/constants/theme';
import { hapt } from '../../src/utils/haptics';

const ICONS: Record<string, any> = { ShieldCheck, IdCard, HeartPulse, Landmark, GraduationCap, Home, Car, FileText };

export default function TypeStep() {
  const { draft, setDraft } = useUpload();
  const t = useTheme();
  const router = useRouter();

  const choose = (k: any) => {
    hapt.selection();
    setDraft({ category: k });
    router.push('/upload/file');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Add to Vault" />
      <Stepper step={0} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>What are we adding?</Text>
        <Text style={styles.h2}>Pick the category that fits best</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((c, idx) => {
            const Ic = ICONS[c.icon] || FileText;
            const active = draft.category === c.key;
            return (
              <Animated.View key={c.key} entering={FadeInDown.delay(idx * 40).duration(220)}>
                <TouchableOpacity
                  onPress={() => choose(c.key)}
                  style={[styles.tile, active && { borderColor: t.accent, backgroundColor: t.accentSurface }]}
                  activeOpacity={0.8}
                  testID={`upload-category-${c.key}`}
                >
                  <View style={[styles.tileIcon, { backgroundColor: c.color + '22' }]}>
                    <Ic color={c.color} size={22} strokeWidth={1.6} />
                  </View>
                  <Text style={styles.tileLabel}>{c.label}</Text>
                  <ChevronRight color={active ? t.accent : colors.textTertiary} size={16} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: 60 },
  h1: { ...typography.h1, color: colors.textPrimary },
  h2: { ...typography.bodySm, color: colors.textSecondary, marginTop: 6, marginBottom: spacing.xl },
  grid: { gap: spacing.md },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { flex: 1, ...typography.bodyLg, fontWeight: '700', color: colors.textPrimary },
});
