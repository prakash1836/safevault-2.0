import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, X, RotateCcw } from 'lucide-react-native';
import { addDays, addMonths, format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { colors, radius, spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { PrimaryButton } from './UI';
import { fmtDate } from '../utils/date';

export type DateField = 'expiry' | 'issue';
export interface DateRange {
  from: string | null;
  to: string | null;
  field: DateField;
}

export const EMPTY_RANGE: DateRange = { from: null, to: null, field: 'expiry' };

export function isRangeActive(r: DateRange) {
  return !!(r.from || r.to);
}

export function rangeChipLabel(r: DateRange) {
  if (!isRangeActive(r)) return 'Date range';
  if (r.from && r.to) return `${fmtDate(r.from)} → ${fmtDate(r.to)}`;
  if (r.from) return `From ${fmtDate(r.from)}`;
  if (r.to) return `Until ${fmtDate(r.to)}`;
  return 'Date range';
}

export function applyRange<T extends { issueDate?: string; expiryDate?: string }>(items: T[], r: DateRange): T[] {
  if (!isRangeActive(r)) return items;
  const fromMs = r.from ? parseISO(r.from).getTime() : -Infinity;
  const toMs = r.to ? parseISO(r.to).getTime() : Infinity;
  return items.filter((it) => {
    const ref = r.field === 'issue' ? it.issueDate : it.expiryDate;
    if (!ref) return false;
    const t = parseISO(ref).getTime();
    return t >= fromMs && t <= toMs;
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  value: DateRange;
  onChange: (r: DateRange) => void;
}

export function DateRangeSheet({ visible, onClose, value, onChange }: Props) {
  const t = useTheme();
  const [draft, setDraft] = useState<DateRange>(value);
  const [pickWhich, setPickWhich] = useState<null | 'from' | 'to'>(null);

  React.useEffect(() => { if (visible) setDraft(value); }, [visible, value]);

  const presets: { label: string; build: () => DateRange }[] = [
    { label: 'Next 7 days', build: () => ({ ...draft, from: new Date().toISOString(), to: addDays(new Date(), 7).toISOString() }) },
    { label: 'Next 30 days', build: () => ({ ...draft, from: new Date().toISOString(), to: addDays(new Date(), 30).toISOString() }) },
    { label: 'Next 90 days', build: () => ({ ...draft, from: new Date().toISOString(), to: addDays(new Date(), 90).toISOString() }) },
    { label: 'This month', build: () => ({ ...draft, from: startOfMonth(new Date()).toISOString(), to: endOfMonth(new Date()).toISOString() }) },
    { label: 'Next month', build: () => { const n = addMonths(new Date(), 1); return { ...draft, from: startOfMonth(n).toISOString(), to: endOfMonth(n).toISOString() }; } },
    { label: 'Past 30 days', build: () => ({ ...draft, from: addDays(new Date(), -30).toISOString(), to: new Date().toISOString() }) },
  ];

  const reset = () => setDraft({ ...EMPTY_RANGE, field: draft.field });
  const apply = () => { onChange(draft); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet} testID="date-range-sheet">
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>Date range</Text>
          <TouchableOpacity onPress={onClose} testID="date-range-close"><X color={colors.textPrimary} size={20} /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}>
          <Text style={styles.lbl}>Apply to</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.lg }}>
            {(['expiry', 'issue'] as DateField[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.fieldPill, draft.field === f && { backgroundColor: t.accentDark, borderColor: t.accentDark }]}
                onPress={() => setDraft({ ...draft, field: f })}
                testID={`date-field-${f}`}
              >
                <Text style={[styles.fieldTxt, { color: draft.field === f ? '#fff' : colors.textSecondary }]}>{f === 'expiry' ? 'Expiry date' : 'Issue date'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.lbl}>Quick presets</Text>
          <View style={styles.presetGrid}>
            {presets.map((p) => (
              <TouchableOpacity key={p.label} style={[styles.preset, { borderColor: t.accent }]} onPress={() => setDraft(p.build())} testID={`preset-${p.label.replace(/\s+/g, '-').toLowerCase()}`}>
                <Text style={[styles.presetTxt, { color: t.accent }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.lbl}>Custom range</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLbl}>From</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('from')} testID="date-range-from">
                <Calendar color={t.accent} size={14} />
                <Text style={styles.dateTxt}>{draft.from ? fmtDate(draft.from) : 'Any'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subLbl}>To</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setPickWhich('to')} testID="date-range-to">
                <Calendar color={t.accent} size={14} />
                <Text style={styles.dateTxt}>{draft.to ? fmtDate(draft.to) : 'Any'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <TouchableOpacity style={styles.clearBtn} onPress={reset} testID="date-range-clear">
              <RotateCcw color={colors.textSecondary} size={14} />
              <Text style={styles.clearTxt}>Clear</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <PrimaryButton title="Apply" onPress={apply} variant="dark" testID="date-range-apply" />
            </View>
          </View>
        </ScrollView>

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
  scrim: { flex: 1, backgroundColor: 'rgba(28,63,58,0.35)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  lbl: { fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md },
  subLbl: { fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  fieldPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  fieldTxt: { fontSize: 13, fontWeight: '700' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, backgroundColor: colors.surface },
  presetTxt: { fontSize: 12, fontWeight: '700' },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 12 },
  dateTxt: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  clearTxt: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
});
