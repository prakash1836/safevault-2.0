import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, Pressable, RefreshControl,
  StyleSheet, Text, View, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { usePassword } from '../src/contexts/PasswordContext';
import { recoveryService } from '../src/services/recoveryService';
import { driveService } from '../src/services/driveService';
import { theme } from '../src/theme/theme';
import type { VaultEntry } from '../src/types';

export default function VaultScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { lock, sessionPassword } = usePassword();

  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!session) return;
      setError(null);
      try {
        const { entries: list, fromCache: fc } = await recoveryService.loadVault(
          session.accessToken,
          { forceRefresh: force },
        );
        setEntries(list);
        setFromCache(fc);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load vault.');
      }
    },
    [session],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load(false);
      setLoading(false);
      // Kick a background refresh to sync with drive
      load(true);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const confirmDelete = (entry: VaultEntry) => {
    const msg = `Permanently delete “${entry.name}” from Google Drive?`;
    const doDelete = async () => {
      try {
        await driveService.deleteFile(session!.accessToken, entry.driveFileId);
        setEntries((prev) => prev.filter((e) => e.driveFileId !== entry.driveFileId));
      } catch (e: any) {
        Alert.alert('Delete failed', e?.message ?? 'Unknown error.');
      }
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(msg)) doDelete();
      return;
    }
    Alert.alert('Delete file', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Your vault</Text>
          <Text style={styles.subtitle}>
            {session?.user?.email ?? 'Signed in'} · {entries.length} file{entries.length === 1 ? '' : 's'}
            {fromCache ? ' (cache)' : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>⚙️</Text>
        </Pressable>
      </View>

      {!sessionPassword && (
        <View style={styles.bannerWarn}>
          <Text style={styles.bannerTitle}>Vault locked</Text>
          <Text style={styles.bannerText}>
            Enter your password to upload or open files.{'  '}
          </Text>
          <Pressable onPress={() => router.replace('/unlock')}>
            <Text style={styles.bannerLink}>Unlock</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.warnBanner}>
        <Text style={styles.warnBannerText}>
          🔐 Files are protected by your password. If you forget it, files cannot be recovered.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load(true)} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>Vault is empty</Text>
          <Text style={styles.emptySub}>Upload a file to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.driveFileId}
          contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 140 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/open',
                    params: { id: item.driveFileId, name: item.name, zipName: item.zipName },
                  })
                }
                style={({ pressed }) => [styles.cardMain, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.fileIcon}>
                  <Text style={{ fontSize: 22 }}>🗄️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.fileMeta} numberOfLines={1}>
                    {item.sizeBytes ? formatBytes(item.sizeBytes) : '—'}
                    {' · '}{new Date(item.uploadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        onPress={() => {
          if (!sessionPassword) { router.replace('/unlock'); return; }
          router.push('/upload');
        }}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
        accessibilityLabel="Upload file"
      >
        <Text style={styles.fabPlus}>+</Text>
        <Text style={styles.fabLabel}>Upload</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm, gap: theme.spacing.sm,
  },
  title: { color: theme.colors.text, fontSize: theme.font.xxl, fontWeight: '700' },
  subtitle: { color: theme.colors.textMuted, fontSize: theme.font.sm, marginTop: 2 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1,
  },
  iconBtnText: { fontSize: 18 },
  bannerWarn: {
    marginHorizontal: theme.spacing.md, backgroundColor: '#3a1222',
    borderColor: theme.colors.danger, borderWidth: 1, padding: theme.spacing.md,
    borderRadius: theme.radius.md, gap: 4,
  },
  bannerTitle: { color: theme.colors.danger, fontWeight: '700' },
  bannerText: { color: '#ffb3c1' },
  bannerLink: { color: '#ffb3c1', textDecorationLine: 'underline', marginTop: 4 },
  warnBanner: {
    marginHorizontal: theme.spacing.md, marginTop: theme.spacing.sm,
    backgroundColor: '#2a1f0a', borderColor: theme.colors.warning, borderWidth: 1,
    padding: theme.spacing.sm, borderRadius: theme.radius.md,
  },
  warnBannerText: { color: '#ffdca8', fontSize: theme.font.sm },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, padding: theme.spacing.lg },
  errorText: { color: theme.colors.danger, textAlign: 'center' },
  retryBtn: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md, backgroundColor: theme.colors.accent,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { color: theme.colors.text, fontSize: theme.font.lg, fontWeight: '600' },
  emptySub: { color: theme.colors.textMuted },
  card: {
    backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1,
    borderRadius: theme.radius.md, marginBottom: theme.spacing.sm, overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: theme.spacing.sm },
  fileIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  fileName: { color: theme.colors.text, fontSize: theme.font.md, fontWeight: '600' },
  fileMeta: { color: theme.colors.textMuted, fontSize: theme.font.xs, marginTop: 2 },
  chevron: { color: theme.colors.textMuted, fontSize: 24, paddingLeft: 4 },
  deleteBtn: {
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    paddingVertical: theme.spacing.sm, alignItems: 'center',
  },
  deleteBtnText: { color: theme.colors.danger, fontWeight: '600' },
  fab: {
    position: 'absolute', right: theme.spacing.lg, bottom: theme.spacing.xl,
    backgroundColor: theme.colors.accent, borderRadius: 999,
    paddingHorizontal: theme.spacing.lg, height: 56,
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: Platform.OS === 'ios' ? -2 : -4 },
  fabLabel: { color: '#fff', fontWeight: '700', fontSize: theme.font.md },
});
