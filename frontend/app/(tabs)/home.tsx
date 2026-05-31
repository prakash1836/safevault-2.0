import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Modal, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Cloud, ShieldCheck, ArrowRight, Plus, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { Card, ProgressBar, SectionHeader, StatusBadge, IconButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { SkeletonBox, SkeletonRow, SkeletonHero } from '../../src/components/Skeleton';
import { EmptyState } from '../../src/components/EmptyState';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, spacing, radius, shadow, typography } from '../../src/constants/theme';
import { fmtDate, getDocStatus, daysUntil } from '../../src/utils/date';
import { SUGGESTED_DOCS } from '../../src/constants/categories';
import { hapt } from '../../src/utils/haptics';

function formatBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

function getGreeting(): { greeting: string; subtitle: string } {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { greeting: 'Good morning', subtitle: 'Your vault is secure and ready' };
  if (h >= 12 && h < 17) return { greeting: 'Good afternoon', subtitle: 'Documents safe and organized' };
  if (h >= 17 && h < 21) return { greeting: 'Good evening', subtitle: 'All documents protected' };
  return { greeting: 'Hey there', subtitle: 'Your vault never sleeps' };
}

// Circular progress ring component
function VaultRing({ progress, size = 90, strokeWidth = 8, color }: { progress: number; size?: number; strokeWidth?: number; color: string }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth={strokeWidth} fill="transparent" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
    </Svg>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { docs, vaultHealth, drive, family, expiringCount, loading, refreshDrive } = useVault();
  const { warnings } = usePermissions();
  const t = useTheme();
  const router = useRouter();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { greeting, subtitle } = getGreeting();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hapt.light();
    await refreshDrive();
    setRefreshing(false);
    hapt.success();
  }, [refreshDrive]);

  const upcoming = useMemo(() => docs
    .filter((d) => { const s = getDocStatus(d.expiryDate); return s === 'expiring_soon' || s === 'expired'; })
    .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
    .slice(0, 3), [docs]);

  const have = new Set(docs.map((d) => d.name.toLowerCase()));
  const suggestions = SUGGESTED_DOCS.filter((s) => !have.has(s.toLowerCase())).slice(0, 3);
  const usedPct = drive.total > 0 ? drive.used / drive.total : 0;
  const driveLow = usedPct > 0.85;

  // Build alert feed
  const alerts = useMemo(() => {
    const arr: { id: string; kind: 'warn' | 'danger' | 'info'; title: string; sub?: string }[] = [];
    docs.forEach((d) => {
      const s = getDocStatus(d.expiryDate);
      if (s === 'expired') arr.push({ id: 'exp_' + d.id, kind: 'danger', title: `${d.name} expired`, sub: fmtDate(d.expiryDate) });
      else if (s === 'expiring_soon') arr.push({ id: 'exs_' + d.id, kind: 'warn', title: `${d.name} expiring soon`, sub: `In ${daysUntil(d.expiryDate)} days` });
    });
    if (driveLow) arr.push({ id: 'drv', kind: 'warn', title: 'Drive almost full', sub: `${Math.round(usedPct * 100)}% used — consider cleaning up` });
    warnings.forEach((w, i) => arr.push({ id: 'pw_' + i, kind: 'info', title: w }));
    return arr;
  }, [docs, driveLow, usedPct, warnings]);

  // Loading state with skeletons
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.scroll}>
          <View style={styles.header}>
            <View>
              <SkeletonBox width={180} height={28} br={8} />
              <View style={{ height: 8 }} />
              <SkeletonBox width={140} height={14} br={6} />
            </View>
            <SkeletonBox width={42} height={42} br={21} />
          </View>
          <SkeletonHero style={{ marginTop: spacing.md }} />
          <View style={{ marginTop: spacing.lg }}>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
            colors={[t.accent]}
          />
        }
      >
        {/* Header with greeting */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.subGreeting}>{alerts.length > 0 ? `${alerts.length} item${alerts.length > 1 ? 's' : ''} need attention` : subtitle}</Text>
          </View>
          <IconButton
            testID="notif-btn"
            variant="surface"
            size={44}
            onPress={() => { hapt.light(); setAlertsOpen(true); }}
            badge={alerts.length > 0 ? alerts.length : undefined}
            badgeColor={colors.expired}
            accessibilityLabel={`Notifications, ${alerts.length} alerts`}
          >
            <Bell color={colors.textPrimary} size={20} strokeWidth={1.6} />
          </IconButton>
        </Animated.View>

        {/* Premium Vault Health Card with Ring */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)} style={[styles.healthCard, { backgroundColor: t.accentDark }]} testID="vault-health-card">
          <View style={styles.healthTop}>
            <View style={styles.healthRingWrap}>
              <VaultRing progress={vaultHealth / 100} color="#9AC5B2" size={94} strokeWidth={8} />
              <View style={styles.healthRingInner}>
                <Text style={styles.healthRingValue}>{vaultHealth}</Text>
                <Text style={styles.healthRingLabel}>%</Text>
              </View>
            </View>
            <View style={styles.healthInfo}>
              <View style={styles.healthTitleRow}>
                <ShieldCheck color="rgba(255,255,255,0.8)" size={16} strokeWidth={1.8} />
                <Text style={styles.healthLabel}>Vault Health</Text>
              </View>
              <Text style={styles.healthDesc}>
                {vaultHealth >= 80 ? 'Excellent! Your documents are well organized.' :
                 vaultHealth >= 50 ? 'Good, but some documents need attention.' :
                 'Several documents require your attention.'}
              </Text>
            </View>
          </View>
          <View style={styles.healthDivider} />
          <View style={styles.healthStats}>
            <StatItem label="Documents" value={String(docs.length)} icon={<Sparkles color="rgba(255,255,255,0.6)" size={12} />} />
            <StatItem label="Expiring" value={String(expiringCount)} warn={expiringCount > 0} />
            <StatItem label="Members" value={String(family.length)} />
          </View>
        </Animated.View>

        {/* Google Drive Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)}>
          <Card style={{ marginTop: spacing.lg }} variant="elevated" testID="drive-usage-card">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.iconTile, { backgroundColor: t.accentSurface }]}>
                  <Cloud color={t.accent} size={18} strokeWidth={1.6} />
                </View>
                <View>
                  <Text style={styles.cardTitle}>Google Drive</Text>
                  <Text style={styles.cardSub}>{user?.demo ? 'Demo mode · local storage' : user?.email}</Text>
                </View>
              </View>
              <Text style={[styles.pctText, driveLow && { color: colors.expired }]}>{Math.round(usedPct * 100)}%</Text>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <ProgressBar value={usedPct} color={driveLow ? colors.expired : t.accent} height={6} />
              <Text style={styles.storageText}>{formatBytes(drive.used)} of {formatBytes(drive.total)} used</Text>
            </View>
          </Card>
        </Animated.View>

        {/* Permission Warnings Banner */}
        {warnings.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={styles.warnBanner} testID="permission-warnings">
            <AlertTriangle color={colors.expired} size={16} />
            <Text style={styles.warnText}>{warnings.length} permission{warnings.length > 1 ? 's' : ''} need attention</Text>
            <PressableScale onPress={() => router.push('/(tabs)/profile')} haptic="light">
              <Text style={[styles.warnLink, { color: t.accent }]}>Fix →</Text>
            </PressableScale>
          </Animated.View>
        )}

        {/* Needs Attention Section */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader
            title="Needs attention"
            subtitle={upcoming.length > 0 ? `${upcoming.length} document${upcoming.length > 1 ? 's' : ''}` : undefined}
            action={
              <PressableScale onPress={() => router.push('/(tabs)/docs')} testID="see-all-expiring" haptic="light">
                <Text style={[styles.link, { color: t.accent }]}>See all</Text>
              </PressableScale>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck color={t.accent} size={32} strokeWidth={1.4} />}
              title="All clear!"
              subtitle="No documents expiring soon. Great job keeping things organized."
              compact
              testID="attention-empty"
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {upcoming.map((d, idx) => {
                const status = getDocStatus(d.expiryDate);
                const days = daysUntil(d.expiryDate);
                return (
                  <Animated.View key={d.id} entering={FadeInDown.delay(300 + idx * 60).duration(280)}>
                    <PressableScale onPress={() => router.push(`/document/${d.id}`)} testID={`attention-doc-${d.id}`} haptic="light">
                      <View style={styles.attentionRow}>
                        <View style={[styles.alertIcon, { backgroundColor: status === 'expired' ? colors.expiredSurface : colors.expiringSurface }]}>
                          <AlertCircle color={status === 'expired' ? colors.expired : '#8E6A20'} size={18} strokeWidth={1.6} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.attName} numberOfLines={1}>{d.name}</Text>
                          <Text style={styles.attSub}>{status === 'expired' ? `Expired ${fmtDate(d.expiryDate)}` : `Expires in ${days} day${days === 1 ? '' : 's'}`}</Text>
                        </View>
                        <StatusBadge status={status} compact />
                      </View>
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        {/* Suggestions Section */}
        {suggestions.length > 0 && (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title="Missing in your vault" subtitle="Recommended documents" />
            <View style={{ gap: spacing.sm }}>
              {suggestions.map((s, idx) => (
                <Animated.View key={s} entering={FadeInDown.delay(400 + idx * 50).duration(250)}>
                  <PressableScale onPress={() => router.push('/upload/type')} testID={`suggest-${s}`} haptic="light">
                    <View style={styles.suggestionRow}>
                      <Text style={styles.suggestText}>{s}</Text>
                      <View style={[styles.addBtn, { backgroundColor: t.accentSurface }]}>
                        <Plus color={t.accent} size={14} strokeWidth={2.5} />
                        <Text style={[styles.addBtnText, { color: t.accent }]}>Add</Text>
                      </View>
                    </View>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* Family Section */}
        <View style={{ marginTop: spacing.xxl, marginBottom: 40 }}>
          <SectionHeader
            title="Family"
            subtitle={`${family.length} member${family.length !== 1 ? 's' : ''}`}
            action={
              <PressableScale onPress={() => router.push('/family')} testID="manage-family-btn" haptic="light">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.link, { color: t.accent }]}>Manage</Text>
                  <ArrowRight color={t.accent} size={14} />
                </View>
              </PressableScale>
            }
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {family.map((f) => {
              const count = docs.filter((d) => d.ownerId === f.id).length;
              return (
                <PressableScale key={f.id} onPress={() => router.push({ pathname: '/family', params: { focus: f.id } })} testID={`family-card-${f.id}`} haptic="selection">
                  <View style={styles.famCard}>
                    {f.avatar ? (
                      <Image source={{ uri: f.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: t.accent, fontWeight: '700', fontSize: 18 }}>{f.name[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.famName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.famSub}>{count} doc{count !== 1 ? 's' : ''}</Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Alerts Modal */}
      <Modal visible={alertsOpen} animationType="slide" transparent onRequestClose={() => setAlertsOpen(false)}>
        <Pressable style={styles.modalScrim} onPress={() => setAlertsOpen(false)} />
        <View style={styles.alertsSheet} testID="alerts-sheet">
          <View style={styles.alertsHandle} />
          <Text style={styles.alertsTitle}>Notifications</Text>
          {alerts.length === 0 ? (
            <EmptyState
              icon={<Bell color={t.accent} size={28} strokeWidth={1.4} />}
              title="You're all caught up"
              subtitle="No pending alerts or reminders"
              compact
            />
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {alerts.map((a) => {
                const tone = a.kind === 'danger' ? colors.expired : a.kind === 'warn' ? '#8E6A20' : t.accent;
                const bg = a.kind === 'danger' ? colors.expiredSurface : a.kind === 'warn' ? colors.expiringSurface : t.accentSurface;
                return (
                  <View key={a.id} style={styles.alertRow}>
                    <View style={[styles.alertDot, { backgroundColor: bg }]}>
                      <AlertCircle color={tone} size={18} strokeWidth={1.6} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{a.title}</Text>
                      {a.sub && <Text style={styles.alertSub}>{a.sub}</Text>}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatItem({ label, value, icon, warn }: { label: string; value: string; icon?: React.ReactNode; warn?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <Text style={[styles.statVal, warn && { color: colors.expiringSoon }]}>{value}</Text>
      </View>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { ...typography.h1, color: colors.textPrimary },
  subGreeting: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4 },
  
  // Premium Health Card
  healthCard: { borderRadius: radius.hero, padding: spacing.xl, ...shadow.hero },
  healthTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  healthRingWrap: { position: 'relative', width: 94, height: 94 },
  healthRingInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  healthRingValue: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  healthRingLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '700', marginTop: 4 },
  healthInfo: { flex: 1 },
  healthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  healthLabel: { color: colors.textOnDarkMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  healthDesc: { color: colors.textOnDark, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  healthDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: spacing.lg },
  healthStats: { flexDirection: 'row', justifyContent: 'space-around' },
  statVal: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLbl: { color: colors.textOnDarkSubtle, fontSize: 10, marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' },
  
  // Drive Card
  iconTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.h3, color: colors.textPrimary },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  pctText: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  storageText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  
  // Warning Banner
  warnBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.expiredSurface, padding: spacing.md, borderRadius: radius.lg, marginTop: spacing.lg },
  warnText: { ...typography.bodySm, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  warnLink: { ...typography.bodySm, fontWeight: '700' },
  
  // Section links
  link: { ...typography.bodySm, fontWeight: '700' },
  
  // Attention rows
  attentionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  alertIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  attName: { ...typography.h3, color: colors.textPrimary },
  attSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  
  // Suggestions
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  suggestText: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  addBtnText: { fontSize: 12, fontWeight: '700' },
  
  // Family cards
  famCard: { width: 100, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginBottom: spacing.sm },
  famName: { ...typography.bodySm, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  famSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  
  // Alerts Modal
  modalScrim: { flex: 1, backgroundColor: colors.scrim },
  alertsSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, padding: spacing.xl, paddingBottom: 40, maxHeight: '70%' },
  alertsHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  alertsTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.lg },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  alertDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { ...typography.body, fontWeight: '700', color: colors.textPrimary },
  alertSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
