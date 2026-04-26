import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Clock, FolderOpen, User, Plus } from 'lucide-react-native';
import { colors, shadow } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';

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
          <TabBtn key={key} tabKey={key} state={state} navigation={navigation} accent={t.accentDark} />
        ))}
        <View style={{ width: 64 }} />
        {ORDER.slice(2).map((key) => (
          <TabBtn key={key} tabKey={key} state={state} navigation={navigation} accent={t.accentDark} />
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/upload/type')}
        style={[styles.fab, { backgroundColor: t.accentDark, top: -22 }]}
        testID="tab-add-fab"
      >
        <Plus color="#fff" size={26} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

function TabBtn({ tabKey, state, navigation, accent }: any) {
  const Icon = ICONS[tabKey];
  const route = state.routes.find((r: any) => r.name === tabKey);
  const isFocused = state.routes[state.index].name === tabKey;
  const color = isFocused ? accent : colors.textTertiary;
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate(route.name)}
      style={styles.tab}
      testID={`tab-${tabKey}`}
      activeOpacity={0.7}
    >
      <Icon color={color} size={22} strokeWidth={1.6} />
      <Text style={[styles.label, { color }]}>{LABELS[tabKey]}</Text>
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
  label: { fontSize: 11, fontWeight: '600' },
  fab: { position: 'absolute', alignSelf: 'center', width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', ...shadow.md },
});
