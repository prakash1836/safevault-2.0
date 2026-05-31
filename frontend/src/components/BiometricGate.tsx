import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { Fingerprint, Lock } from 'lucide-react-native';
import { biometric } from '../services/biometric';
import { useTheme } from '../contexts/ThemeContext';
import { colors, spacing, radius, typography } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

export function BiometricGate({ children }: Props) {
  const t = useTheme();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [attempting, setAttempting] = useState(false);

  useEffect(() => {
    (async () => {
      const isEnabled = await biometric.isEnabled();
      setEnabled(isEnabled);
      if (!isEnabled) {
        setAuthenticated(true);
      } else {
        // Auto-prompt on app start
        await promptAuth();
      }
    })();
  }, []);

  // Re-lock when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && enabled) {
        setAuthenticated(false);
      } else if (state === 'active' && enabled && !authenticated) {
        promptAuth();
      }
    });
    return () => sub.remove();
  }, [enabled, authenticated]);

  const promptAuth = async () => {
    if (attempting) return;
    setAttempting(true);
    const ok = await biometric.authenticate('Unlock SafeVault');
    setAttempting(false);
    if (ok) {
      setAuthenticated(true);
    }
  };

  // Still loading
  if (enabled === null) return null;

  // Locked screen
  if (enabled && !authenticated) {
    return (
      <View style={styles.container} testID="biometric-gate">
        <View style={styles.content}>
          <View style={[styles.iconWrapper, { backgroundColor: t.accentDark }]}>
            <Lock color="#fff" size={48} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>SafeVault is locked</Text>
          <Text style={styles.subtitle}>Authenticate to access your encrypted documents</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: t.accent }]}
            onPress={promptAuth}
            activeOpacity={0.85}
            testID="biometric-unlock-btn"
            disabled={attempting}
          >
            <Fingerprint color="#fff" size={20} strokeWidth={2} />
            <Text style={styles.buttonText}>{attempting ? 'Authenticating...' : 'Unlock'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 360,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.pill,
    minWidth: 200,
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
});
