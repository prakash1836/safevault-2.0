import React from 'react';
import { Pressable, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { hapt } from '../utils/haptics';

interface Props {
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  haptic?: 'none' | 'light' | 'medium' | 'selection';
  disabled?: boolean;
  testID?: string;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  hitSlop?: number;
}

/**
 * Pressable wrapper with subtle scale + optional haptic.
 * Drop-in replacement for TouchableOpacity for premium tactile feel.
 */
export function PressableScale({
  onPress,
  onLongPress,
  style,
  pressedScale = 0.97,
  haptic = 'light',
  disabled = false,
  testID,
  children,
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlop,
}: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onIn = () => {
    scale.value = withTiming(pressedScale, { duration: 90 });
  };
  const onOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  const handle = (e: GestureResponderEvent) => {
    if (disabled) return;
    if (haptic !== 'none') hapt[haptic]();
    onPress?.(e);
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        testID={testID}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={handle}
        onLongPress={onLongPress}
        disabled={disabled}
        style={style}
        hitSlop={hitSlop}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
