import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, Cloud, ShieldCheck, ArrowRight, Plus, AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { Card, ProgressBar, SectionHeader, StatusBadge } from '../../src/components/UI';
import { colors, spacing, radius, shadow } from '../../src/constants/theme';
import { fmtDate, getDocStatus, daysUntil } from '../../src/utils/date';
import { SUGGESTED_DOCS } from '../../src/constants/categories';

function formatBytes(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export default function Home() {
  const { user } = useAuth();
  const { docs, vaultHealth, drive, family, expiringCount } = useVault();
  const router = useRouter();

  const upcoming = docs
    .filter((d) => getDocStatus(d.expiryDate) !== 'valid' && getDocStatus(d.expiryDate) !== 'none')
    .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''))
    .slice(0, 3);

  const have = new Set(docs.map((d) => d.name.toLowerCase()));
  const suggestions = SUGGESTED_DOCS.filter((s) => !have.has(s.toLowerCase())).slice(0, 3);

  const usedPct = drive.total > 0 ? drive.used / drive.total : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.subGreeting}>Your vault is quiet and safe</Text>
          </View>
          <TouchableOpacity testID="notif-btn" style={styles.iconBtn}>
            <Bell color={colors.textPrimary} size={20} strokeWidth={1.6} />
          </TouchableOpacity>
        </View>

        {/* Vault Health */}
        <View style={styles.healthCard} testID="vault-health-card">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShieldCheck color="#fff" size={18} strokeWidth={1.6} />
            <Text style={styles.healthLabel}>Vault Health</Text>
          </View>
          <Text style={styles.healthValue} testID="vault-health-value">{vaultHealth}%</Text>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar value={vaultHealth / 100} color="#9AC5B2" bg="rgba(255,255,255,0.15)" height={6} />
          </View>
          <View style={styles.healthStats}>
            <StatItem label="Documents" value={String(docs.length)} />
            <StatItem label="Expiring" value={String(expiringCount)} />
            <StatItem label="Members" value={String(family.length)} />
          </View>
        </View>

        {/* Drive Storage */}
        <Card style={{ marginTop: spacing.lg }} testID="drive-usage-card">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconTile}><Cloud color={colors.primary} size={18} strokeWidth={1.6} /></View>
              <View>
                <Text style={styles.cardTitle}>Google Drive</Text>
                <Text style={styles.cardSub}>{user?.demo ? 'Demo mode · local storage' : user?.email}</Text>
              </View>
            </View>
            <Text style={styles.pctText}>{Math.round(usedPct * 100)}%</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <ProgressBar value={usedPct} />
            <Text style={styles.storageText}>{formatBytes(drive.used)} of {formatBytes(drive.total)} used</Text>
          </View>
        </Card>

        {/* Expiring */}
        <View style={{ marginTop: spacing.xxl }}>
          <SectionHeader title="Needs attention" action={
            <TouchableOpacity onPress={() => router.push('/(tabs)/docs')} testID="see-all-expiring">
              <Text style={styles.link}>See all</Text>
            </TouchableOpacity>
          } />
          {upcoming.length === 0 ? (
            <Card><Text style={styles.empty}>Everything looks good — no documents expiring soon.</Text></Card>
          ) : (
            upcoming.map((d) => {
              const status = getDocStatus(d.expiryDate);
              const days = daysUntil(d.expiryDate);
              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.attentionRow}
                  onPress={() => router.push(`/document/${d.id}`)}
                  testID={`attention-doc-${d.id}`}
                >
                  <View style={[styles.alertIcon, { backgroundColor: status === 'expired' ? '#F8E3DC' : '#FBF1DE' }]}>
                    <AlertCircle color={status === 'expired' ? colors.expired : '#8E6A20'} size={18} strokeWidth={1.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attName} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.attSub}>
                      {status === 'expired'
                        ? `Expired ${fmtDate(d.expiryDate)}`
                        : `Expires in ${days} day${days === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <StatusBadge status={status} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <View style={{ marginTop: spacing.xxl }}>
            <SectionHeader title="Missing in your vault" />
            <View style={{ gap: spacing.md }}>
              {suggestions.map((s) => (
                <TouchableOpacity key={s} style={styles.suggestionRow} onPress={() => router.push('/upload/type')} testID={`suggest-${s}`}>
                  <Text style={styles.suggestText}>{s}</Text>
                  <View style={styles.addBtn}>
                    <Plus color={colors.primary} size={16} strokeWidth={2} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Family */}
        <View style={{ marginTop: spacing.xxl, marginBottom: 40 }}>
          <SectionHeader title="Family" action={
            <TouchableOpacity onPress={() => router.push('/family')} testID="manage-family-btn">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.link}>Manage</Text>
                <ArrowRight color={colors.primary} size={14} />
              </View>
            </TouchableOpacity>
          } />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {family.map((f) => {
              const count = docs.filter((d) => d.ownerId === f.id).length;
              return (
                <View key={f.id} style={styles.famCard} testID={`family-card-${f.id}`}>
                  {f.avatar ? (
                    <Image source={{ uri: f.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>{f.name[0]}</Text>
                    </View>
                  )}
                  <Text style={styles.famName}>{f.name}</Text>
                  <Text style={styles.famSub}>{count} docs</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  subGreeting: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  healthCard: { backgroundColor: colors.dark, borderRadius: 24, padding: spacing.xl, ...shadow.md },
  healthLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  healthValue: { color: '#fff', fontSize: 52, fontWeight: '800', letterSpacing: -1, marginTop: 6 },
  healthStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' },
  iconTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pctText: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  storageText: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  link: { fontSize: 13, fontWeight: '600', color: colors.primary },
  attentionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: 12 },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  attName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  attSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { color: colors.textSecondary, fontSize: 13 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md },
  suggestText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  addBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  famCard: { width: 110, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, marginBottom: spacing.sm },
  famName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  famSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});
