import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { UploadCloud, ImageIcon, FileText, Lock, Repeat, FileSpreadsheet } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stepper } from '../../src/components/Stepper';
import { UploadHeader } from '../../src/components/UploadHeader';
import { useUpload } from '../../src/contexts/UploadContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { PrimaryButton } from '../../src/components/UI';
import { colors, radius, spacing } from '../../src/constants/theme';
import { MAX_UPLOAD_SIZE_MB, MAX_UPLOAD_SIZE_BYTES } from '../../src/constants/upload';

export default function FileStep() {
  const { draft, setDraft } = useUpload();
  const t = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const pickAnyFile = async () => {
    setLoading(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const a = res.assets[0];
      if (a.size && a.size > MAX_UPLOAD_SIZE_BYTES) {
        Alert.alert(
          'File is too large',
          `“${a.name}” is ${(a.size / (1024 * 1024)).toFixed(1)} MB. SafeVault currently supports files up to ${MAX_UPLOAD_SIZE_MB} MB per upload.`
        );
        return;
      }
      const b64 = await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 });
      setDraft({
        fileBase64: b64,
        fileName: a.name,
        mimeType: a.mimeType || guessMime(a.name),
        size: a.size || b64.length,
        name: draft.name || a.name.replace(/\.[^.]+$/, ''),
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not read file');
    } finally { setLoading(false); }
  };

  const pickImage = async () => {
    setLoading(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Enable photo library access in settings to upload images.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.85 });
      if (res.canceled) return;
      const a = res.assets[0];
      const sizeGuess = a.fileSize || (a.base64 ? Math.ceil((a.base64.length * 3) / 4) : 0);
      if (sizeGuess > MAX_UPLOAD_SIZE_BYTES) {
        Alert.alert(
          'Image is too large',
          `This image is about ${(sizeGuess / (1024 * 1024)).toFixed(1)} MB. SafeVault currently supports files up to ${MAX_UPLOAD_SIZE_MB} MB per upload.`
        );
        return;
      }
      const b64 = a.base64 || (await FileSystem.readAsStringAsync(a.uri, { encoding: FileSystem.EncodingType.Base64 }));
      const isPng = (a.mimeType || '').includes('png');
      const nm = (a.fileName || `image_${Date.now()}`) + (isPng ? '.png' : '.jpg');
      setDraft({
        fileBase64: b64,
        fileName: nm,
        mimeType: a.mimeType || 'image/jpeg',
        size: a.fileSize || b64.length,
        name: draft.name || nm.replace(/\.[^.]+$/, ''),
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not read image');
    } finally { setLoading(false); }
  };

  const useSample = () => {
    const text = `SafeVault Sample · ${draft.category || 'Document'} · ${new Date().toISOString()}`;
    const b64 = btoaSafe(text);
    setDraft({
      fileBase64: b64,
      fileName: 'sample.txt',
      mimeType: 'text/plain',
      size: text.length,
      name: draft.name || 'Sample Document',
    });
  };

  const replace = () => {
    setDraft({ fileBase64: null, fileName: null, mimeType: null, size: null });
  };

  const proceed = () => router.push('/upload/details');

  const fileExt = draft.fileName?.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <UploadHeader title="Add to Vault" />
      <Stepper step={1} />
      <View style={styles.body}>
        <Text style={styles.h1}>Upload the file</Text>
        <Text style={styles.h2}>It will be encrypted on your device before leaving</Text>

        {draft.fileBase64 && (
          <View style={[styles.filePreview, { backgroundColor: t.accentSurface, borderColor: t.accent }]} testID="file-preview">
            <View style={styles.fileIcon}><Lock color={t.accent} size={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fName} numberOfLines={1}>{draft.fileName}</Text>
              <Text style={styles.fSub}>
                {fileExt} · {((draft.size || 0) / 1024).toFixed(1)} KB · will be AES‑256 encrypted
              </Text>
            </View>
            <TouchableOpacity onPress={replace} style={[styles.replaceBtn, { backgroundColor: t.accent }]} testID="replace-file-btn">
              <Repeat color="#fff" size={14} />
              <Text style={styles.replaceTxt}>Replace</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.choices}>
          <Choice
            icon={<FileText color={t.accent} size={22} />}
            title="Document"
            sub="PDF, Word, Excel, Text — any file type"
            onPress={pickAnyFile}
            testID="pick-document-btn"
            accent={t.accentSurface}
          />
          <Choice
            icon={<ImageIcon color={t.accent} size={22} />}
            title="Image"
            sub="JPG, PNG, HEIC from your photo library"
            onPress={pickImage}
            testID="pick-image-btn"
            accent={t.accentSurface}
          />
          <Choice
            icon={<UploadCloud color={t.accent} size={22} />}
            title="Use a sample"
            sub="Skip picker (good for demo / web preview)"
            onPress={useSample}
            testID="pick-sample-btn"
            accent={t.accentSurface}
          />
        </View>

        <View style={{ flex: 1 }} />

        <PrimaryButton
          title={draft.fileBase64 ? 'Continue' : 'Select a file to continue'}
          onPress={proceed}
          disabled={!draft.fileBase64}
          loading={loading}
          variant="dark"
          testID="upload-continue-btn"
        />
      </View>
    </SafeAreaView>
  );
}

function Choice({ icon, title, sub, onPress, testID, accent }: any) {
  return (
    <TouchableOpacity style={s2.card} onPress={onPress} activeOpacity={0.85} testID={testID}>
      <View style={[s2.icon, { backgroundColor: accent }]}>{icon}</View>
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

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp',
    zip: 'application/zip', rtf: 'application/rtf',
  };
  return map[ext || ''] || 'application/octet-stream';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl },
  h1: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: spacing.xl },
  choices: { gap: 12 },
  filePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.lg },
  fileIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  fName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  fSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  replaceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  replaceTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
const s2 = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
