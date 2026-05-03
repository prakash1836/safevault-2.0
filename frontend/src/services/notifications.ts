import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { differenceInSeconds, parseISO, subDays } from 'date-fns';

let configured = false;

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

export async function scheduleReminders(
  id: string,
  title: string,
  dateISO: string,
  opts: { days30: boolean; days7: boolean; days1: boolean }
): Promise<string[]> {
  const ids: string[] = [];
  const target = parseISO(dateISO);
  const now = new Date();
  const points: { when: Date; label: string }[] = [];
  if (opts.days30) points.push({ when: subDays(target, 30), label: '30 days left' });
  if (opts.days7) points.push({ when: subDays(target, 7), label: '7 days left' });
  if (opts.days1) points.push({ when: subDays(target, 1), label: 'Tomorrow' });

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
