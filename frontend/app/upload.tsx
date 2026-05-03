import React, { useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../src/contexts/AuthContext';
import { usePassword } from '../src/contexts/PasswordContext';
import { zipService } from '../src/services/zipService';
import { driveService } from '../src/services/driveService';
import { theme } from '../src/theme/theme';

interface PickedFile {
  name: string;
  size?: number;
  mimeType?: string;
  uri: string;
  webFile?: File;
}

export default function UploadScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { sessionPassword } = usePassword();

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setPicked({
      name: a.name,
      size: a.size ?? undefined,
      mimeType: a.mimeType ?? undefined,
      uri: a.uri,
      // On web, expo-document-picker stores the File in 'file' since SDK 49+
      webFile: (a as unknown as { file?: File }).file,
    });
  };

  const readFileAsBlob = async (p: PickedFile): Promise<Blob> => {
    // Web: use the underlying File
    if (Platform.OS === 'web') {
      if (p.webFile) return p.webFile;
      const res = await fetch(p.uri);
      return res.blob();
    }
    // Native: read as base64, convert to Uint8Array, wrap in Blob
    const b64 = await FileSystem.readAsStringAsync(p.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Convert base64 -> Uint8Array
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: p.mimeType || 'application/octet-stream' });
  };

  const upload = async () => {
    if (!picked || !session || !sessionPassword) return;
    setError(null);
    try {
      setStatus('Reading file…');
      const blob = await readFileAsBlob(picked);

      setStatus('Encrypting (AES-256 ZIP)…');
      const zipBlob = await zipService.createEncryptedZip(
        { name: picked.name, data: blob, mimeType: picked.mimeType },
        sessionPassword,
      );

      setStatus('Uploading to Google Drive…');
      await driveService.uploadZip({
        accessToken: session.accessToken,
        filename: `${picked.name}.zip`,
        blob: zipBlob,
        originalName: picked.name,
        originalMimeType: picked.mimeType,
      });

      setStatus('Done');
      router.replace('/vault');
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed.');
      setStatus('idle');
    }
  };

  const busy = status !== 'idle' && status !== 'Done';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>Upload file</Text>
          <Text style={styles.subtitle}>
            Selected file is zipped with AES-256 using your vault password, then uploaded to your Google Drive.
          </Text>

          <View style={styles.warnBanner}>
            <Text style={styles.warnBannerText}>
              ⚠️ Your files are protected by your password. If you forget it, files cannot be recovered.
            </Text>
          </View>

          <Pressable onPress={pick} disabled={busy} style={styles.pickBtn}>
            <Text style={styles.pickIcon}>📎</Text>
            <Text style={styles.pickBtnText}>
              {picked ? 'Choose a different file' : 'Choose a file'}
            </Text>
          </Pressable>

          {picked && (
            <View style={styles.fileCard}>
              <Text style={styles.fileCardTitle} numberOfLines={1}>{picked.name}</Text>
              <Text style={styles.fileCardMeta}>
                {picked.mimeType || 'file'}
                {picked.size ? ` · ${(picked.size / 1024).toFixed(1)} KB` : ''}
              </Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          {busy && (
            <View style={styles.progressBox}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.progressText}>{status}</Text>
            </View>
          )}

          <Pressable
            onPress={upload}
            disabled={!picked || busy || !sessionPassword}
            style={({ pressed }) => [
              styles.primaryBtn,
              (!picked || busy || !sessionPassword) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Encrypt & upload</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  headerRow: { flexDirection: 'row', marginBottom: theme.spacing.sm },
  backBtn: { paddingVertical: theme.spacing.xs },
  backBtnText: { color: theme.colors.textMuted, fontSize: theme.font.md },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.md },
  warnBanner: {
    backgroundColor: '#2a1f0a', borderColor: theme.colors.warning, borderWidth: 1,
    padding: theme.spacing.md, borderRadius: theme.radius.md,
  },
  warnBannerText: { color: '#ffdca8', fontSize: theme.font.sm },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, height: 56, borderRadius: theme.radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pickIcon: { fontSize: 22 },
  pickBtnText: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  fileCard: {
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radius.md, borderColor: theme.colors.border, borderWidth: 1,
  },
  fileCardTitle: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  fileCardMeta: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  errorText: { color: theme.colors.danger },
  progressBox: {
    flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center',
    padding: theme.spacing.md, backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
  },
  progressText: { color: theme.colors.text },
  primaryBtn: {
    height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.accent,
    alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.font.md },
});
