import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, Users, ShieldCheck, Cloud, Bell, ChevronRight, Info } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useVault } from '../../src/contexts/VaultContext';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Card } from '../../src/components/UI';

export default function Profile() {
  const { user, logout } = useAuth();
  const { docs, family } = useVault();
  const router = useRouter();

  const onLogout = () => {
    Alert.alert('Sign out', 'You will need to sign in again to access your vault.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard} testID="profile-card">
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 22 }}>{user?.name?.[0] || 'U'}</Text>
            </View>
          )}
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.demo && (
            <View style={styles.demoTag}><Text style={styles.demoTagText}>Demo mode</Text></View>
          )}
        </Card>

        <View style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{docs.length}</Text>
            <Text style={styles.statL}>Documents</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statN}>{family.length}</Text>
            <Text style={styles.statL}>Members</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statN}>AES‑256</Text>
            <Text style={styles.statL}>Encryption</Text>
          </View>
        </View>

        <View style={styles.group}>
          <RowItem
            icon={<Users color={colors.primary} size={18} strokeWidth={1.6} />}
            label="Family Members"
            onPress={() => router.push('/family')}
            testID="profile-family-row"
          />
          <RowItem
            icon={<ShieldCheck color={colors.primary} size={18} strokeWidth={1.6} />}
            label="Encryption & Security"
            onPress={() => Alert.alert('Security', 'Your files are encrypted with AES‑256 using a key derived from your identity and device salt. The key is stored in the OS‑level secure enclave.')}
            testID="profile-security-row"
          />
          <RowItem
            icon={<Cloud color={colors.primary} size={18} strokeWidth={1.6} />}
            label={user?.demo ? 'Connect Google Drive' : 'Google Drive'}
            onPress={() => {}}
            testID="profile-drive-row"
          />
          <RowItem
            icon={<Bell color={colors.primary} size={18} strokeWidth={1.6} />}
            label="Reminder preferences"
            onPress={() => Alert.alert('Reminders', 'Each document can have 30-day, 7-day and 1-day reminders. Configure per document.')}
            testID="profile-reminders-row"
          />
          <RowItem
            icon={<Info color={colors.primary} size={18} strokeWidth={1.6} />}
            label="About SafeVault"
            onPress={() => Alert.alert('SafeVault', 'Zero-server, client-encrypted document vault. Your data stays yours.')}
            testID="profile-about-row"
          />
        </View>

        <TouchableOpacity style={styles.logout} onPress={onLogout} testID="profile-logout-btn">
          <LogOut color={colors.overdue} size={18} strokeWidth={1.6} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowItem({ icon, label, onPress, testID }: { icon: React.ReactNode; label: string; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7} testID={testID}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <ChevronRight color={colors.textTertiary} size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xxl, paddingBottom: 120 },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing.md },
  name: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  demoTag: { marginTop: spacing.md, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#FBF1DE' },
  demoTagText: { color: '#8E6A20', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  statN: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statL: { fontSize: 11, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  group: { marginTop: spacing.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: spacing.xl, paddingVertical: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: '#F3D8D0', backgroundColor: '#FDF4F1' },
  logoutText: { color: colors.overdue, fontSize: 14, fontWeight: '700' },
});
