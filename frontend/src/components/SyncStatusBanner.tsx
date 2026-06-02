import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { useVault } from '../contexts/VaultContext';
import { useNetwork } from '../contexts/NetworkContext';
import { colors, spacing, typography, radius } from '../constants/theme';
import { hapt } from '../utils/haptics';

/**
 * Shows when one or more uploaded documents are queued for sync (failed Drive uploads).
 * Auto-retries on network reconnect; user can also tap "Retry now".
 */
export function SyncStatusBanner() {
  const { pendingSyncCount, retryFailedUploads } = useVault();
  const { isOnline } = useNetwork();
  const [retrying, setRetrying] = React.useState(false);

  if (pendingSyncCount === 0) return null;

  const onRetry = async () => {
    hapt.light();
    setRetrying(true);
    try {
      await retryFailedUploads();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={styles.banner}
      testID="sync-status-banner"
    >
      <CloudOff color={colors.expiringSoon} size={18} strokeWidth={2} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {pendingSyncCount} {pendingSyncCount === 1 ? 'document' : 'documents'} pending sync
        </Text>
        <Text style={styles.subtitle}>
          {isOnline ? 'Will retry automatically' : 'Will sync when online'}
        </Text>
      </View>
      {isOnline && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetry}
          disabled={retrying}
          activeOpacity={0.85}
          testID="sync-retry-btn"
        >
          {retrying ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <RefreshCw color="#fff" size={14} strokeWidth={2.5} />
              <Text style={styles.retryText}>Retry</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: colors.expiringSurface,
    borderColor: colors.expiringSoon,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    minWidth: 72,
    justifyContent: 'center',
    backgroundColor: colors.expiringSoon,
  },
  retryText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
});
