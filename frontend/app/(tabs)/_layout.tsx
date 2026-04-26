import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Home, Clock, FolderOpen, User, Plus } from 'lucide-react-native';
import { colors, shadow } from '../../src/constants/theme';

function TabBar({ state, navigation }: any) {
  const router = useRouter();
  const icons: Record<string, any> = {
    home: Home,
    timeline: Clock,
    docs: FolderOpen,
    profile: User,
  };
  const labels: Record<string, string> = {
    home: 'Home',
    timeline: 'Timeline',
    docs: 'Docs',
    profile: 'Profile',
  };
  const order = ['home', 'timeline', 'docs', 'profile'];
  return (
    <View style={styles.wrap} testID="bottom-tab-bar">
      <View style={styles.bar}>
        {order.slice(0, 2).map((key) => (
          <TabBtn key={key} tabKey={key} icons={icons} labels={labels} state={state} navigation={navigation} />
        ))}
        <View style={{ width: 64 }} />
        {order.slice(2).map((key) => (
          <TabBtn key={key} tabKey={key} icons={icons} labels={labels} state={state} navigation={navigation} />
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push('/upload/type')}
        style={styles.fab}
        testID="tab-add-fab"
      >
        <Plus color="#fff" size={26} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}

function TabBtn({ tabKey, icons, labels, state, navigation }: any) {
  const Icon = icons[tabKey];
  const route = state.routes.find((r: any) => r.name === tabKey);
  const isFocused = state.routes[state.index].name === tabKey;
  const color = isFocused ? colors.dark : colors.textTertiary;
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate(route.name)}
      style={styles.tab}
      testID={`tab-${tabKey}`}
      activeOpacity={0.7}
    >
      <Icon color={color} size={22} strokeWidth={1.6} />
      <Text style={[styles.label, { color }]}>{labels[tabKey]}</Text>
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
  wrap: { position: 'relative' },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, fontWeight: '600' },
  fab: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
});
