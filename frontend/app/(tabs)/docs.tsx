import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, FileText, Lock, Calendar as CalIcon, Filter as FilterIcon } from 'lucide-react-native';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { StatusBadge } from '../../src/components/UI';
import { FilterSheet, EMPTY_FILTER, applyFilter, activeFilterCount, type FilterState } from '../../src/components/FilterSheet';
import { colors, spacing, radius } from '../../src/constants/theme';
import { fmtDate, getDocStatus } from '../../src/utils/date';
import { parseISO, format, startOfMonth } from 'date-fns';

type GroupBy = 'list' | 'month';

export default function Docs() {
  const { docs, family } = useVault();
  const t = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('list');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = docs.filter((d) => {
      if (ql && !d.name.toLowerCase().includes(ql) && !d.category.toLowerCase().includes(ql)) return false;
      return true;
    });
    list = applyFilter(list, filter);
    return list;
  }, [docs, q, filter]);

  const grouped = useMemo(() => {
    if (groupBy === 'list') return null;
    const map: Record<string, typeof docs> = {};
    [...filtered]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .forEach((d) => {
        const key = d.createdAt ? format(startOfMonth(parseISO(d.createdAt)), 'MMMM yyyy') : 'Earlier';
        if (!map[key]) map[key] = [];
        map[key].push(d);
      });
    return map;
  }, [filtered, groupBy]);

  const renderCard = (item: any) => {
    const owner = family.find((f) => f.id === item.ownerId);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push(`/document/${item.id}`)}
        testID={`doc-card-${item.id}`}
      >
        <View style={[styles.thumb, { backgroundColor: t.accentSurface }]}><Lock color={t.accent} size={18} strokeWidth={1.6} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.docSub}>{item.category} · {owner?.name || 'You'}</Text>
          <Text style={styles.docDate}>Expires {fmtDate(item.expiryDate)}</Text>
        </View>
        <StatusBadge status={getDocStatus(item.expiryDate)} />
      </TouchableOpacity>
    );
  };

  const fcount = activeFilterCount(filter);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.sub}>{filtered.length} of {docs.length} encrypted items</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.search} testID="docs-search">
          <Search color={colors.textTertiary} size={18} strokeWidth={1.6} />
          <TextInput
            placeholder="Search by name or category"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            testID="docs-search-input"
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, fcount > 0 && { backgroundColor: t.accentDark, borderColor: t.accentDark }]}
          onPress={() => setFilterOpen(true)}
          testID="docs-filter-btn"
        >
          <FilterIcon color={fcount > 0 ? '#fff' : colors.textPrimary} size={18} strokeWidth={1.8} />
          {fcount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: t.accent }]}>
              <Text style={styles.filterBadgeTxt}>{fcount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Group toggle */}
      <View style={styles.groupToggle} testID="docs-group-toggle">
        <TouchableOpacity style={[styles.gBtn, groupBy === 'list' && { backgroundColor: t.accentDark }]} onPress={() => setGroupBy('list')} testID="group-list">
          <Text style={[styles.gTxt, { color: groupBy === 'list' ? '#fff' : colors.textSecondary }]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.gBtn, groupBy === 'month' && { backgroundColor: t.accentDark }]} onPress={() => setGroupBy('month')} testID="group-month">
          <CalIcon color={groupBy === 'month' ? '#fff' : colors.textSecondary} size={14} strokeWidth={2} />
          <Text style={[styles.gTxt, { color: groupBy === 'month' ? '#fff' : colors.textSecondary }]}>By month</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap} testID="docs-empty-state">
          <View style={styles.emptyIcon}><FileText color={colors.textTertiary} size={32} strokeWidth={1.4} /></View>
          <Text style={styles.emptyTitle}>Nothing here</Text>
          <Text style={styles.emptySub}>Try clearing filters or adding a document</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: t.accent }]} onPress={() => router.push('/upload/type')}>
            <Text style={styles.emptyBtnText}>Add Document</Text>
          </TouchableOpacity>
        </View>
      ) : groupBy === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingBottom: 140, gap: spacing.md }}
          renderItem={({ item }) => renderCard(item)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingBottom: 140 }}>
          {Object.entries(grouped!).map(([month, items]) => (
            <View key={month} style={{ marginBottom: spacing.xl }}>
              <Text style={styles.monthHead}>{month}</Text>
              <View style={{ gap: spacing.md }}>{items.map((d) => renderCard(d))}</View>
            </View>
          ))}
        </ScrollView>
      )}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filter}
        onChange={setFilter}
        family={family}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  toolbar: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.xxl, alignItems: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  filterBtn: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, position: 'relative' },
  filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  filterBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  groupToggle: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.xxl, marginTop: spacing.md, marginBottom: spacing.md },
  gBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.elevated },
  gTxt: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  docSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  docDate: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  monthHead: { fontSize: 12, fontWeight: '800', color: colors.textTertiary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.md },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  emptyBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.xl },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
