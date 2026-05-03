import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../src/contexts/AuthContext';
import { usePassword } from '../src/contexts/PasswordContext';
import { driveService } from '../src/services/driveService';
import { zipService } from '../src/services/zipService';
import { theme } from '../src/theme/theme';

export default function OpenScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { sessionPassword } = usePassword();

  const { id, name, zipName } = useLocalSearchParams<{
    id: string; name: string; zipName: string;
  }>();

  const [password, setPassword] = useState(sessionPassword ?? '');
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const downloadZipOnly = async () => {
    if (!session) return;
    setError(null);
    try {
      setStatus('Downloading encrypted ZIP…');
      const blob = await driveService.downloadFile(session.accessToken, id);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const b64 = await blobToBase64(blob);
        const path = FileSystem.cacheDirectory + zipName;
        await FileSystem.writeAsStringAsync(path, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(path, { mimeType: 'application/zip' });
        else Alert.alert('Saved', `Saved to ${path}`);
      }
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message ?? 'Download failed.');
      setStatus('idle');
    }
  };

  const openDecrypted = async () => {
    if (!session) return;
    if (!password) return setError('Enter the password.');
    setError(null);
    try {
      setStatus('Downloading…');
      const blob = await driveService.downloadFile(session.accessToken, id);

      setStatus('Decrypting…');
      const file = await zipService.extractEncryptedZip(blob, password);

      setStatus('Opening…');
      if (Platform.OS === 'web') {
        const outBlob = new Blob([file.data as unknown as BlobPart], {
          type: file.mimeType || 'application/octet-stream',
        });
        const url = URL.createObjectURL(outBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const b64 = uint8ToBase64(file.data);
        const path = FileSystem.cacheDirectory + file.name;
        await FileSystem.writeAsStringAsync(path, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(path, {
            mimeType: file.mimeType || 'application/octet-stream',
          });
        } else {
          Alert.alert('Saved', `Decrypted file saved to ${path}`);
        }
      }
      setStatus('idle');
    } catch (e: any) {
      setError(e?.message ?? 'Unable to open file.');
      setStatus('idle');
    }
  };

  const busy = status !== 'idle';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>{name}</Text>
          <Text style={styles.subtitle}>{zipName}</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Enter your vault password to decrypt and open the file.
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={openDecrypted}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
          {busy && (
            <View style={styles.progressBox}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.progressText}>{status}</Text>
            </View>
          )}

          <Pressable
            onPress={openDecrypted}
            disabled={busy}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.85 },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.primaryBtnText}>Open file</Text>
          </Pressable>

          <Pressable
            onPress={downloadZipOnly}
            disabled={busy}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.85 },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Download .zip only</Text>
          </Pressable>

          <Text style={styles.hint}>
            ℹ️ The ZIP can also be opened outside this app with any AES-256 unzipper
            (7-Zip, Keka, WinRAR…) using the same password.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function uint8ToBase64(u8: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
  }
  if (typeof btoa === 'function') return btoa(binary);
  // @ts-ignore
  return Buffer.from(u8).toString('base64');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  backBtn: { paddingVertical: theme.spacing.xs, marginBottom: theme.spacing.sm },
  backBtnText: { color: theme.colors.textMuted, fontSize: theme.font.md },
  title: { color: theme.colors.text, fontSize: theme.font.xl, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.sm },
  infoBox: {
    backgroundColor: theme.colors.surfaceAlt, padding: theme.spacing.md,
    borderRadius: theme.radius.md, borderColor: theme.colors.border, borderWidth: 1,
  },
  infoText: { color: theme.colors.text },
  field: { gap: theme.spacing.xs },
  label: { color: theme.colors.textMuted, fontSize: theme.font.sm },
  input: {
    backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1,
    borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, height: 48,
    color: theme.colors.text, fontSize: theme.font.md,
  },
  errorText: { color: theme.colors.danger },
  progressBox: {
    flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center',
    padding: theme.spacing.md, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md,
  },
  progressText: { color: theme.colors.text },
  primaryBtn: {
    height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.font.md },
  secondaryBtn: {
    height: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: theme.colors.text, fontWeight: '600' },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.xs, marginTop: theme.spacing.md },
});
