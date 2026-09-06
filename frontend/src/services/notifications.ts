import * as Notifications from 'expo-notifications';
import { Platform,Linking } from 'react-native';
import { differenceInSeconds, parseISO, setHours, setMinutes, setSeconds, setMilliseconds, subDays } from 'date-fns';
// import { Linking } from 'react-native';
let configured = false;

// Default local hour that reminders fire at (24h).
export const DEFAULT_REMINDER_HOUR = 16;
export const DEFAULT_REMINDER_MINUTE = 30;

export async function initNotifications() {
  if (configured) return;
  configured = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
   if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('safevault', {
        name: 'SafeVault Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) await Notifications.requestPermissionsAsync();
  } catch {}
}

/**
 * Schedule reminders at 30 / 7 / 1 day(s) before `dateISO`.
 * Fires at `atHour` local time (defaults to 16:30). Past points are skipped.
 * Returns the list of Expo notification IDs (persist alongside the doc/event id).
 */
export async function scheduleReminders(
  id: string,
  title: string,
  dateISO: string,
  opts: { days30: boolean; days7: boolean; days1: boolean },
  atHour: number = DEFAULT_REMINDER_HOUR
): Promise<string[]> {
  const ids: string[] = [];
  const target = parseISO(dateISO);
  const now = new Date();

  const atLocalTime = (d: Date) => setMilliseconds(setSeconds(setMinutes(setHours(d, atHour), DEFAULT_REMINDER_MINUTE), 0), 0);

  const points: { when: Date; label: string }[] = [];
  if (opts.days30) points.push({ when: atLocalTime(subDays(target, 30)), label: '30 days left' });
  if (opts.days7)  points.push({ when: atLocalTime(subDays(target, 7)),  label: '7 days left' });
  if (opts.days1)  points.push({ when: atLocalTime(subDays(target, 1)),  label: 'Tomorrow' });

  for (const p of points) {
    const secs = differenceInSeconds(p.when, now);
    if (secs <= 0) continue;
    try {
     const nid = await Notifications.scheduleNotificationAsync({
  content: {
    title: 'SafeVault Reminder',
    body: `${title} — ${p.label}`,
    data: { id },
    sound: 'default',
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: secs,
    channelId: 'safevault',
  },
});
      ids.push(nid);
    } catch {}
  }
  return ids;
}

export async function testNotification() {
  await initNotifications();

  await Notifications.cancelAllScheduledNotificationsAsync();

  const testTime = new Date(Date.now() + 60 * 1000);

  console.log('CURRENT:', new Date().toLocaleString());
  console.log('TEST:', testTime.toLocaleString());

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SafeVault Test',
      body: '60 second notification test',
      sound: 'default',
      data: {
        id: 'notification-test',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: testTime,
      channelId: 'safevault',
    },
  });

  console.log('SCHEDULED ID:', id);
}

export async function checkNotificationPermissions() {
  const permission = await Notifications.getPermissionsAsync();

  console.log(
    '🔔 NOTIFICATION PERMISSION:',
    JSON.stringify(permission, null, 2)
  );

  if (Platform.OS === 'android') {
    const channel = await Notifications.getNotificationChannelAsync('safevault');

    console.log(
      '📢 CHANNEL:',
      JSON.stringify(channel, null, 2)
    );
  }
}

export async function cancelAllForId(ids: string[] = []) {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}


