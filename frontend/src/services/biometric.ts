import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'safevault.biometric.enabled';

export const biometric = {
  /**
   * Check if device supports biometric authentication
   */
  async isAvailable(): Promise<{
    available: boolean;
    biometricType: 'fingerprint' | 'facial' | 'iris' | 'none';
    hasHardware: boolean;
    isEnrolled: boolean;
  }> {
    if (Platform.OS === 'web') {
      return { available: false, biometricType: 'none', hasHardware: false, isEnrolled: false };
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let biometricType: 'fingerprint' | 'facial' | 'iris' | 'none' = 'none';
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = 'facial';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = 'fingerprint';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometricType = 'iris';
      }

      return {
        available: hasHardware && isEnrolled,
        biometricType,
        hasHardware,
        isEnrolled,
      };
    } catch (error) {
      console.warn('Biometric availability check failed:', error);
      return { available: false, biometricType: 'none', hasHardware: false, isEnrolled: false };
    }
  },

  /**
   * Prompt user for biometric authentication
   */
  async authenticate(reason: string = 'Unlock SafeVault'): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use device PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch (error) {
      console.warn('Biometric authentication failed:', error);
      return false;
    }
  },

  /**
   * Check if biometric lock is enabled for this app
   */
  async isEnabled(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return value === '1';
  },

  /**
   * Enable biometric lock (requires successful auth first)
   */
  async enable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    const ok = await this.authenticate('Enable biometric lock');
    if (ok) {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, '1');
      return true;
    }
    return false;
  },

  /**
   * Disable biometric lock
   */
  async disable(): Promise<void> {
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  },
};
