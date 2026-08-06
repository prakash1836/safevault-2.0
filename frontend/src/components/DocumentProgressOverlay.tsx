import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Cloud, Lock, FileText, Check } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { ProgressBar } from './UI';

/**
 * Full-screen progress overlay used when opening / exporting a document.
 * Stages: preparing → downloading → decrypting → opening
 * Never freezes the UI — the parent should keep this mounted while the async
 * work runs and pass the current stage.
 */
export type DocProgressStage = 'preparing' | 'downloading' | 'decrypting' | 'opening' | 'done';

const STAGE_META: Record<DocProgressStage, { title: string; sub: string; icon: any }> = {
  preparing:   { title: 'Preparing Document',      sub: 'Getting things ready…',                   icon: FileText },
  downloading: { title: 'Downloading Secure Copy', sub: 'Fetching encrypted file from your Drive…', icon: Cloud    },
  decrypting:  { title: 'Decrypting',              sub: 'Unlocking with your on-device key…',       icon: Lock     },
  opening:     { title: 'Opening',                 sub: 'Almost there…',                            icon: Check    },
  done:        { title: 'Done',                    sub: '',                                         icon: Check    },
};

export function DocumentProgressOverlay({
  visible,
  stage,
  progress,
  testID,
}: {
  visible: boolean;
  stage: DocProgressStage;
  progress?: number; // 0..1 — used during downloading
  testID?: string;
}) {
  const t = useTheme();
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.scrim} testID={testID}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: t.accentSurface }]}>
            <Icon color={t.accent} size={30} strokeWidth={1.6} />
          </View>
          <Text style={styles.title}>{meta.title}</Text>
          {!!meta.sub && <Text style={styles.sub}>{meta.sub}</Text>}
          <View style={styles.bottom}>
            {stage === 'downloading' && typeof progress === 'number' ? (
              <>
                <ProgressBar value={progress} height={6} color={t.accent} />
                <Text style={[styles.pct, { color: t.accent }]}>{Math.round((progress || 0) * 100)}%</Text>
              </>
            ) : (
              <ActivityIndicator color={t.accent} />
            )}
          </View>
          <View style={styles.stepsRow}>
            {(['preparing', 'downloading', 'decrypting', 'opening'] as DocProgressStage[]).map((s) => {
              const currentIndex = ['preparing', 'downloading', 'decrypting', 'opening'].indexOf(stage);
              const myIndex = ['preparing', 'downloading', 'decrypting', 'opening'].indexOf(s);
              const active = myIndex === currentIndex;
              const done = myIndex < currentIndex;
              return (
                <View
                  key={s}
                  style={[
                    styles.dot,
                    { backgroundColor: done ? t.accent : active ? t.accent : colors.border, opacity: active ? 1 : done ? 0.8 : 0.4 },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 31, 82, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.hero,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  sub: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
  bottom: { width: '100%', marginTop: spacing.sm, alignItems: 'center', gap: 6 },
  pct: { ...typography.bodySm, fontWeight: '800' },
  stepsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
