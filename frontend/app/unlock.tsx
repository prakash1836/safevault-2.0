import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { passwordService } from '../src/services/passwordService';
import { usePassword } from '../src/contexts/PasswordContext';
import { useAuth } from '../src/contexts/AuthContext';
import { theme } from '../src/theme/theme';

export default function UnlockScreen() {
  const router = useRouter();
  const { setSessionPassword } = usePassword();
  const { session, signOut } = useAuth();

  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onUnlock = async () => {
    setError(null);
    if (!pw) return setError('Enter your password.');
    setLoading(true);
    try {
      const ok = await passwordService.verifyPassword(pw);
      if (!ok) {
        setError('Incorrect password.');
        return;
      }
      setSessionPassword(pw);
      router.replace('/vault');
    } catch (e: any) {
      setError(e?.message ?? 'Unlock failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Unlock vault</Text>
            {session?.user && (
              <Text style={styles.subtitle}>Signed in as {session.user.email}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={pw}
              onChangeText={setPw}
              secureTextEntry
              placeholder="Your vault password"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={onUnlock}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={onUnlock}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || loading) && { opacity: 0.85 },
            ]}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Unlock</Text>}
          </Pressable>

          <Pressable onPress={async () => { await signOut(); router.replace('/login'); }}>
            <Text style={styles.secondaryLink}>Sign out</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md, flexGrow: 1, justifyContent: 'center' },
  header: { gap: 4, marginBottom: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.sm },
  field: { gap: theme.spacing.xs },
  label: { color: theme.colors.textMuted, fontSize: theme.font.sm },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    color: theme.colors.text,
    fontSize: theme.font.md,
  },
  errorText: { color: theme.colors.danger },
  primaryBtn: {
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.font.md },
  secondaryLink: {
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    textDecorationLine: 'underline',
  },
});
