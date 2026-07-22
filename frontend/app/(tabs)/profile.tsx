import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, Users, ShieldCheck, Cloud, Bell, ChevronRight, Info, Palette, AlertTriangle } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { useTheme, PRESETS } from '../../src/contexts/ThemeContext';
import { usePermissions } from '../../src/contexts/PermissionsContext';
import { colors, spacing, radius, shadow, typography } from '../../src/constants/theme';
import { Card, PrimaryButton } from '../../src/components/UI';
import { PressableScale } from '../../src/components/PressableScale';
import { hapt } from '../../src/utils/haptics';

export default function Profile() {
  const { user, logout } = useAuth();
  const { docs, family } = useVault();
  const { warnings, requestNotifications, requestMedia, notifications, media, drive, setDriveConnected } = usePermissions();
  const t = useTheme();
  const router = useRouter();

  const onLogout = () => {
    hapt.warning();
    Alert.alert('Sign out', 'You will need to sign in again to access your vault.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { hapt.medium(); await logout(); router.replace('/login'); } },
    ]);
  };

  const presetName = t.preset === 'custom' ? 'Custom' : (PRESETS as any)[t.preset]?.name || 'Trust Blue';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={styles.profileCard} variant="elevated" testID="profile-card">
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: t.accentSurface, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: t.accent, fontWeight: '800', fontSize: 24 }}>{user?.name?.[0] || 'U'}</Text>
              </View>
            )}
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            {user?.demo && (
              <View style={[styles.demoTag, { backgroundColor: colors.expiringSurface }]}>
                <Text style={styles.demoTagText}>Demo mode</Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* Warning Panel */}
        {warnings.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.warnPanel} testID="profile-warnings">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <AlertTriangle color={colors.expired} size={16} />
              <Text style={styles.warnTitle}>Action needed</Text>
            </View>
            {warnings.map((w, i) => <Text key={i} style={styles.warnItem}>· {w}</Text>)}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
              {!notifications && (
                <PressableScale onPress={() => { hapt.light(); requestNotifications(); }} testID="enable-notif-btn" haptic="none">
                  <View style={[styles.smallBtn, { borderColor: t.accent }]}>
                    <Text style={[styles.smallBtnTxt, { color: t.accent }]}>Enable notifications</Text>
                  </View>
                </PressableScale>
              )}
              {!media && (
                <PressableScale onPress={() => { hapt.light(); requestMedia(); }} testID="enable-media-btn" haptic="none">
                  <View style={[styles.smallBtn, { borderColor: t.accent }]}>
                    <Text style={[styles.smallBtnTxt, { color: t.accent }]}>Allow photos</Text>
                  </View>
                </PressableScale>
              )}
              {!drive && (
                <PressableScale onPress={() => router.replace('/onboarding')} testID="connect-drive-btn" haptic="light">
                  <View style={[styles.smallBtn, { borderColor: t.accent }]}>
                    <Text style={[styles.smallBtnTxt, { color: t.accent }]}>Connect Drive</Text>
                  </View>
                </PressableScale>
              )}
            </View>
          </Animated.View>
        )}

        {/* Stats Row */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{docs.length}</Text>
            <Text style={[styles.statL,{fontSize: 10}]}>Documents</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{family.length}</Text>
            <Text style={[styles.statL,{fontSize: 10}]}>Members</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statN, { fontSize: 14, marginTop: 2 }]}>AES‑256</Text>
            <Text style={[styles.statL,{fontSize: 10}]}>Encryption</Text>
          </View>
        </Animated.View>

        {/* Settings Group */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.group}>
          <RowItem icon={<Palette color={t.accent} size={18} strokeWidth={1.6} />} label="Theme" value={presetName} onPress={() => router.push('/settings/theme')} testID="profile-theme-row" accent={t.accentSurface} />
          <RowItem icon={<Users color={t.accent} size={18} strokeWidth={1.6} />} label="Family Members" onPress={() => router.push('/family')} testID="profile-family-row" accent={t.accentSurface} />
          <RowItem icon={<Cloud color={t.accent} size={18} strokeWidth={1.6} />} label={drive ? 'Google Drive · Connected' : 'Connect Google Drive'} onPress={() => router.replace('/onboarding')} testID="profile-drive-row" accent={t.accentSurface} />
          <RowItem icon={<Bell color={t.accent} size={18} strokeWidth={1.6} />} label="Reminder preferences" onPress={() => Alert.alert('Reminders', 'Each document can have 30‑day, 7‑day and 1‑day reminders. Configure per document.')} testID="profile-reminders-row" accent={t.accentSurface} />
          <RowItem icon={<ShieldCheck color={t.accent} size={18} strokeWidth={1.6} />} label="Encryption & Security" onPress={() => Alert.alert('Security', 'Files are encrypted with AES‑256 using a key derived from your identity and a device salt. The key is stored in the OS secure enclave.')} testID="profile-security-row" accent={t.accentSurface} />
          <RowItem icon={<Info color={t.accent} size={18} strokeWidth={1.6} />} label="About SafeVault" onPress={() => Alert.alert('SafeVault', 'Zero‑server, client‑encrypted document vault. Your data stays yours.')} testID="profile-about-row" accent={t.accentSurface} last />
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)} style={{ marginTop: spacing.xl }}>
          <PressableScale onPress={onLogout} testID="profile-logout-btn" haptic="none">
            <View style={styles.logout}>
              <LogOut color={colors.overdue} size={18} strokeWidth={1.6} />
              <Text style={styles.logoutText}>Sign out</Text>
            </View>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowItem({ icon, label, value, onPress, testID, accent, last }: any) {
  return (
    <PressableScale onPress={onPress} testID={testID} haptic="light">
      <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={[styles.rowIcon, { backgroundColor: accent }]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          {value && <Text style={styles.rowValue}>{value}</Text>}
        </View>
        <ChevronRight color={colors.textTertiary} size={18} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: 140 },
  
  // Profile card
  profileCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: { width: 88, height: 88, borderRadius: 44, marginBottom: spacing.md },
  name: { ...typography.h2, color: colors.textPrimary },
  email: { ...typography.bodySm, color: colors.textSecondary, marginTop: 4 },
  demoTag: { marginTop: spacing.md, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  demoTagText: { color: '#8E6A20', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  
  // Warning panel
  warnPanel: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.expiredSurface, borderWidth: 1, borderColor: colors.overdueSurface },
  warnTitle: { ...typography.bodySm, fontWeight: '800', color: colors.textPrimary },
  warnItem: { ...typography.caption, color: colors.textPrimary, marginTop: 2 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5 },
  smallBtnTxt: { fontSize: 11, fontWeight: '700' },
  
  // Stats row
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', ...shadow.xs },
  statN: { ...typography.h2, color: colors.textPrimary },
  statL: { ...typography.caption, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  
  // Settings group
  group: { marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden', ...shadow.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 15, gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { ...typography.body, fontWeight: '600', color: colors.textPrimary },
  rowValue: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  
  // Logout button
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 15, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.overdueSurface, backgroundColor: colors.expiredSurface },
  logoutText: { color: colors.overdue, ...typography.body, fontWeight: '700' },
});
