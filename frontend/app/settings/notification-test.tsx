import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { testNotification } from '../../src/services/notifications';


export default function NotificationTestScreen() {
  const handleTest = async () => {
    await testNotification();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Test</Text>

      <Text style={styles.description}>
        This screen is only for testing SafeVault local notifications.
      </Text>

      <Text style={styles.info}>
        Tap the button below. A notification should appear after 1 minute,
        even if the app is closed and the phone is locked.
      </Text>

      <Button
        title="TEST NOTIFICATION testing"
        onPress={handleTest}
      />
      {/* <Button
          title="Test Immediate Notification testing"
          onPress={async () => {
            await testImmediateNotification();
          }}
        /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },

  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },

  info: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
});