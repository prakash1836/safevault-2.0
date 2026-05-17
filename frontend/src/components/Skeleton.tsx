import React, { useEffect } from 'react';
import { View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolateColor } from 'react-native-reanimated';
import { colors, radius, spacing } from '../constants/theme';

interface BoxProps {
  width?: number | `${number}%`;
  height?: number;
  br?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing skeleton box. Lightweight, no external deps. */
export function SkeletonBox({ width = '100%', height = 16, br = 8, style }: BoxProps) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [v]);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(v.value, [0, 1], [colors.skeletonBase, colors.skeletonHi]),
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: br },
        animStyle,
        style,
      ]}
    />
  );
}

/** Preset: a document/card row skeleton (thumb + 2 lines + badge). */
export function SkeletonRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <SkeletonBox width={48} height={48} br={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox width={'70%' as any} height={14} br={6} />
        <SkeletonBox width={'45%' as any} height={11} br={5} />
      </View>
      <SkeletonBox width={60} height={20} br={10} />
    </View>
  );
}

/** Preset: large hero stat card placeholder. */
export function SkeletonHero({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.hero, style]}>
      <SkeletonBox width={140} height={14} br={6} />
      <View style={{ height: spacing.md }} />
      <SkeletonBox width={120} height={44} br={10} />
      <View style={{ height: spacing.lg }} />
      <SkeletonBox width={'100%' as any} height={6} br={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: spacing.md,
  },
  hero: {
    borderRadius: radius.hero,
    padding: spacing.xl,
    backgroundColor: colors.skeletonBase,
  },
});
