import React, { useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Modal, 
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  Bell, 
  Cloud, 
  ShieldCheck, 
  ArrowRight, 
  Plus, 
  AlertCircle, 
  AlertTriangle,
  FileText,
  Users,
  Clock,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  HardDrive,
} from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { ProgressBar, SectionHeader, StatusBadge } from '../../src/components/UI';
import { colors, spacing, radius, shadow } from '../../src/constants/theme';
import { fmtDate, getDocStatus, daysUntil } from '../../src/utils/date';
import { SUGGESTED_DOCS } from '../../src/constants/categories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

// Premium animated gradient background for vault health
function VaultHealthCard({ vaultHealth, docs, expiringCount, family, accentDark, accent }: any) {
  const healthStatus = vaultHealth >= 80 ? 'excellent' : vaultHealth >= 60 ? 'good' : vaultHealth >= 40 ? 'fair' : 'needs_attention';
  const statusConfig = {
    excellent: { label: 'Excellent', icon: CheckCircle2, color: '#4ADE80' },
    good: { label: 'Good', icon: ShieldCheck, color: '#60A5FA' },
    fair: { label: 'Fair', icon: Clock, color: '#FBBF24' },
    needs_attention: { label: 'Needs Attention', icon: AlertTriangle, color: '#F87171' },
  };
  const config = statusConfig[healthStatus];
  const StatusIcon = config.icon;

  return (
    <View style={[styles.healthCard, { backgroundColor: accentDark }]} testID="vault-health-card">
      {/* Decorative elements */}
      <View style={[styles.healthDecor1, { backgroundColor: accent + '15' }]} />
      <View style={[styles.healthDecor2, { backgroundColor: accent + '10' }]} />
      <View style={[styles.healthDecor3, { backgroundColor: accent + '08' }]} />
      
      {/* Header */}
      <View style={styles.healthHeader}>
        <View style={styles.healthHeaderLeft}>
          <View style={styles.healthIconContainer}>
            <ShieldCheck color="#fff" size={22} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.healthLabel}>Vault Health</Text>
            <View style={styles.healthStatusRow}>
              <StatusIcon color={config.color} size={12} strokeWidth={2} />
              <Text style={[styles.healthStatusText, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Main Value */}
      <View style={styles.healthValueContainer}>
        <Text style={styles.healthValue} testID="vault-health-value">{vaultHealth}</Text>
        <Text style={styles.healthPercent}>%</Text>
      </View>

      {/* Progress */}
      <View style={styles.healthProgressContainer}>
        <View style={styles.healthProgressBg}>
          <View style={[styles.healthProgressFill, { width: `${vaultHealth}%`, backgroundColor: config.color }]} />
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.healthStatsGrid}>
        <StatCard 
          icon={<FileText color="rgba(255,255,255,0.9)" size={16} strokeWidth={1.8} />} 
          value={docs.length} 
          label="Documents" 
          accentColor={accent}
        />
        <View style={styles.statDivider} />
        <StatCard 
          icon={<Clock color={expiringCount > 0 ? '#FBBF24' : 'rgba(255,255,255,0.9)'} size={16} strokeWidth={1.8} />} 
          value={expiringCount} 
          label="Expiring" 
          highlight={expiringCount > 0}
          accentColor={accent}
        />
        <View style={styles.statDivider} />
        <StatCard 
          icon={<Users color="rgba(255,255,255,0.9)" size={16} strokeWidth={1.8} />} 
          value={family.length} 
          label="Members" 
          accentColor={accent}
        />
      </View>
    </View>
  );
}

