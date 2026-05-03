import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../src/contexts/AuthContext';
import { authService } from '../src/services/authService';
import { theme } from '../src/theme/theme';

export default function LoginScreen() {
  const { signIn, request, clientIdMissing } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiag, setShowDiag] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await signIn();
      if (s) router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🔒</Text>
          </View>
          <Text style={styles.title}>SafeVault</Text>
          <Text style={styles.subtitle}>
            Password-protected files, backed up to your Google Drive.
          </Text>
        </View>

        <View style={styles.bulletList}>
          <Bullet icon="✓" text="AES-256 password-protected ZIPs" />
          <Bullet icon="✓" text="Stored in your own Google Drive" />
          <Bullet icon="✓" text="Openable with any unzipper — no app needed" />
          <Bullet icon="✓" text="Recoverable after reinstall" />
        </View>

        {clientIdMissing && (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Setup required</Text>
            <Text style={styles.warningText}>
              Google OAuth Client ID is missing. See SETUP_OAUTH.md and set{' '}
              EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB in frontend/.env.
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={handleSignIn}
          disabled={!request || loading || clientIdMissing}
          style={({ pressed }) => [
            styles.googleBtn,
            (pressed || loading) && { opacity: 0.85 },
            (!request || clientIdMissing) && { opacity: 0.5 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#202124" />
          ) : (
            <>
              <Image
                source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                style={{ width: 20, height: 20 }}
              />
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.fineprint}>
          We request only the “Drive file” scope — we can only see files this app creates.
        </Text>

        <Pressable onPress={() => setShowDiag(!showDiag)}>
          <Text style={styles.diagToggle}>
            {showDiag ? '▾ Hide' : '▸ Show'} OAuth diagnostic info
          </Text>
        </Pressable>

        {showDiag && (
          <View style={styles.diagBox}>
            <DiagRow label="Platform" value={Platform.OS} />
            <DiagRow label="In Expo Go?" value={authService.isExpoGo ? 'yes' : 'no'} />
            <DiagRow
              label="Client ID"
              value={authService.clientId || '(missing)'}
              copy
            />
            <DiagRow
              label="Redirect URI"
              value={authService.redirectUri}
              copy
            />
            <Text style={styles.diagHint}>
              Add the Redirect URI above to your Google Cloud Console →
              OAuth Client ID → Authorized redirect URIs. Then retry sign-in.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletIcon}>{icon}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function DiagRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <View style={styles.diagRow}>
      <Text style={styles.diagLabel}>{label}</Text>
      <View style={styles.diagValueWrap}>
        <Text style={styles.diagValue} numberOfLines={2} selectable>{value}</Text>
        {copy && (
          <Pressable onPress={onCopy}>
            <Text style={styles.diagCopy}>{copied ? '✓ copied' : 'copy'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  logoWrap: { alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.accent, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { fontSize: 40 },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '700' },
  subtitle: {
    color: theme.colors.textMuted, fontSize: theme.font.md, textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  bulletList: { gap: theme.spacing.sm },
  bulletRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  bulletIcon: {
    color: theme.colors.accent2, fontSize: theme.font.md, width: 20, textAlign: 'center',
  },
  bulletText: { color: theme.colors.text, fontSize: theme.font.md, flexShrink: 1 },
  warning: {
    backgroundColor: '#3a2a10', borderColor: theme.colors.warning, borderWidth: 1,
    padding: theme.spacing.md, borderRadius: theme.radius.md, gap: 4,
  },
  warningTitle: { color: theme.colors.warning, fontWeight: '700' },
  warningText: { color: '#ffdca8', fontSize: theme.font.sm },
  errorBox: {
    backgroundColor: '#3a1222', borderColor: theme.colors.danger, borderWidth: 1,
    padding: theme.spacing.md, borderRadius: theme.radius.md,
  },
  errorText: { color: '#ffb3c1' },
  googleBtn: {
    height: 52, borderRadius: theme.radius.md, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  googleText: { color: '#202124', fontWeight: '600', fontSize: theme.font.md },
  fineprint: {
    color: theme.colors.textMuted, fontSize: theme.font.xs, textAlign: 'center',
  },
  diagToggle: {
    color: theme.colors.textMuted, fontSize: theme.font.xs, textAlign: 'center',
    textDecorationLine: 'underline', marginTop: theme.spacing.sm,
  },
  diagBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border, borderWidth: 1,
    padding: theme.spacing.md, borderRadius: theme.radius.md, gap: theme.spacing.sm,
  },
  diagRow: { gap: 2 },
  diagLabel: { color: theme.colors.textMuted, fontSize: theme.font.xs, textTransform: 'uppercase', letterSpacing: 1 },
  diagValueWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  diagValue: { color: theme.colors.text, fontSize: theme.font.sm, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  diagCopy: { color: theme.colors.accent2, fontSize: theme.font.xs, fontWeight: '700' },
  diagHint: { color: theme.colors.textMuted, fontSize: theme.font.xs, marginTop: theme.spacing.xs, lineHeight: 16 },
});
