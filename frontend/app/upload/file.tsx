import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, UploadCloud, ImageIcon, FileText, Lock } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stepper } from '../../src/components/Stepper';
import { useUpload } from '../../src/contexts/UploadContext';
import { PrimaryButton } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';

export default function FileStep() {
  const { draft, setDraft } = useUpload();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const pickDoc = async () => {
    setLoading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 });
      setDraft({ fileBase64: b64, fileName: a.name, mimeType: a.mimeType || 'application/octet-stream', size: a.size || b64.length, name: draft.name || a.name.replace(/\.[^.]+$/, '') });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not read file');
    } finally { setLoading(false); }
  };

  const pickImage = async () => {
    setLoading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Enable photo access to upload images.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.85 });
      if (res.canceled) return;
      const a = res.assets[0];
      const b64 = a.base64 || (await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 }));
      const nm = (a.fileName || 'image') + (a.mimeType?.includes('png') ? '.png' : '.jpg');
      setDraft({ fileBase64: b64, fileName: nm, mimeType: a.mimeType || 'image/jpeg', size: a.fileSize || b64.length, name: draft.name || nm.replace(/\.[^.]+$/, '') });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not read image');
    } finally { setLoading(false); }
  };

  // Web/demo-friendly fallback: "sample file" generator so flow works even without picker support
  const useSample = () => {
    const text = `SafeVault Sample · ${draft.category || 'Document'} · ${new Date().toISOString()}`;
    const b64 = btoaSafe(text);
    setDraft({ fileBase64: b64, fileName: 'sample.txt', mimeType: 'text/plain', size: text.length, name: draft.name || 'Sample Document' });
  };

  const proceed = () => router.push('/upload/details');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.close} testID="upload-close-btn"><X color={colors.textPrimary} size={22} /></TouchableOpacity>
        <Text style={styles.topTitle}>Add to Vault</Text>
        <View style={{ width: 40 }} />
      </View>
      <Stepper step={1} />
      <View style={styles.body}>
        <Text style={styles.h1}>Upload the file</Text>
        <Text style={styles.h2}>It will be encrypted on your device before leaving</Text>

        {draft.fileBase64 ? (
          <View style={styles.filePreview} testID="file-preview">
            <View style={styles.fileIcon}><Lock color={colors.primary} size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fName} numberOfLines={1}>{draft.fileName}</Text>
              <Text style={styles.fSub}>{(draft.size! / 1024).toFixed(1)} KB · will be AES‑256 encrypted</Text>
            </View>
          </View>
        ) : (
          <View style={styles.choices}>
            <Choice icon={<FileText color={colors.primary} size={22} />} title="Document (PDF)" sub="Scanned or digital files" onPress={pickDoc} testID="pick-document-btn" />
            <Choice icon={<ImageIcon color={colors.primary} size={22} />} title="Image (JPG / PNG)" sub="From your photo library" onPress={pickImage} testID="pick-image-btn" />
            <Choice icon={<UploadCloud color={colors.primary} size={22} />} title="Use a sample" sub="Skip picker (demo)" onPress={useSample} testID="pick-sample-btn" />
          </View>
        )}

        <View style={{ flex: 1 }} />

        <PrimaryButton
          title={draft.fileBase64 ? 'Continue' : 'Select a file to continue'}
          onPress={proceed}
          disabled={!draft.fileBase64}
          loading={loading}
          testID="upload-continue-btn"
        />
      </View>
    </SafeAreaView>
  );
}

function Choice({ icon, title, sub, onPress, testID }: any) {
  return (
    <TouchableOpacity style={s2.card} onPress={onPress} activeOpacity={0.8} testID={testID}>
      <View style={s2.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={s2.title}>{title}</Text>
        <Text style={s2.sub}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function btoaSafe(s: string) {
  try { return global.btoa ? global.btoa(s) : Buffer.from(s, 'utf-8').toString('base64'); }
  catch { return Buffer.from(s, 'utf-8').toString('base64'); }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  body: { flex: 1, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  h1: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: spacing.xl },
  choices: { gap: 12 },
  filePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primarySurface, borderWidth: 1, borderColor: colors.primary },
  fileIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  fSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
const s2 = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
