import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { differenceInSeconds, parseISO, setHours, setMinutes, setSeconds, setMilliseconds, subDays } from 'date-fns';

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
        name: 'SafeVault',
        importance: Notifications.AndroidImportance.DEFAULT,
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
        content: { title: 'SafeVault Reminder', body: `${title} — ${p.label}`, data: { id } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secs,
        } as any,
      });
      ids.push(nid);
    } catch {}
  }
  return ids;
}

export async function cancelAllForId(ids: string[] = []) {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}
