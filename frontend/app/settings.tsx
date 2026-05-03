import React from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { usePassword } from '../src/contexts/PasswordContext';
import { passwordService } from '../src/services/passwordService';
import { recoveryService } from '../src/services/recoveryService';
import { theme } from '../src/theme/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { lock } = usePassword();

  const confirm = (title: string, message: string, onYes: () => void) => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`${title}\n\n${message}`)) onYes();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onYes },
    ]);
  };

  const onResetPassword = () =>
    confirm(
      'Reset password?',
      'This forgets the local password verifier. Existing files in Drive will still require the ORIGINAL password to open.',
      async () => {
        await passwordService.clear();
        lock();
        router.replace('/setup-password');
      },
    );

  const onSignOut = () =>
    confirm('Sign out?', 'You will need to sign in with Google again.', async () => {
      lock();
      await signOut();
      await recoveryService.clearCache();
      router.replace('/login');
    });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Signed in as</Text>
          <Text style={styles.cardValue} numberOfLines={1}>{session?.user?.email || '—'}</Text>
          <Text style={styles.cardMeta}>{session?.user?.name || ''}</Text>
        </View>

        <View style={styles.warnBanner}>
          <Text style={styles.warnBannerText}>
            ⚠️ Your files are protected by your password. If you forget it, files cannot be recovered.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>Security</Text>

        <Pressable onPress={() => { lock(); router.replace('/unlock'); }} style={styles.rowBtn}>
          <Text style={styles.rowBtnText}>Lock vault</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable onPress={onResetPassword} style={styles.rowBtn}>
          <Text style={styles.rowBtnText}>Reset local password</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.sectionHeader}>Account</Text>

        <Pressable onPress={onSignOut} style={[styles.rowBtn, styles.danger]}>
          <Text style={[styles.rowBtnText, { color: theme.colors.danger }]}>Sign out</Text>
          <Text style={[styles.chevron, { color: theme.colors.danger }]}>›</Text>
        </Pressable>

        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.card}>
          <Text style={styles.aboutText}>
            SafeVault uses password-protected ZIP files (AES-256) backed up to your Google Drive.{'\n\n'}
            • Only files created by this app are visible to it (drive.file scope).{'\n'}
            • Recovery works by signing in on any device — no local index required.{'\n'}
            • ZIPs can be opened by any standard unzipper with the password.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: 60 },
  backBtn: { paddingVertical: theme.spacing.xs },
  backBtnText: { color: theme.colors.textMuted, fontSize: theme.font.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radius.md, borderColor: theme.colors.border, borderWidth: 1, gap: 2,
  },
  cardLabel: { color: theme.colors.textMuted, fontSize: theme.font.xs },
  cardValue: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  cardMeta: { color: theme.colors.textMuted, fontSize: theme.font.sm },
  warnBanner: {
    backgroundColor: '#2a1f0a', borderColor: theme.colors.warning, borderWidth: 1,
    padding: theme.spacing.md, borderRadius: theme.radius.md,
  },
  warnBannerText: { color: '#ffdca8', fontSize: theme.font.sm },
  sectionHeader: {
    color: theme.colors.textMuted, fontSize: theme.font.xs,
    textTransform: 'uppercase', letterSpacing: 1, marginTop: theme.spacing.sm,
  },
  rowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 56, paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderColor: theme.colors.border, borderWidth: 1,
  },
  rowBtnText: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '500' },
  chevron: { color: theme.colors.textMuted, fontSize: 24 },
  danger: { borderColor: theme.colors.danger },
  aboutText: { color: theme.colors.text, fontSize: theme.font.sm, lineHeight: 20 },
});
