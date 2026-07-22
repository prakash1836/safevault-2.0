import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle, Rect, G } from 'react-native-svg';

interface Props {
  size?: number;
  primary?: string;   // shield fill / accent
  accent?: string;    // inner mark highlight
  onDark?: boolean;   // renders bright variant for dark hero backgrounds
  style?: StyleProp<ViewStyle>;
}

/**
 * SafeVault brandmark.
 * A minimal shield silhouette with an inner vault dial + subtle document fold cue.
 * Vector-only (react-native-svg) — no image assets required.
 */
export function Logo({ size = 48, primary = '#2461E8', accent, onDark = false, style }: Props) {
  const ringColor = onDark ? 'rgba(255,255,255,0.92)' : primary;
  const bodyFill = onDark ? 'rgba(255,255,255,0.10)' : `${primary}14`; // 8% tint on light bg
  const strokeBody = onDark ? 'rgba(255,255,255,0.94)' : primary;
  const strokeInner = onDark ? 'rgba(255,255,255,0.85)' : (accent || primary);
  const dotFill = onDark ? '#FFFFFF' : (accent || primary);

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Defs>
          <LinearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={onDark ? 'rgba(255,255,255,0.16)' : primary} stopOpacity={onDark ? 1 : 0.14} />
            <Stop offset="1" stopColor={onDark ? 'rgba(255,255,255,0.02)' : primary} stopOpacity={onDark ? 1 : 0.02} />
          </LinearGradient>
        </Defs>

        {/* Shield body */}
        <Path
          d="M32 4 L54 12 V32 C54 46.5 44 56 32 60 C20 56 10 46.5 10 32 V12 Z"
          fill="url(#lg1)"
          stroke={strokeBody}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />

        {/* Vault dial ring */}
        <Circle cx={32} cy={31} r={11.5} stroke={ringColor} strokeWidth={2} fill="none" />

        {/* Dial tick — top */}
        <Rect x={31} y={15.5} width={2} height={4} rx={1} fill={dotFill} />
        {/* Dial spoke */}
        <Path
          d="M32 31 L39.5 26"
          stroke={strokeInner}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        {/* Dial hub */}
        <Circle cx={32} cy={31} r={2.2} fill={dotFill} />

        {/* Document fold hint (bottom tab) */}
        <Path
          d="M25.5 47 H38.5"
          stroke={strokeInner}
          strokeWidth={2.2}
          strokeLinecap="round"
          opacity={0.55}
        />
      </Svg>
    </View>
  );
}

/**
 * Compact wordmark for splash / login.
 * Not text — an accompanying badge-style presentation of "SafeVault" is left to the composing screen.
 */
export function LogoMonogram({ size = 40, color = '#FFFFFF', bg = '#0F1F52', style }: { size?: number; color?: string; bg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 64 64" fill="none">
        <Path
          d="M32 4 L54 12 V32 C54 46.5 44 56 32 60 C20 56 10 46.5 10 32 V12 Z"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx={32} cy={31} r={10} stroke={color} strokeWidth={2.4} fill="none" />
        <Circle cx={32} cy={31} r={2.4} fill={color} />
        <Path d="M32 31 L39 26.6" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
