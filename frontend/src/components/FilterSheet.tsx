import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, X, RotateCcw, Filter as FilterIcon } from 'lucide-react-native';
import { addDays, addMonths, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { colors, radius, spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { PrimaryButton } from './UI';
import { fmtDate, getDocStatus } from '../utils/date';
import type { FamilyMember } from '../types';

export type DateField = 'expiry' | 'issue';
export type StatusKey = 'all' | 'expiring_soon' | 'valid' | 'expired';

export interface FilterState {
  status: StatusKey;
  member: string | 'all';
  from: string | null;
  to: string | null;
  field: DateField;
}

export const EMPTY_FILTER: FilterState = {
  status: 'all',
  member: 'all',
  from: null,
  to: null,
  field: 'expiry',
};

export function activeFilterCount(f: FilterState) {
  let n = 0;
  if (f.status !== 'all') n++;
  if (f.member !== 'all') n++;
  if (f.from || f.to) n++;
  return n;
}

export function applyFilter<T extends { expiryDate?: string; issueDate?: string; ownerId: string }>(
  items: T[],
  f: FilterState
): T[] {
  let list = items;
  if (f.member !== 'all') list = list.filter((d) => d.ownerId === f.member);
  if (f.status !== 'all') {
    list = list.filter((d) => {
      const s = getDocStatus(d.expiryDate);
      if (f.status === 'expiring_soon') return s === 'expiring_soon';
      if (f.status === 'valid') return s === 'valid' || s === 'none';
      if (f.status === 'expired') return s === 'expired';
      return true;
    });
  }
  if (f.from || f.to) {
    const fromMs = f.from ? parseISO(f.from).getTime() : -Infinity;
    const toMs = f.to ? parseISO(f.to).getTime() : Infinity;
    list = list.filter((d) => {
      const ref = f.field === 'issue' ? d.issueDate : d.expiryDate;
      if (!ref) return false;
      const t = parseISO(ref).getTime();
      return t >= fromMs && t <= toMs;
    });
  }
  return list;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  onChange: (f: FilterState) => void;
  family: FamilyMember[];
}

const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expiring_soon', label: 'Expiring soon' },
  { key: 'valid', label: 'Valid' },
  { key: 'expired', label: 'Expired' },
];

export function FilterSheet({ visible, onClose, value, onChange, family }: Props) {
  const t = useTheme();
  const [draft, setDraft] = useState<FilterState>(value);
  const [pickWhich, setPickWhich] = useState<null | 'from' | 'to'>(null);

  useEffect(() => { if (visible) setDraft(value); }, [visible, value]);

  const presets = [
    { label: 'Next 7d', build: (d: FilterState) => ({ ...d, from: new Date().toISOString(), to: addDays(new Date(), 7).toISOString() }) },
    { label: 'Next 30d', build: (d: FilterState) => ({ ...d, from: new Date().toISOString(), to: addDays(new Date(), 30).toISOString() }) },
    { label: 'Next 90d', build: (d: FilterState) => ({ ...d, from: new Date().toISOString(), to: addDays(new Date(), 90).toISOString() }) },
    { label: 'This month', build: (d: FilterState) => ({ ...d, from: startOfMonth(new Date()).toISOString(), to: endOfMonth(new Date()).toISOString() }) },
    { label: 'Next month', build: (d: FilterState) => { const n = addMonths(new Date(), 1); return { ...d, from: startOfMonth(n).toISOString(), to: endOfMonth(n).toISOString() }; } },
    { label: 'Past 30d', build: (d: FilterState) => ({ ...d, from: addDays(new Date(), -30).toISOString(), to: new Date().toISOString() }) },
  ];

  const reset = () => setDraft(EMPTY_FILTER);
  const apply = () => { onChange(draft); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet} testID="filter-sheet">
        <View style={styles.handle} />
        <View style={styles.head}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FilterIcon color={t.accent} size={18} strokeWidth={1.6} />
            <Text style={styles.title}>Filter</Text>
          </View>
          <TouchableOpacity onPress={onClose} testID="filter-close" style={styles.closeBtn}><X color={colors.textPrimary} size={18} /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 30 }}>
          <Text style={styles.lbl}>Status</Text>
          <View style={styles.chipWrap}>
            {STATUS_OPTIONS.map((o) => {
              const active = draft.status === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  onPress={() => setDraft({ ...draft, status: o.key })}
                  style={[styles.pill, active && { backgroundColor: t.accentDark, borderColor: t.accentDark }]}
                  testID={`filter-status-${o.key}`}
                >
                  <Text style={[styles.pillTxt, { color: active ? '#fff' : colors.textSecondary }]}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.lbl}>Member</Text>
          <View style={styles.chipWrap}>
            <TouchableOpacity
              onPress={() => setDraft({ ...draft, member: 'all' })}
              style={[styles.pill, draft.member === 'all' && { backgroundColor: t.accentDark, borderColor: t.accentDark }]}
              testID="filter-member-all"
            >
              <Text style={[styles.pillTxt, { color: draft.member === 'all' ? '#fff' : colors.textSecondary }]}>All members</Text>
            </TouchableOpacity>
            {family.map((m) => {
              const active = draft.member === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setDraft({ ...draft, member: m.id })}
                  style={[styles.pill, active && { backgroundColor: t.accentDark, borderColor: t.accentDark }]}
                  testID={`filter-member-${m.id}`}
                >
                  <Text style={[styles.pillTxt, { color: active ? '#fff' : colors.textSecondary }]}>{m.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.lbl}>Date range — apply to</Text>
          <View style={[styles.chipWrap, { marginBottom: spacing.sm }]}>
            {(['expiry', 'issue'] as DateField[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.pill, draft.field === f && { backgroundColor: t.accent, borderColor: t.accent }]}
                onPress={() => setDraft({ ...draft, field: f })}
                testID={`filter-field-${f}`}
              >
                <Text style={[styles.pillTxt, { color: draft.field === f ? '#fff' : colors.textSecondary }]}>{f === 'expiry' ? 'Expiry date' : 'Issue date'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chipWrap}>
            {presets.map((p) => (
              <TouchableOpacity key={p.label} style={[styles.preset, { borderColor: t.accent }]} onPress={() => setDraft(p.build(draft))} testID={`filter-preset-${p.label.replace(/\s+/g, '-').toLowerCase()}`}>
                <Text style={[styles.presetTxt, { color: t.accent }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLbl}>From</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('from')} testID="filter-date-from">
                <Calendar color={t.accent} size={14} />
                <Text style={styles.dateTxt}>{draft.from ? fmtDate(draft.from) : 'Any'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLbl}>To</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('to')} testID="filter-date-to">
                <Calendar color={t.accent} size={14} />
                <Text style={styles.dateTxt}>{draft.to ? fmtDate(draft.to) : 'Any'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.clearBtn} onPress={reset} testID="filter-clear-all">
            <RotateCcw color={colors.textSecondary} size={14} />
            <Text style={styles.clearTxt}>Clear all</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <PrimaryButton title="Show results" onPress={apply} variant="dark" testID="filter-apply" />
          </View>
        </View>

        {pickWhich && (
          <DateTimePicker
            value={new Date((pickWhich === 'from' ? draft.from : draft.to) || Date.now())}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              if (d) {
                if (pickWhich === 'from') setDraft({ ...draft, from: d.toISOString() });
                else setDraft({ ...draft, to: d.toISOString() });
              }
              if (Platform.OS !== 'ios') setPickWhich(null);
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(28,63,58,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated },
  lbl: { fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
  subLbl: { fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pillTxt: { fontSize: 13, fontWeight: '700' },
  preset: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, backgroundColor: colors.surface },
  presetTxt: { fontSize: 12, fontWeight: '700' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 12 },
  dateTxt: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  clearTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
});