function StatCard({ icon, value, label, highlight, accentColor }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, highlight && { color: '#FBBF24' }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Premium Drive Usage Card
function DriveUsageCard({ user, drive, usedPct, driveLow, accent, accentSurface }: any) {
  return (
    <View style={styles.driveCard} testID="drive-usage-card">
      <View style={styles.driveHeader}>
        <View style={styles.driveLeft}>
          <View style={[styles.driveIconWrap, { backgroundColor: accentSurface }]}>
            <HardDrive color={accent} size={20} strokeWidth={1.6} />
          </View>
          <View style={styles.driveInfo}>
            <Text style={styles.driveTitle}>Cloud Storage</Text>
            <Text style={styles.driveSub}>
              {user?.demo ? 'Demo mode · local storage' : 'Google Drive'}
            </Text>
          </View>
        </View>
        <View style={styles.drivePercentContainer}>
          <Text style={[styles.drivePercent, driveLow && styles.drivePercentWarning]}>
            {Math.round(usedPct * 100)}%
          </Text>
          <Text style={styles.drivePercentLabel}>used</Text>
        </View>
      </View>
      
      <View style={styles.driveProgressSection}>
        <View style={styles.driveProgressTrack}>
          <View 
            style={[
              styles.driveProgressFill, 
              { 
                width: `${usedPct * 100}%`,
                backgroundColor: driveLow ? colors.expired : accent 
              }
            ]} 
          />
        </View>
        <View style={styles.driveStorageInfo}>
          <Text style={styles.driveStorageText}>
            <Text style={styles.driveStorageUsed}>{formatBytes(drive.used)}</Text>
            {' of '}
            <Text style={styles.driveStorageTotal}>{formatBytes(drive.total)}</Text>
          </Text>
          {driveLow && (
            <View style={styles.driveLowBadge}>
              <AlertTriangle color={colors.expired} size={10} strokeWidth={2} />
              <Text style={styles.driveLowText}>Low</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// Premium Alert Card
function AlertCard({ doc, status, days, onPress, accent }: any) {
  const isExpired = status === 'expired';
  const urgencyColor = isExpired ? colors.expired : colors.expiringSoon;
  const urgencyBg = isExpired ? '#FEE2E2' : '#FEF3C7';
  
  return (
    <TouchableOpacity 
      style={styles.alertCard} 
      onPress={onPress} 
      activeOpacity={0.7}
      testID={`attention-doc-${doc.id}`}
    >
      <View style={[styles.alertIconContainer, { backgroundColor: urgencyBg }]}>
        <AlertCircle color={urgencyColor} size={20} strokeWidth={1.8} />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertName} numberOfLines={1}>{doc.name}</Text>
        <Text style={styles.alertDetail}>
          {isExpired 
            ? `Expired ${fmtDate(doc.expiryDate)}` 
            : `${days} day${days === 1 ? '' : 's'} remaining`
          }
        </Text>
      </View>
      <View style={styles.alertRight}>
        <StatusBadge status={status} />
        <ChevronRight color={colors.textTertiary} size={16} style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

// Premium Family Card
function FamilyCard({ member, docCount, onPress, accent, accentSurface }: any) {
  return (
    <TouchableOpacity 
      style={styles.familyCard} 
      onPress={onPress}
      activeOpacity={0.8}
      testID={`family-card-${member.id}`}
    >
      {member.avatar ? (
        <Image source={{ uri: member.avatar }} style={styles.familyAvatar} />
      ) : (
        <View style={[styles.familyAvatarPlaceholder, { backgroundColor: accentSurface }]}>
          <Text style={[styles.familyAvatarLetter, { color: accent }]}>{member.name[0]}</Text>
        </View>
      )}
      <View style={styles.familyInfo}>
        <Text style={styles.familyName} numberOfLines={1}>{member.name}</Text>
        <View style={styles.familyDocBadge}>
          <FileText color={colors.textTertiary} size={10} strokeWidth={2} />
          <Text style={styles.familyDocCount}>{docCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Empty State Component
function EmptyState({ icon: Icon, title, subtitle, accent }: any) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIconWrap, { backgroundColor: colors.elevated }]}>
        <Icon color={colors.textTertiary} size={24} strokeWidth={1.6} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// Suggestion Card
function SuggestionCard({ name, onPress, accent, accentSurface }: any) {
  return (
    <TouchableOpacity 
      style={styles.suggestionCard} 
      onPress={onPress}
      activeOpacity={0.7}
      testID={`suggest-${name}`}
    >
      <View style={styles.suggestionLeft}>
        <View style={[styles.suggestionIcon, { backgroundColor: colors.elevated }]}>
          <FileText color={colors.textSecondary} size={16} strokeWidth={1.6} />
        </View>
        <Text style={styles.suggestionText}>{name}</Text>
      </View>
      <View style={[styles.suggestionBtn, { backgroundColor: accentSurface }]}>
        <Plus color={accent} size={14} strokeWidth={2.5} />
        <Text style={[styles.suggestionBtnText, { color: accent }]}>Add</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { docs, vaultHealth, drive, family, expiringCount, loading } = useVault();
  const { warnings } = usePermissions();
  const t = useTheme();
  const router = useRouter();
  const [alertsOpen, setAlertsOpen] = useState(false);

  const upcoming = docs
    .filter((d) => { const s = getDocStatus(d.expiryDate); return s === 'expiring_soon' || s === 'expired'; })
    .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
    .slice(0, 3);

  const have = new Set(docs.map((d) => d.name.toLowerCase()));
  const suggestions = SUGGESTED_DOCS.filter((s) => !have.has(s.toLowerCase())).slice(0, 3);
  const usedPct = drive.total > 0 ? drive.used / drive.total : 0;
  const driveLow = usedPct > 0.85;

  // Build alert feed with priority sorting
  const alerts = useMemo(() => {
    const arr: { id: string; kind: 'warn' | 'danger' | 'info'; title: string; sub?: string; priority: number }[] = [];
    docs.forEach((d) => {
      const s = getDocStatus(d.expiryDate);
      if (s === 'expired') arr.push({ id: 'exp_' + d.id, kind: 'danger', title: `${d.name} expired`, sub: fmtDate(d.expiryDate), priority: 1 });
      else if (s === 'expiring_soon') arr.push({ id: 'exs_' + d.id, kind: 'warn', title: `${d.name} expiring soon`, sub: `In ${daysUntil(d.expiryDate)} days`, priority: 2 });
    });
    if (driveLow) arr.push({ id: 'drv', kind: 'warn', title: 'Storage almost full', sub: `${Math.round(usedPct * 100)}% used`, priority: 3 });
    warnings.forEach((w, i) => arr.push({ id: 'pw_' + i, kind: 'info', title: w, priority: 4 }));
    return arr.sort((a, b) => a.priority - b.priority);
  }, [docs, driveLow, usedPct, warnings]);

  const getGreetingMessage = () => {
    if (alerts.filter(a => a.kind === 'danger').length > 0) return 'Some documents need attention';
    if (vaultHealth >= 80) return 'Your vault is secure';
    if (vaultHealth >= 60) return 'Your vault is in good shape';
    return 'Let\'s organize your vault';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.subGreeting}>{getGreetingMessage()}</Text>
          </View>
          <TouchableOpacity 
            testID="notif-btn" 
            style={[styles.notifBtn, { borderColor: colors.border }]} 
            onPress={() => setAlertsOpen(true)}
            activeOpacity={0.7}
          >
            <Bell color={colors.textPrimary} size={20} strokeWidth={1.6} />
            {alerts.length > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{alerts.length > 9 ? '9+' : alerts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Vault Health Card */}
        <VaultHealthCard 
          vaultHealth={vaultHealth}
          docs={docs}
          expiringCount={expiringCount}
          family={family}
          accentDark={t.accentDark}
          accent={t.accent}
        />

        {/* Drive Usage */}
        <DriveUsageCard 
          user={user}
          drive={drive}
          usedPct={usedPct}
          driveLow={driveLow}
          accent={t.accent}
          accentSurface={t.accentSurface}
        />

        {/* Permission Warnings */}
        {warnings.length > 0 && (
          <TouchableOpacity 
            style={styles.permissionBanner} 
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            testID="permission-warnings"
          >
            <View style={styles.permissionLeft}>
              <View style={styles.permissionIconWrap}>
                <AlertTriangle color={colors.expired} size={16} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.permissionTitle}>
                  {warnings.length} permission{warnings.length > 1 ? 's' : ''} needed
                </Text>
                <Text style={styles.permissionSub}>Tap to fix in settings</Text>
              </View>
            </View>
            <ChevronRight color={colors.expired} size={18} />
          </TouchableOpacity>
        )}

        {/* Needs Attention Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionDot, { backgroundColor: upcoming.length > 0 ? colors.expiringSoon : t.accent }]} />
              <Text style={styles.sectionTitle}>Needs Attention</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/docs')} 
              testID="see-all-expiring"
              style={styles.seeAllBtn}
            >
              <Text style={[styles.seeAllText, { color: t.accent }]}>See all</Text>
              <ChevronRight color={t.accent} size={14} />
            </TouchableOpacity>
          </View>
          
          {upcoming.length === 0 ? (
            <EmptyState 
              icon={CheckCircle2}
              title="All clear!"
              subtitle="No documents expiring soon"
              accent={t.accent}
            />
          ) : (
            <View style={styles.alertsList}>
              {upcoming.map((d) => {
                const status = getDocStatus(d.expiryDate);
                const days = daysUntil(d.expiryDate);
                return (
                  <AlertCard 
                    key={d.id}
                    doc={d}
                    status={status}
                    days={days}
                    onPress={() => router.push(`/document/${d.id}`)}
                    accent={t.accent}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* Suggestions Section */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Sparkles color={t.accent} size={16} strokeWidth={2} />
                <Text style={styles.sectionTitle}>Recommended</Text>
              </View>
            </View>
            <View style={styles.suggestionsList}>
              {suggestions.map((s) => (
                <SuggestionCard 
                  key={s}
                  name={s}
                  onPress={() => router.push('/upload/type')}
                  accent={t.accent}
                  accentSurface={t.accentSurface}
                />
              ))}
            </View>
          </View>
        )}

        {/* Family Section */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Users color={t.accent} size={16} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Family</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/family')} 
              testID="manage-family-btn"
              style={styles.seeAllBtn}
            >
              <Text style={[styles.seeAllText, { color: t.accent }]}>Manage</Text>
              <ChevronRight color={t.accent} size={14} />
            </TouchableOpacity>
          </View>
          
          {family.length === 0 ? (
            <EmptyState 
              icon={Users}
              title="No family members"
              subtitle="Add family to organize docs"
              accent={t.accent}
            />
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.familyScroll}
            >
              {family.map((f) => {
                const count = docs.filter((d) => d.ownerId === f.id).length;
                return (
                  <FamilyCard 
                    key={f.id}
                    member={f}
                    docCount={count}
                    onPress={() => router.push({ pathname: '/family', params: { focus: f.id } })}
                    accent={t.accent}
                    accentSurface={t.accentSurface}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* Alerts Modal */}
      <Modal visible={alertsOpen} animationType="slide" transparent onRequestClose={() => setAlertsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAlertsOpen(false)} />
        <View style={styles.alertsModal} testID="alerts-sheet">
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={[styles.alertCountBadge, { backgroundColor: t.accentSurface }]}>
              <Text style={[styles.alertCountText, { color: t.accent }]}>{alerts.length}</Text>
            </View>
          </View>
          
          {alerts.length === 0 ? (
            <View style={styles.modalEmpty}>
              <View style={[styles.modalEmptyIcon, { backgroundColor: t.accentSurface }]}>
                <CheckCircle2 color={t.accent} size={32} strokeWidth={1.6} />
              </View>
              <Text style={styles.modalEmptyTitle}>All caught up!</Text>
              <Text style={styles.modalEmptySubtitle}>No pending notifications</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {alerts.map((a, index) => {
                const isLast = index === alerts.length - 1;
                const tone = a.kind === 'danger' ? colors.expired : a.kind === 'warn' ? colors.expiringSoon : t.accent;
                const bg = a.kind === 'danger' ? '#FEE2E2' : a.kind === 'warn' ? '#FEF3C7' : t.accentSurface;
                return (
                  <View key={a.id} style={[styles.modalAlertRow, !isLast && styles.modalAlertBorder]}>
                    <View style={[styles.modalAlertIcon, { backgroundColor: bg }]}>
                      <AlertCircle color={tone} size={18} strokeWidth={1.8} />
                    </View>
                    <View style={styles.modalAlertContent}>
                      <Text style={styles.modalAlertTitle}>{a.title}</Text>
                      {a.sub && <Text style={styles.modalAlertSub}>{a.sub}</Text>}
                    </View>
                    <View style={[styles.priorityDot, { backgroundColor: tone }]} />
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

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: colors.bg,
  },
  scroll: { 
    paddingHorizontal: spacing.xl, 
    paddingTop: spacing.lg, 
    paddingBottom: 120,
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: spacing.xl,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: colors.textPrimary, 
    letterSpacing: -0.5,
  },
  subGreeting: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    marginTop: 4,
    fontWeight: '500',
  },
  notifBtn: { 
    width: 46, 
    height: 46, 
    borderRadius: 23, 
    backgroundColor: colors.surface, 
    borderWidth: 1.5,
    alignItems: 'center', 
    justifyContent: 'center',
    ...shadow.sm,
  },
  notifBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    minWidth: 20, 
    height: 20, 
    paddingHorizontal: 6, 
    borderRadius: 10, 
    backgroundColor: colors.expired,
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.bg,
  },
  notifBadgeText: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '800',
  },

  // Vault Health Card
  healthCard: { 
    borderRadius: 28, 
    padding: spacing.xl,
    paddingVertical: spacing.xxl,
    overflow: 'hidden',
    position: 'relative',
    ...shadow.md,
  },
  healthDecor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -80,
    right: -60,
  },
  healthDecor2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -40,
    right: 40,
  },
  healthDecor3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: 40,
    left: -40,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  healthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthLabel: { 
    color: 'rgba(255,255,255,0.85)', 
    fontSize: 14, 
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  healthStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  healthStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  healthValueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  healthValue: { 
    color: '#fff', 
    fontSize: 64, 
    fontWeight: '800', 
    letterSpacing: -2,
    lineHeight: 64,
  },
  healthPercent: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 2,
  },
  healthProgressContainer: {
    marginBottom: spacing.xl,
  },
  healthProgressBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  healthProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    padding: spacing.md,
    paddingVertical: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: { 
    color: 'rgba(255,255,255,0.6)', 
    fontSize: 10, 
    marginTop: 2, 
    letterSpacing: 0.5, 
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // Drive Card
  driveCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  driveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  driveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driveIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveInfo: {
    gap: 2,
  },
  driveTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  driveSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  drivePercentContainer: {
    alignItems: 'flex-end',
  },
  drivePercent: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  drivePercentWarning: {
    color: colors.expired,
  },
  drivePercentLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  driveProgressSection: {
    gap: spacing.sm,
  },
  driveProgressTrack: {
    height: 6,
    backgroundColor: colors.elevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  driveProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  driveStorageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driveStorageText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  driveStorageUsed: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  driveStorageTotal: {
    fontWeight: '500',
  },
  driveLowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  driveLowText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.expired,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Permission Banner
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  permissionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  permissionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.expired,
  },
  permissionSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
  },

  // Section
  section: {
    marginTop: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Alert Cards
  alertsList: {
    gap: spacing.sm,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  alertIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  alertDetail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alertRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.xl,
    paddingVertical: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Suggestions
  suggestionsList: {
    gap: spacing.sm,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  suggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  suggestionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Family
  familyScroll: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  familyCard: {
    width: 100,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  familyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: spacing.sm,
  },
  familyAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  familyAvatarLetter: {
    fontSize: 20,
    fontWeight: '700',
  },
  familyInfo: {
    alignItems: 'center',
    gap: 4,
  },
  familyName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  familyDocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  familyDocCount: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  alertsModal: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  alertCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  alertCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  modalEmptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  modalEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalEmptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  modalAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: spacing.md,
  },
  modalAlertBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalAlertIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAlertContent: {
    flex: 1,
  },
  modalAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalAlertSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
