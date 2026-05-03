import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { colors } from '../src/constants/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const { onboarded } = usePermissions();
  const t = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!onboarded) router.replace('/onboarding');
    else router.replace('/(tabs)/home');
  }, [loading, user, onboarded, router]);

  return (
    <View style={styles.container} testID="splash">
      <ActivityIndicator color={t.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
