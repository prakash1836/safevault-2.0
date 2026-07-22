import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Clock, FolderOpen, User, Plus } from 'lucide-react-native';
import { colors, shadow, radius } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { hapt } from '../../src/utils/haptics';

const ICONS: Record<string, any> = { home: Home, timeline: Clock, docs: FolderOpen, profile: User };
const LABELS: Record<string, string> = { home: 'Home', timeline: 'Timeline', docs: 'Docs', profile: 'Profile' };
const ORDER = ['home', 'timeline', 'docs', 'profile'];

function TabBar({ state, navigation }: any) {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad, backgroundColor: colors.surface }]} testID="bottom-tab-bar">
      <View style={styles.bar}>
        {ORDER.slice(0, 2).map((key) => (
          <TabBtn key={key} tabKey={key} state={state} navigation={navigation} accent={t.accent} accentDark={t.accentDark} accentSurface={t.accentSurface} />
        ))}
        <View style={{ width: 64 }} />
        {ORDER.slice(2).map((key) => (
          <TabBtn key={key} tabKey={key} state={state} navigation={navigation} accent={t.accent} accentDark={t.accentDark} accentSurface={t.accentSurface} />
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { hapt.medium(); router.push('/upload/type'); }}
        style={[styles.fab, { backgroundColor: t.accentDark, top: -22 }]}
        testID="tab-add-fab"
        accessibilityLabel="Add document"
      >
        <View style={[styles.fabGlow, { backgroundColor: t.accent }]} />
        <Plus color="#fff" size={26} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

function TabBtn({ tabKey, state, navigation, accent, accentDark, accentSurface }: any) {
  const Icon = ICONS[tabKey];
  const route = state.routes.find((r: any) => r.name === tabKey);
  const isFocused = state.routes[state.index].name === tabKey;
  const color = isFocused ? accentDark : colors.textTertiary;

  const pillOpacity = useSharedValue(isFocused ? 1 : 0);
  const scale = useSharedValue(isFocused ? 1 : 0.9);

  React.useEffect(() => {
    pillOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
    scale.value = withSpring(isFocused ? 1 : 0.9, { damping: 16, stiffness: 220 });
  }, [isFocused, pillOpacity, scale]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      onPress={() => { if (!isFocused) hapt.selection(); navigation.navigate(route.name); }}
      style={styles.tab}
      testID={`tab-${tabKey}`}
      activeOpacity={0.7}
      accessibilityLabel={LABELS[tabKey]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: accentSurface }, pillStyle]} pointerEvents="none" />
        <Icon color={color} size={22} strokeWidth={isFocused ? 2 : 1.6} />
      </View>
      <Text style={[styles.label, { color, fontWeight: isFocused ? '700' : '600' }]}>{LABELS[tabKey]}</Text>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="timeline" />
      <Tabs.Screen name="docs" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderTopWidth: 1, borderTopColor: colors.border },
  bar: { flexDirection: 'row', paddingTop: 10 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: { position: 'relative', width: 48, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  label: { fontSize: 11 },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  fabGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    opacity: 0.35,
    transform: [{ scale: 1.15 }],
  },
});
