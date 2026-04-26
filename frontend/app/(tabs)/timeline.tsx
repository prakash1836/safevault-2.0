import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, Cake, Stethoscope, FileText, Filter } from 'lucide-react-native';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Chip } from '../../src/components/UI';
import { colors, spacing, radius } from '../../src/constants/theme';
import { fmtDate, daysUntil } from '../../src/utils/date';
import { parseISO, format, differenceInDays, startOfMonth, startOfYear } from 'date-fns';

type View = 'all' | 'month' | 'year';
type Item = { id: string; title: string; date: string; kind: 'doc' | 'birthday' | 'appointment' | 'custom'; sub?: string; ownerId?: string; docId?: string };

export default function Timeline() {
  const { docs, events, family } = useVault();
  const t = useTheme();
  const router = useRouter();
  const [view, setView] = useState<View>('all');
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all');

  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    docs.forEach((d) => {
      if (d.expiryDate) out.push({ id: 'd_' + d.id, docId: d.id, title: d.name + ' expires', date: d.expiryDate, kind: 'doc', sub: d.category, ownerId: d.ownerId });
    });
    events.forEach((e) => {
      out.push({ id: 'e_' + e.id, title: e.title, date: e.date, kind: e.type, ownerId: e.ownerId });
    });
    return out
      .filter((it) => memberFilter === 'all' || it.ownerId === memberFilter)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [docs, events, memberFilter]);

  const groups = useMemo(() => {
    const map: Record<string, Item[]> = {};
    items.forEach((it) => {
      const d = parseISO(it.date);
      let key: string;
      if (view === 'month') key = format(startOfMonth(d), 'MMMM yyyy');
      else if (view === 'year') key = format(startOfYear(d), 'yyyy');
      else {
        const diff = differenceInDays(d, new Date());
        if (diff < 0) key = 'Overdue';
        else if (diff <= 30) key = 'This Month';
        else if (diff <= 90) key = 'Next 3 Months';
        else key = 'Later';
      }
      if (!map[key]) map[key] = [];
      map[key].push(it);
    });
    return map;
  }, [items, view]);

  const orderedKeys = view === 'all'
    ? ['Overdue', 'This Month', 'Next 3 Months', 'Later'].filter((k) => groups[k])
    : Object.keys(groups);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Timeline</Text>
        <Text style={styles.sub}>Everything you need to remember</Text>
      </View>

      <View style={styles.viewToggle} testID="timeline-view-toggle">
        {(['all', 'month', 'year'] as View[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.viewBtn, view === v && { backgroundColor: t.accentDark }]}
            onPress={() => setView(v)}
            testID={`view-${v}`}
          >
            <Text style={[styles.viewTxt, { color: view === v ? '#fff' : colors.textSecondary }]}>
              {v === 'all' ? 'All' : v === 'month' ? 'By Month' : 'By Year'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.memberRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xxl }}>
          <Chip label="All members" active={memberFilter === 'all'} onPress={() => setMemberFilter('all')} testID="member-filter-all" />
          {family.map((f) => (
            <Chip key={f.id} label={f.name} active={memberFilter === f.id} onPress={() => setMemberFilter(f.id)} testID={`member-filter-${f.id}`} />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {orderedKeys.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyTxt}>No events to show</Text></View>
        ) : orderedKeys.map((key) => {
          const tone = key === 'Overdue' ? colors.overdue : colors.textTertiary;
          return (
            <View key={key} style={{ marginBottom: spacing.xxl }} testID={`timeline-section-${key.replace(/\s+/g, '-').toLowerCase()}`}>
              <Text style={[styles.section, { color: tone }]}>{key}</Text>
              {groups[key].map((it) => <Row key={it.id} item={it} family={family} accent={t.accent} accentSurface={t.accentSurface} onPress={() => it.kind === 'doc' && it.docId && router.push(`/document/${it.docId}`)} />)}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ item, family, accent, accentSurface, onPress }: any) {
  const Icon = item.kind === 'birthday' ? Cake : item.kind === 'appointment' ? Stethoscope : item.kind === 'custom' ? Calendar : FileText;
  const owner = family.find((f: any) => f.id === item.ownerId);
  const days = daysUntil(item.date) || 0;
  const isExpiring = item.kind === 'doc' && days <= 30 && days >= 0;
  const isExpired = item.kind === 'doc' && days < 0;
  const tint = isExpired ? colors.expired : isExpiring ? '#8E6A20' : accent;
  const tintBg = isExpired ? '#F8E3DC' : isExpiring ? '#FBF1DE' : accentSurface;

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={onPress} testID={`timeline-item-${item.id}`}>
      <View style={[styles.dot, { backgroundColor: tintBg }]}><Icon color={tint} size={16} strokeWidth={1.6} /></View>
      <View style={styles.line} />
      <View style={[styles.rowBody, isExpired && { borderColor: colors.expired }, isExpiring && { borderColor: '#DDA750' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Text style={[styles.rowTitle, isExpired && { color: colors.expired }]} numberOfLines={1}>{item.title}</Text>
          {owner && (
            <View style={styles.ownerRow}>
              {owner.avatar ? <Image source={{ uri: owner.avatar }} style={styles.ownerAv} /> :
                <View style={[styles.ownerAv, { backgroundColor: accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: accent }}>{owner.name[0]}</Text>
                </View>}
              <Text style={styles.ownerName}>{owner.name}</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowSub}>{fmtDate(item.date)}{item.sub ? ` · ${item.sub}` : ''}{item.kind === 'doc' && days >= 0 ? ` · ${days}d` : item.kind === 'doc' ? ` · ${Math.abs(days)}d ago` : ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  viewToggle: { flexDirection: 'row', marginHorizontal: spacing.xxl, padding: 4, backgroundColor: colors.elevated, borderRadius: radius.pill, marginBottom: spacing.md },
  viewBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.pill },
  viewTxt: { fontSize: 13, fontWeight: '700' },
  memberRow: { marginBottom: spacing.md },
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.md },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { color: colors.textTertiary, fontSize: 13 },
  row: { flexDirection: 'row', paddingLeft: 4, paddingVertical: 2, minHeight: 70 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  line: { position: 'absolute', left: 21, top: 36, bottom: -8, width: 1, backgroundColor: colors.border },
  rowBody: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginLeft: spacing.md, padding: spacing.md },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginRight: 8 },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.elevated, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill },
  ownerAv: { width: 16, height: 16, borderRadius: 8 },
  ownerName: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
});
