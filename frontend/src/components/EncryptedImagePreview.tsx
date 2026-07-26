import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Eye, EyeOff, Maximize2, Minimize2, FileText } from 'lucide-react-native';
import { colors, radius, spacing } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getKey, decryptToBase64 } from '../services/encryption';
import { readEncryptedLocal } from '../services/drive';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  doc: { id: string; mimeType?: string; localUri?: string | null; fileId?: string | null };
}

export function EncryptedImagePreview({ doc }: Props) {
  const t = useTheme();
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isImage = !!doc.mimeType && /image\//.test(doc.mimeType);

  // Pinch + pan shared values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const decrypt = async () => {
    if (dataUri) { setReveal(true); return; }
    setLoading(true);
    setError(null);
    try {
      const key = await getKey();
      if (!key) throw new Error('Missing encryption key');
      if (!doc.localUri) throw new Error('No file attached');
      const cipher = await readEncryptedLocal(doc.localUri);
      if (!cipher) throw new Error('Local cache unavailable on this platform');
      const b64 = decryptToBase64(cipher, key);
      const mime = doc.mimeType || 'image/jpeg';
      setDataUri(`data:${mime};base64,${b64}`);
      setReveal(true);
    } catch (e: any) {
      setError(e.message || 'Could not decrypt');
    } finally {
      setLoading(false);
    }
  };

  const hide = () => {
    setReveal(false);
    scale.value = withTiming(1);
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        const limit = (scale.value - 1) * SCREEN_W * 0.5;
        tx.value = Math.max(-limit, Math.min(savedTx.value + e.translationX, limit));
        ty.value = Math.max(-limit, Math.min(savedTy.value + e.translationY, limit));
      }
    })
    .onEnd(() => { savedTx.value = tx.value; savedTy.value = ty.value; });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedScale.value = 1;
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  if (!isImage) {
    return (
      <View style={[styles.placeholder, { backgroundColor: colors.elevated }]} testID="preview-non-image">
        <FileText color={colors.textTertiary} size={28} />
        <Text style={styles.phTitle}>Preview not available</Text>
        <Text style={styles.phSub}>This file type can't be previewed in‑app. Use Download to open it.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="encrypted-image-preview">
      <View style={[styles.viewport, { backgroundColor: t.accentDark }]}>
        {!reveal ? (
          <View style={styles.placeholderInner}>
            <View style={styles.lockBig}><Eye color="#fff" size={26} strokeWidth={1.6} /></View>
            <Text style={styles.lockTitle}>Image is encrypted</Text>
            <Text style={styles.lockSub}>Tap reveal to decrypt locally</Text>
          </View>
        ) : (
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.imgBox, animStyle]} collapsable={false}>
              {dataUri && <Image source={{ uri: dataUri }} style={styles.img} resizeMode="contain" />}
            </Animated.View>
          </GestureDetector>
        )}
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingTxt}>Decrypting…</Text>
          </View>
        )}
        {reveal && (
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintTxt}>Pinch to zoom · double‑tap to toggle</Text>
          </View>
        )}
      </View>

      {error && <Text style={styles.errTxt}>{error}</Text>}

      <View style={styles.controls}>
        {!reveal ? (
          <TouchableOpacity style={[styles.btn, { backgroundColor: t.accent }]} onPress={decrypt} disabled={loading} testID="reveal-btn">
            <Eye color="#fff" size={16} />
            <Text style={styles.btnTxt}>Decrypt & reveal</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.elevated }]} onPress={hide} testID="hide-btn">
            <EyeOff color={colors.textPrimary} size={16} />
            <Text style={[styles.btnTxt, { color: colors.textPrimary }]}>Hide</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden' },
  viewport: { height: 280, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  placeholderInner: { alignItems: 'center', padding: spacing.lg },
  lockBig: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  lockTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lockSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  imgBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,63,58,0.6)' },
  loadingTxt: { color: '#fff', fontSize: 12, marginTop: 8, fontWeight: '600' },
  hint: { position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  hintTxt: { color: '#fff', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  controls: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  placeholder: { padding: spacing.xl, borderRadius: radius.lg, alignItems: 'center', gap: 8 },
  phTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  phSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  errTxt: { fontSize: 12, color: colors.expired, marginTop: 8 },
});
