import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, FileText, Lock, Calendar as CalIcon, Filter as FilterIcon, X, ArrowUpDown } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { StatusBadge, Chip, IconButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { SkeletonRow } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { FilterSheet, EMPTY_FILTER, applyFilter, activeFilterCount, type FilterState } from '../../src/components/FilterSheet';
import { colors, spacing, radius, shadow, typography } from '../../src/constants/theme';
import { fmtDate, getDocStatus } from '../../src/utils/date';
import { parseISO, format, startOfMonth } from 'date-fns';
import { hapt } from '../../src/utils/haptics';
import { CATEGORY_META } from '../../src/constants/categories';

type GroupBy = 'list' | 'month';
type SortKey = 'name' | 'added' | 'modified' | 'expiry';
const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  added: 'Date added',
  modified: 'Recently modified',
  expiry: 'Expiry date',
};
const SORT_ORDER: SortKey[] = ['name', 'added', 'modified', 'expiry'];

export default function Docs() {
  const { docs, family, loading } = useVault();
  const t = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('list');
  const [sortBy, setSortBy] = useState<SortKey>('added');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = docs.filter((d) => {
      if (ql && !d.name.toLowerCase().includes(ql) && !d.category.toLowerCase().includes(ql)) return false;
      return true;
    });
    list = applyFilter(list, filter);
    // Apply sort. Sort is stable and never mutates the source array.
    const sorted = [...list];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        break;
      case 'added':
        sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'modified':
        sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        break;
      case 'expiry':
        // Docs without expiry go to the end.
        sorted.sort((a, b) => {
          const ax = a.expiryDate || '';
          const bx = b.expiryDate || '';
          if (!ax && !bx) return 0;
          if (!ax) return 1;
          if (!bx) return -1;
          return ax.localeCompare(bx);
        });
        break;
    }
    return sorted;
  }, [docs, q, filter, sortBy]);

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

  const clearSearch = () => { setQ(''); hapt.light(); };

  const renderCard = (item: typeof docs[0], idx: number) => {
    const owner = family.find((f) => f.id === item.ownerId);
    const catMeta = CATEGORY_META[item.category] || CATEGORY_META.Other;
    const status = getDocStatus(item.expiryDate);
    
    return (
      <Animated.View key={item.id} entering={FadeInDown.delay(idx * 40).duration(250)}>
        <PressableScale
          onPress={() => router.push(`/document/${item.id}`)}
          testID={`doc-card-${item.id}`}
          haptic="light"
        >
          <View style={styles.card}>
            <View style={[styles.thumb, { backgroundColor: catMeta.surface }]}>
              <Lock color={catMeta.color} size={18} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.docSub}>{item.category} · {owner?.name || 'You'}</Text>
              {item.expiryDate && (
                <Text style={[styles.docDate, status === 'expired' && { color: colors.expired }]}>
                  {status === 'expired' ? 'Expired ' : 'Expires '}{fmtDate(item.expiryDate)}
                </Text>
              )}
            </View>
            <StatusBadge status={status} compact />
          </View>
        </PressableScale>
      </Animated.View>
    );
  };

  const fcount = activeFilterCount(filter);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <View>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.sub}>{filtered.length} of {docs.length} encrypted items</Text>
        </View>
      </Animated.View>

      {/* Search & Filter toolbar */}
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
            returnKeyType="search"
          />
          {q.length > 0 && (
            <PressableScale onPress={clearSearch} haptic="light" style={{ padding: 4 }}>
              <X color={colors.textSecondary} size={16} strokeWidth={2} />
            </PressableScale>
          )}
        </View>
        <IconButton
          variant={fcount > 0 ? 'accent' : 'surface'}
          size={48}
          onPress={() => { hapt.light(); setFilterOpen(true); }}
          testID="docs-filter-btn"
          badge={fcount > 0 ? fcount : undefined}
          badgeColor={t.accent}
          accessibilityLabel="Filter documents"
        >
          <FilterIcon color={fcount > 0 ? t.accent : colors.textPrimary} size={18} strokeWidth={1.8} />
        </IconButton>
      </View>

      {/* Group toggle chips */}
      <View style={styles.groupToggle} testID="docs-group-toggle">
        <Chip
          label="List"
          active={groupBy === 'list'}
          onPress={() => setGroupBy('list')}
          testID="group-list"
          size="sm"
        />
        <Chip
          label="By month"
          active={groupBy === 'month'}
          onPress={() => setGroupBy('month')}
          testID="group-month"
          icon={<CalIcon color={groupBy === 'month' ? '#fff' : colors.textSecondary} size={12} strokeWidth={2} />}
          size="sm"
        />
      </View>

      {/* Sort chips */}
      <View style={styles.sortRow} testID="docs-sort-row">
        <ArrowUpDown color={colors.textTertiary} size={13} strokeWidth={2} />
        <Text style={styles.sortLabel}>Sort</Text>
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.md }}>
            {SORT_ORDER.map((k) => (
              <Chip
                key={k}
                label={SORT_LABELS[k]}
                active={sortBy === k}
                onPress={() => { hapt.selection(); setSortBy(k); }}
                testID={`sort-${k}`}
                size="sm"
              />
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Document List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText color={t.accent} size={32} strokeWidth={1.4} />}
          title="No documents found"
          subtitle={q || fcount > 0 ? "Try clearing filters or search" : "Add your first document to get started"}
          actionLabel="Add Document"
          onAction={() => router.push('/upload/type')}
          testID="docs-empty-state"
        />
      ) : groupBy === 'list' ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingBottom: 140, gap: spacing.sm }}
          renderItem={({ item, index }) => renderCard(item, index)}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          {Object.entries(grouped!).map(([month, items]) => (
            <View key={month} style={{ marginBottom: spacing.xl }}>
              <Text style={styles.monthHead}>{month}</Text>
              <View style={{ gap: spacing.sm }}>{items.map((d, i) => renderCard(d, i))}</View>
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
  title: { ...typography.h1, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  
  // Toolbar
  toolbar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxl, alignItems: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },
  
  // Group toggle
  groupToggle: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxl, marginTop: spacing.md, marginBottom: spacing.sm },

  // Sort row (additive; does not disturb existing layout)
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.xxl, marginBottom: spacing.md },
  sortLabel: { ...typography.overline, color: colors.textTertiary, marginRight: 4 },
  
  // Document card
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadow.xs },
  thumb: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  docName: { ...typography.h3, color: colors.textPrimary },
  docSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  docDate: { ...typography.caption, color: colors.textTertiary, marginTop: 4 },
  
  // Month grouping header
  monthHead: { ...typography.overline, color: colors.textTertiary, marginBottom: spacing.md },
});
