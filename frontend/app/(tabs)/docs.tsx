import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, FileText, Lock } from 'lucide-react-native';
import { useVault } from '../../src/contexts/VaultContext';
import { Chip, StatusBadge } from '../../src/components/UI';
import { colors, spacing, radius } from '../../src/constants/theme';
import { fmtDate, getDocStatus } from '../../src/utils/date';

const FILTERS = ['All', 'Expiring Soon', 'Valid', 'Expired'] as const;

export default function Docs() {
  const { docs, family } = useVault();
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (ql && !d.name.toLowerCase().includes(ql) && !d.category.toLowerCase().includes(ql)) return false;
      const s = getDocStatus(d.expiryDate);
      if (filter === 'Expiring Soon' && s !== 'expiring_soon') return false;
      if (filter === 'Valid' && !(s === 'valid' || s === 'none')) return false;
      if (filter === 'Expired' && s !== 'expired') return false;
      return true;
    });
  }, [docs, filter, q]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.sub}>{docs.length} encrypted items</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.xxl }}>
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
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => (
          <Chip key={f} label={f} active={filter === f} onPress={() => setFilter(f)} testID={`filter-${f.replace(' ', '-').toLowerCase()}`} />
        ))}
      </ScrollView>
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap} testID="docs-empty-state">
          <View style={styles.emptyIcon}><FileText color={colors.textTertiary} size={32} strokeWidth={1.4} /></View>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptySub}>Add your first encrypted document</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/upload/type')}>
            <Text style={styles.emptyBtnText}>Add Document</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingBottom: 120, gap: spacing.md }}
          renderItem={({ item }) => {
            const owner = family.find((f) => f.id === item.ownerId);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(`/document/${item.id}`)}
                testID={`doc-card-${item.id}`}
              >
                <View style={styles.thumb}><Lock color={colors.primary} size={18} strokeWidth={1.6} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.docSub}>{item.category} · {owner?.name || 'You'}</Text>
                  <Text style={styles.docDate}>Expires {fmtDate(item.expiryDate)}</Text>
                </View>
                <StatusBadge status={getDocStatus(item.expiryDate)} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  filterRow: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, gap: 8 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  docName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  docSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  docDate: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.xl },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
