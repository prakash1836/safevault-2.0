import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';;
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Calendar, Cake, Stethoscope, FileText, AlertCircle, Clock, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Chip, SectionHeader } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { EmptyState } from '../../src/components/EmptyState';
import { SkeletonRow } from '../../src/components/Skeleton';
import { colors, spacing, radius, typography, shadow } from '../../src/constants/theme';
import { fmtDate, daysUntil } from '../../src/utils/date';
import { parseISO, format, differenceInDays, startOfMonth, startOfYear } from 'date-fns';
import { hapt } from '../../src/utils/haptics';

type ViewMode = 'all' | 'month' | 'year';
type Item = { id: string; title: string; date: string; kind: 'doc' | 'birthday' | 'appointment' | 'custom'; sub?: string; ownerId?: string; docId?: string };

export default function Timeline() {
  const { docs, events, family, loading } = useVault();
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<ViewMode>('all');
  const [memberFilter, setMemberFilter] = useState<string | 'all'>('all');
    

    const horizontalPadding = spacing.xxl * 2;
    const toggleWidth = Math.min(width - horizontalPadding, 300);
    const toggleItemWidth = toggleWidth / 3;
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
        else if (diff <= 7) key = 'This Week';
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
    ? ['Overdue', 'This Week', 'This Month', 'Next 3 Months', 'Later'].filter((k) => groups[k])
    : Object.keys(groups);

  // Stats summary
  const overdueCount = items.filter(it => differenceInDays(parseISO(it.date), new Date()) < 0).length;
  const thisWeekCount = items.filter(it => { const d = differenceInDays(parseISO(it.date), new Date()); return d >= 0 && d <= 7; }).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
        <Text style={styles.title}>Timeline</Text>
        <Text style={styles.sub}>Upcoming expirations & reminders</Text>
      </Animated.View>

      {/* Stats summary */}
      {(overdueCount > 0 || thisWeekCount > 0) && (
        <Animated.View entering={FadeInDown.delay(50).duration(200)} style={styles.statsRow}>
          {overdueCount > 0 && (
            <View style={[styles.statChip, { backgroundColor: colors.expiredSurface }]}>
              <AlertCircle color={colors.expired} size={14} />
              <Text style={[styles.statText, { color: colors.expired }]}>{overdueCount} overdue</Text>
            </View>
          )}
          {thisWeekCount > 0 && (
            <View style={[styles.statChip, { backgroundColor: colors.expiringSurface }]}>
              <Clock color="#dad4c9" size={14} />
              <Text style={[styles.statText, { color: '#8E6A20' }]}>{thisWeekCount} this week</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* View toggle */}
      {/* <View style={styles.viewToggle} testID="timeline-view-toggle">
        {(['all', 'month', 'year'] as ViewMode[]).map((v) => (
          <PressableScale
            key={v}
            onPress={() => { hapt.selection(); setView(v); }}
            testID={`view-${v}`}
            haptic="none"
          >
            <View style={[styles.viewBtn, view === v && { backgroundColor: t.accentDark }]}>
              <Text style={[styles.viewTxt, { color: view === v ? '#fff' : colors.textSecondary }]}>
                {v === 'all' ? 'All' : v === 'month' ? 'By Month' : 'By Year'}
              </Text>
            </View>
          </PressableScale>
        ))}
      </View> */}
      <View
        style={[
          styles.viewToggle,
          {
            width: toggleWidth,
          },
        ]}
        testID="timeline-view-toggle"
      >
        {(['all', 'month', 'year'] as ViewMode[]).map((v) => (
          <PressableScale
            key={v}
            onPress={() => {
              hapt.selection();
              setView(v);
            }}
            testID={`view-${v}`}
            haptic="none"
            style={[
              styles.viewPressable,
              {
                width: toggleItemWidth,
              },
            ]}
          >
            <View
              style={[
                styles.viewBtn,
                view === v && { backgroundColor: t.accentDark },
              ]}
            >
              <Text
                style={[
                  styles.viewTxt,
                  {
                    color: view === v
                      ? '#fff'
                      : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {v === 'all'
                  ? 'All'
                  : v === 'month'
                    ? 'By Month'
                    : 'By Year'}
              </Text>
            </View>
          </PressableScale>
        ))}
      </View>
      {/* Member filter */}
      <View style={styles.memberRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xxl }}>
          <Chip label="All members" active={memberFilter === 'all'} onPress={() => { hapt.selection(); setMemberFilter('all'); }} testID="member-filter-all" size="sm" />
          {family.map((f) => (
            <Chip key={f.id} label={f.name} active={memberFilter === f.id} onPress={() => { hapt.selection(); setMemberFilter(f.id); }} testID={`member-filter-${f.id}`} size="sm" />
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {orderedKeys.length === 0 ? (
          <EmptyState
            icon={<Calendar color={t.accent} size={32} />}
            title="No upcoming events"
            subtitle="Add documents with expiry dates to see them here"
            testID="timeline-empty"
          />
        ) : orderedKeys.map((key, sIdx) => {
          const isOverdue = key === 'Overdue';
          const isUrgent = key === 'This Week';
          const tone = isOverdue ? colors.overdue : isUrgent ? '#8E6A20' : colors.textTertiary;
          return (
            <Animated.View key={key} entering={FadeInDown.delay(100 + sIdx * 50).duration(250)} style={{ marginBottom: spacing.xxl }} testID={`timeline-section-${key.replace(/\s+/g, '-').toLowerCase()}`}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionDot, { backgroundColor: isOverdue ? colors.expiredSurface : isUrgent ? colors.expiringSurface : colors.elevated }]}>
                  {isOverdue ? <AlertCircle color={colors.expired} size={14} /> : isUrgent ? <Clock color="#8E6A20" size={14} /> : <Calendar color={colors.textTertiary} size={14} />}
                </View>
                <Text style={[styles.section, { color: tone }]}>{key}</Text>
                <Text style={styles.sectionCount}>{groups[key].length}</Text>
              </View>
              {groups[key].map((it, idx) => (
                <Row
                  key={it.id}
                  item={it}
                  family={family}
                  accent={t.accent}
                  accentSurface={t.accentSurface}
                  onPress={() => it.kind === 'doc' && it.docId && router.push(`/document/${it.docId}`)}
                  index={idx}
                  isLast={idx === groups[key].length - 1}
                />
              ))}
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ item, family, accent, accentSurface, onPress, index, isLast }: any) {
  const Icon = item.kind === 'birthday' ? Cake : item.kind === 'appointment' ? Stethoscope : item.kind === 'custom' ? Calendar : FileText;
  const owner = family.find((f: any) => f.id === item.ownerId);
  const days = daysUntil(item.date) || 0;
  const isExpiring = item.kind === 'doc' && days <= 30 && days >= 0;
  const isExpired = item.kind === 'doc' && days < 0;
  const tint = isExpired ? colors.expired : isExpiring ? '#8E6A20' : accent;
  const tintBg = isExpired ? colors.expiredSurface : isExpiring ? colors.expiringSurface : accentSurface;

  return (
    <PressableScale onPress={onPress} testID={`timeline-item-${item.id}`} haptic="light">
      <View style={styles.row}>
        <View style={styles.lineWrap}>
          <View style={[styles.dot, { backgroundColor: tintBg }]}><Icon color={tint} size={16} strokeWidth={1.6} /></View>
          {!isLast && <View style={styles.line} />}
        </View>
        <View style={[styles.rowBody, isExpired && { borderColor: colors.expired }, isExpiring && { borderColor: '#DDA750' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, isExpired && { color: colors.expired }]} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowSub}>
                {fmtDate(item.date)}{item.sub ? ` · ${item.sub}` : ''}
              </Text>
            </View>
            {item.kind === 'doc' && (
              <View style={[styles.daysChip, { backgroundColor: tintBg }]}>
                <Text style={[styles.daysTxt, { color: tint }]}>
                  {days >= 0 ? `${days}d` : `${Math.abs(days)}d ago`}
                </Text>
              </View>
            )}
          </View>
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
        <ChevronRight color={colors.textTertiary} size={16} style={{ marginLeft: 8 }} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.textPrimary },
  sub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4 },
  
  // Stats summary
  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xxl, marginBottom: spacing.md },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  statText: { ...typography.caption, fontWeight: '700' },
  
  // View toggle
 viewToggle: {
  flexDirection: 'row',
  marginHorizontal: spacing.xxl,
  padding: 4,
  backgroundColor: colors.elevated,
  borderRadius: radius.pill,
  marginBottom: spacing.xl,
  gap: 4,
  
  
},
viewPressable: {
  flex: 1,
},
 viewBtn: {
  width: '100%',
  minHeight: 28,
  alignItems: 'center',
  justifyContent: 'center',
  // paddingHorizontal: 8,
  borderRadius: 4,
  
  borderWidth:1,
  borderColor: colors.border,

  
  
},
  viewTxt: { ...typography.bodySm, fontWeight: '700' },
  
  // Member filter
  memberRow: { margin: spacing.md, },
  
  // Content
  scroll: { paddingHorizontal: spacing.xxl, paddingBottom: 120 },
  
  // Section header
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  section: { ...typography.overline, flex: 1 },
  sectionCount: { ...typography.caption, color: colors.textTertiary, fontWeight: '700' },
  
  // Timeline row
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, minHeight: 70 },
  lineWrap: { alignItems: 'center', width: 36 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  rowBody: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginLeft: spacing.md, padding: spacing.md, ...shadow.xs },
  rowTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary, marginRight: 8 },
  rowSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  
  // Days chip
  daysChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  daysTxt: { fontSize: 11, fontWeight: '800' },
  
  // Owner tag
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: colors.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  ownerAv: { width: 16, height: 16, borderRadius: 8 },
  ownerName: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
});
