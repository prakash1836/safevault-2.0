import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { passwordService } from '../src/services/passwordService';
import { usePassword } from '../src/contexts/PasswordContext';
import { theme } from '../src/theme/theme';

export default function Index() {
  const { session, loading } = useAuth();
  const { sessionPassword } = usePassword();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    (async () => {
      if (!session) {
        router.replace('/login');
        return;
      }
      const hasPw = await passwordService.hasPassword();
      if (!hasPw) {
        router.replace('/setup-password');
        return;
      }
      if (!sessionPassword) {
        router.replace('/unlock');
        return;
      }
      router.replace('/vault');
    })();
  }, [loading, session, sessionPassword, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
