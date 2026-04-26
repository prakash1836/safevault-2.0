import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, Users, ShieldCheck, Cloud, Bell, ChevronRight, Info, Palette, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme, PRESETS } from '../../src/contexts/ThemeContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Card } from '../../src/components/UI';

export default function Profile() {
  const { user, logout } = useAuth();
  const { docs, family } = useVault();
  const { warnings, requestNotifications, requestMedia, notifications, media, drive, setDriveConnected } = usePermissions();
  const t = useTheme();
  const router = useRouter();

  const onLogout = () => {
    Alert.alert('Sign out', 'You will need to sign in again to access your vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  const presetName = t.preset === 'custom' ? 'Custom' : (PRESETS as any)[t.preset]?.name || 'Forest Green';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard} testID="profile-card">
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: t.accent, fontWeight: '800', fontSize: 22 }}>{user?.name?.[0] || 'U'}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.demo && <View style={styles.demoTag}><Text style={styles.demoTagText}>Demo mode</Text></View>}
        </Card>

        {warnings.length > 0 && (
          <View style={styles.warnPanel} testID="profile-warnings">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle color={colors.expired} size={16} />
              <Text style={styles.warnTitle}>Action needed</Text>
            </View>
            {warnings.map((w, i) => <Text key={i} style={styles.warnItem}>· {w}</Text>)}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {!notifications && <SmallBtn label="Enable notifications" color={t.accent} onPress={requestNotifications} testID="enable-notif-btn" />}
              {!media && <SmallBtn label="Allow photos" color={t.accent} onPress={requestMedia} testID="enable-media-btn" />}
              {!drive && <SmallBtn label="Connect Drive" color={t.accent} onPress={() => router.replace('/onboarding')} testID="connect-drive-btn" />}
            </View>
          </View>
        )}

        <View style={styles.stats}>
          <View style={styles.statBox}><Text style={styles.statN}>{docs.length}</Text><Text style={styles.statL}>Documents</Text></View>
          <View style={styles.statBox}><Text style={styles.statN}>{family.length}</Text><Text style={styles.statL}>Members</Text></View>
          <View style={styles.statBox}><Text style={styles.statN}>AES‑256</Text><Text style={styles.statL}>Encryption</Text></View>
        </View>

        <View style={styles.group}>
          <RowItem icon={<Palette color={t.accent} size={18} strokeWidth={1.6} />} label="Theme" value={presetName} onPress={() => router.push('/settings/theme')} testID="profile-theme-row" accent={t.accentSurface} />
          <RowItem icon={<Users color={t.accent} size={18} strokeWidth={1.6} />} label="Family Members" onPress={() => router.push('/family')} testID="profile-family-row" accent={t.accentSurface} />
          <RowItem icon={<Cloud color={t.accent} size={18} strokeWidth={1.6} />} label={drive ? 'Google Drive · Connected' : 'Connect Google Drive'} onPress={() => router.replace('/onboarding')} testID="profile-drive-row" accent={t.accentSurface} />
          <RowItem icon={<Bell color={t.accent} size={18} strokeWidth={1.6} />} label="Reminder preferences" onPress={() => Alert.alert('Reminders', 'Each document can have 30‑day, 7‑day and 1‑day reminders. Configure per document.')} testID="profile-reminders-row" accent={t.accentSurface} />
          <RowItem icon={<ShieldCheck color={t.accent} size={18} strokeWidth={1.6} />} label="Encryption & Security" onPress={() => Alert.alert('Security', 'Files are encrypted with AES‑256 using a key derived from your identity and a device salt. The key is stored in the OS secure enclave.')} testID="profile-security-row" accent={t.accentSurface} />
          <RowItem icon={<Info color={t.accent} size={18} strokeWidth={1.6} />} label="About SafeVault" onPress={() => Alert.alert('SafeVault', 'Zero‑server, client‑encrypted document vault. Your data stays yours.')} testID="profile-about-row" accent={t.accentSurface} last />
        </View>

        <TouchableOpacity style={styles.logout} onPress={onLogout} testID="profile-logout-btn">
          <LogOut color={colors.overdue} size={18} strokeWidth={1.6} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SmallBtn({ label, color, onPress, testID }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.smallBtn, { borderColor: color }]} testID={testID}>
      <Text style={[styles.smallBtnTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RowItem({ icon, label, value, onPress, testID, accent, last }: any) {
  return (
    <TouchableOpacity style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <View style={[styles.rowIcon, { backgroundColor: accent }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      <ChevronRight color={colors.textTertiary} size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: 140 },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md },
  name: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  demoTag: { marginTop: spacing.md, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#FBF1DE' },
  demoTagText: { color: '#8E6A20', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  warnPanel: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: '#F8E3DC', borderWidth: 1, borderColor: '#F3D8D0' },
  warnTitle: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  warnItem: { fontSize: 12, color: colors.textPrimary, marginTop: 2 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5 },
  smallBtnTxt: { fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  statN: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statL: { fontSize: 11, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  group: { marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowValue: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: spacing.xl, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: '#F3D8D0', backgroundColor: '#FDF4F1' },
  logoutText: { color: colors.overdue, fontSize: 14, fontWeight: '700' },
});
