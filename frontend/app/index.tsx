import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../src/contexts/AuthContext';
import { usePermissions } from '../src/contexts/PermissionsContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { colors, spacing, typography } from '../src/constants/theme';

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
    <View style={[styles.container, { backgroundColor: t.accentDark }]} testID="splash">
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <View style={styles.iconWrap}>
          <ShieldCheck color="#fff" size={48} strokeWidth={1.5} />
        </View>
        <Text style={styles.brand}>SafeVault</Text>
        <Text style={styles.tagline}>Your encrypted document vault</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: spacing.xl,
  },
  brand: {
    ...typography.h1,
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.sm,
  },
});
