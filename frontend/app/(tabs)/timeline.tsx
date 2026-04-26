import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, Cake, Stethoscope, FileText } from 'lucide-react-native';
import { useVault } from '../../src/contexts/VaultContext';
import { colors, spacing, radius } from '../../src/constants/theme';
import { fmtDate, groupByTimeline } from '../../src/utils/date';

type Item = { id: string; title: string; date: string; kind: 'doc' | 'birthday' | 'appointment' | 'custom'; sub?: string };

export default function Timeline() {
  const { docs, events, family } = useVault();
  const router = useRouter();

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    docs.forEach((d) => {
      if (d.expiryDate) out.push({ id: 'd_' + d.id, title: d.name + ' expires', date: d.expiryDate, kind: 'doc', sub: d.category });
    });
    events.forEach((e) => {
      out.push({ id: 'e_' + e.id, title: e.title, date: e.date, kind: e.type, sub: family.find((f) => f.id === e.ownerId)?.name });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [docs, events, family]);

  const groups = groupByTimeline(items);

  const Section = ({ label, data, tone }: { label: string; data: Item[]; tone: 'overdue' | 'month' | 'later' }) => (
    <View style={{ marginBottom: spacing.xxl }} testID={`timeline-section-${tone}`}>
      <Text style={[styles.section, tone === 'overdue' && { color: colors.overdue }]}>{label}</Text>
      {data.length === 0 ? (
        <Text style={styles.empty}>Nothing here</Text>
      ) : (
        data.map((it) => <Row key={it.id} item={it} onPress={() => it.kind === 'doc' && router.push(`/document/${it.id.slice(2)}`)} />)
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline</Text>
        <Text style={styles.sub}>Everything you need to remember</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section label="Overdue" data={groups.overdue} tone="overdue" />
        <Section label="This Month" data={groups.thisMonth} tone="month" />
        <Section label="Next 3 Months" data={groups.next3} tone="later" />
        <Section label="Later" data={groups.later} tone="later" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ item, onPress }: { item: Item; onPress: () => void }) {
  const Icon =
    item.kind === 'birthday' ? Cake : item.kind === 'appointment' ? Stethoscope : item.kind === 'custom' ? Calendar : FileText;
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={onPress} testID={`timeline-item-${item.id}`}>
      <View style={styles.dot}><Icon color={colors.primary} size={16} strokeWidth={1.6} /></View>
      <View style={styles.line} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowSub}>{fmtDate(item.date)}{item.sub ? ` · ${item.sub}` : ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 100 },
  section: { fontSize: 12, fontWeight: '800', color: colors.textTertiary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.md },
  empty: { color: colors.textTertiary, fontSize: 13, paddingLeft: 24 },
  row: { flexDirection: 'row', paddingLeft: 4, paddingVertical: 2, minHeight: 66 },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  line: { position: 'absolute', left: 21, top: 36, bottom: -8, width: 1, backgroundColor: colors.border },
  rowBody: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginLeft: spacing.md, padding: spacing.md },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
