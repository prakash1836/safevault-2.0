import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShieldCheck, IdCard, HeartPulse, Landmark, GraduationCap, Home, Car, FileText, ChevronRight } from 'lucide-react-native';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { CATEGORIES } from '../../src/constants/categories';
import { useUpload } from '../../src/contexts/UploadContext';
import { colors, radius, spacing } from '../../src/constants/theme';

const ICONS: Record<string, any> = { ShieldCheck, IdCard, HeartPulse, Landmark, GraduationCap, Home, Car, FileText };

export default function TypeStep() {
  const { draft, setDraft } = useUpload();
  const router = useRouter();

  const choose = (k: any) => {
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
          {CATEGORIES.map((c) => {
            const Ic = ICONS[c.icon] || FileText;
            const active = draft.category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => choose(c.key)}
                style={[styles.tile, active && { borderColor: colors.primary, backgroundColor: colors.primarySurface }]}
                activeOpacity={0.8}
                testID={`upload-category-${c.key}`}
              >
                <View style={[styles.tileIcon, { backgroundColor: c.color + '22' }]}>
                  <Ic color={c.color} size={22} strokeWidth={1.6} />
                </View>
                <Text style={styles.tileLabel}>{c.label}</Text>
                <ChevronRight color={colors.textTertiary} size={16} />
              </TouchableOpacity>
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
  h1: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: spacing.xl },
  grid: { gap: spacing.md },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
