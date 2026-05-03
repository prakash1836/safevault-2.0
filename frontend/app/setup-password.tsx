import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { passwordService } from '../src/services/passwordService';
import { usePassword } from '../src/contexts/PasswordContext';
import { theme } from '../src/theme/theme';

export default function SetupPasswordScreen() {
  const router = useRouter();
  const { setSessionPassword } = usePassword();

  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    setError(null);
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');
    if (!ack) return setError('Please acknowledge the warning.');
    setLoading(true);
    try {
      await passwordService.setPassword(pw);
      setSessionPassword(pw);
      router.replace('/vault');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save password.');
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
          <Text style={styles.title}>Create your vault password</Text>
          <Text style={styles.subtitle}>
            This password encrypts every file you upload. We never store it.
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Important</Text>
            <Text style={styles.warningText}>
              Your files are protected by your password. If you forget it, files cannot be recovered.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={pw}
              onChangeText={setPw}
              secureTextEntry
              placeholder="At least 8 characters"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              value={pw2}
              onChangeText={setPw2}
              secureTextEntry
              placeholder="Re-enter password"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable
            onPress={() => setAck(!ack)}
            style={styles.checkboxRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ack }}
          >
            <View style={[styles.checkbox, ack && styles.checkboxChecked]}>
              {ack && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              I understand that if I lose this password, my files cannot be recovered.
            </Text>
          </Pressable>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={onCreate}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || loading) && { opacity: 0.85 },
            ]}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Create vault</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.md },
  warningBox: {
    backgroundColor: '#3a2a10',
    borderColor: theme.colors.warning,
    borderWidth: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    gap: 4,
  },
  warningTitle: { color: theme.colors.warning, fontWeight: '700' },
  warningText: { color: '#ffdca8' },
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
  checkboxRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkMark: { color: '#fff', fontWeight: '700' },
  checkboxLabel: { color: theme.colors.text, flex: 1, fontSize: theme.font.sm, lineHeight: 20 },
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
});
