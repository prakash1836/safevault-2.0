import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

/**
 * Listens for notification taps. When a SafeVault reminder is tapped,
 * navigates to the corresponding document detail screen.
 * Mount this once at app root (after Stack is available).
 */
export function NotificationResponseHandler() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data as any;
        if (data?.id && typeof data.id === 'string') {
          // Slight delay to ensure navigator is ready when app opens from background
          setTimeout(() => {
            router.push(`/document/${data.id}`);
          }, 300);
        }
      } catch (e) {
        // Silently ignore — don't crash app on bad notification data
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Also check if app was opened from a cold-start tap
  useEffect(() => {
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          const data = last.notification.request.content.data as any;
          if (data?.id && typeof data.id === 'string') {
            setTimeout(() => router.push(`/document/${data.id}`), 800);
          }
        }
      } catch {}
    })();
  }, [router]);

  return null;
}
