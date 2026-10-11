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
  atHour: number = DEFAULT_REMINDER_HOUR,
  atMinute: number = DEFAULT_REMINDER_MINUTE
): Promise<string[]> {
  const ids: string[] = [];

  const target = parseISO(dateISO);
  const now = new Date();

  const atLocalTime = (d: Date) =>
    setMilliseconds(
      setSeconds(
        setMinutes(
          setHours(d, atHour),
          atMinute
        ),
        0
      ),
      0
    );

  const points: { when: Date; label: string }[] = [];

  if (opts.days30) {
    points.push({
      when: atLocalTime(subDays(target, 30)),
      label: '30 days left',
    });
  }

  if (opts.days7) {
    points.push({
      when: atLocalTime(subDays(target, 7)),
      label: '7 days left',
    });
  }

  if (opts.days1) {
    points.push({
      when: atLocalTime(subDays(target, 1)),
      label: 'Tomorrow',
    });
  }

  for (const p of points) {
    const secs = differenceInSeconds(p.when, now);

    // Skip reminders that are already in the past.
    if (secs <= 0) {
      console.log('⏭️ REMINDER SKIPPED:', {
        id,
        title,
        label: p.label,
        triggerTime: p.when.toLocaleString(),
      });
      continue;
    }

    try {
      const nid = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SafeVault Reminder',
          body: `${title} — ${p.label}`,
          sound: 'default',
          data: {
            id,
          },
        },

        // Keep the trigger structure consistent with
        // the previously working test notification.
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secs,
          repeats: false,
          channelId: 'safevault',
        } as any,
      });

      ids.push(nid);

      console.log('🔔 REMINDER SCHEDULED:', {
        id,
        title,
        label: p.label,
        notificationId: nid,
        reminderTime: `${String(atHour).padStart(2, '0')}:${String(
          atMinute
        ).padStart(2, '0')}`,
        triggerTime: p.when.toLocaleString(),
        secondsFromNow: secs,
      });
    } catch (error) {
      console.error('❌ REMINDER SCHEDULING FAILED:', {
        id,
        title,
        label: p.label,
        triggerTime: p.when.toLocaleString(),
        error,
      });
    }
  }

  console.log('📅 TOTAL REMINDERS SCHEDULED:', {
    id,
    title,
    count: ids.length,
    notificationIds: ids,
  });

  return ids;
}

export async function resetNotificationChannels() {
  if (Platform.OS !== 'android') return;

  const channels = await Notifications.getNotificationChannelsAsync();

  console.log('CHANNELS BEFORE DELETE:', channels);

  for (const channel of channels) {
    try {
      await Notifications.deleteNotificationChannelAsync(channel.id);
      console.log('DELETED CHANNEL:', channel.id);
    } catch (e) {
      console.log('DELETE CHANNEL ERROR:', channel.id, e);
    }
  }

  await Notifications.setNotificationChannelAsync('safevault', {
    name: 'SafeVault Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });

  console.log(
    'NEW CHANNEL:',
    await Notifications.getNotificationChannelAsync('safevault')
  );
}

export async function testNotification() {
  await initNotifications();

  await Notifications.cancelAllScheduledNotificationsAsync();

  const testTime = new Date(Date.now() + 60 * 1000);

  console.log('=================================');
  console.log('🔔 NOTIFICATION TEST');
  console.log('CURRENT TIME:', new Date().toLocaleString());
  console.log('EXPECTED TIME:', testTime.toLocaleString());
  console.log('=================================');

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'SafeVault Test',
      body: 'This is a twice second background notification test.',
      sound: 'default',
      data: {
        id: 'notification-test',
      },
    },

    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
      channelId: 'safevault',
    } as any,
  });

  console.log('✅ SCHEDULED ID:', id);

  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  console.log(
    '📅 SCHEDULED NOTIFICATIONS:',
    JSON.stringify(scheduled, null, 2)
  );

  const nextTrigger =
    await Notifications.getNextTriggerDateAsync({
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60,
      repeats: false,
    } as any);

  console.log(
    '⏰ NEXT TRIGGER:',
    nextTrigger
      ? new Date(nextTrigger).toLocaleString()
      : 'NULL'
  );
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

export interface ReminderDocument {
  id: string;
  name: string;
  expiryDate?: string;
  reminder: {
    days30: boolean;
    days7: boolean;
    days1: boolean;
  };
  reminderTime?: {
    hour: number;
    minute: number;
  };
}

export async function scheduleGroupedDocumentReminders(
  documents: ReminderDocument[]
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  type ReminderItem = {
    docId: string;
    title: string;
    when: Date;   
    label: string;
  };

  const items: ReminderItem[] = [];
  const now = new Date();

  for (const doc of documents) {
    if (!doc.expiryDate) continue;

    const target = parseISO(doc.expiryDate);

    const hour = doc.reminderTime?.hour ?? DEFAULT_REMINDER_HOUR;
    const minute = doc.reminderTime?.minute ?? DEFAULT_REMINDER_MINUTE;

    console.log('🕐 GROUPING DOCUMENT TIME:', {
      documentId: doc.id,
      documentName: doc.name,
      reminderTime: doc.reminderTime,
      hour,
      minute,
    });

    const atLocalTime = (d: Date) =>
      setMilliseconds(
        setSeconds(
          setMinutes(
            setHours(d, hour),
            minute
          ),
          0
        ),
        0
      );

    if (doc.reminder.days30) {
      items.push({
        docId: doc.id,
        title: doc.name,
        when: atLocalTime(subDays(target, 30)),
        label: '30 days left',
      });
    }

    if (doc.reminder.days7) {
      items.push({
        docId: doc.id,
        title: doc.name,
        when: atLocalTime(subDays(target, 7)),
        label: '7 days left',
      });
    }

    if (doc.reminder.days1) {
      items.push({
        docId: doc.id,
        title: doc.name,
        when: atLocalTime(subDays(target, 1)),
        label: 'Tomorrow',
      });
    }
  }

  /*
   * Group by:
   *   exact reminder date/time + reminder label
   *
   * Example:
   *
   * Passport       → Sep 9, 4:30 PM → Tomorrow
   * License        → Sep 9, 4:30 PM → Tomorrow
   * Insurance      → Sep 9, 4:30 PM → Tomorrow
   *
   * becomes ONE notification.
   */
  const groups = new Map<string, ReminderItem[]>();

  for (const item of items) {
    const groupKey =
      `${item.when.getFullYear()}-` +
      `${String(item.when.getMonth() + 1).padStart(2, '0')}-` +
      `${String(item.when.getDate()).padStart(2, '0')}|` +
      `${String(item.when.getHours()).padStart(2, '0')}:` +
      `${String(item.when.getMinutes()).padStart(2, '0')}|` +
      item.label;

    const existing = groups.get(groupKey) ?? [];
    existing.push(item);
    groups.set(groupKey, existing);
  }

  for (const [groupKey, group] of groups.entries()) {
    const when = group[0].when;
    const seconds = differenceInSeconds(when, now);

    if (seconds <= 0) {
      console.log('⏭️ GROUP REMINDER SKIPPED:', {
        groupKey,
        count: group.length,
        triggerTime: when.toLocaleString(),
      });
      continue;
    }

    const documentIds = group.map((item) => item.docId);

    let title: string;
    let body: string;

    if (group.length === 1) {
      title = 'SafeVault Reminder';
      body = `${group[0].title} — ${group[0].label}`;
    } else {
      title = 'SafeVault Reminder';
      body = `${group.length} documents are expiring ${
        group[0].label === 'Tomorrow'
          ? 'tomorrow'
          : group[0].label
      }. Tap to view.`;
    }

    try {
      const notificationId =
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: 'default',
            data: {
              type: 'expiry-group',
              documentIds,
              label: group[0].label,
            },
          },

          trigger: {
            type:
              Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: false,
            channelId: 'safevault',
          } as any,
        });

      for (const docId of documentIds) {
        if (!result[docId]) {
          result[docId] = [];
        }

        result[docId].push(notificationId);
      }

      console.log('🔔 GROUP REMINDER SCHEDULED:', {
        groupKey,
        count: group.length,
        documentIds,
        notificationId,
        triggerTime: when.toLocaleString(),
        body,
      });
    } catch (error) {
      console.error('❌ GROUP REMINDER FAILED:', {
        groupKey,
        documentIds,
        triggerTime: when.toLocaleString(),
        error,
      });
    }
  }

  console.log('📅 GROUPED REMINDERS COMPLETE:', {
    groups: groups.size,
    documents: documents.length,
  });

  return result;
}

export async function cancelAllForId(ids: string[] = []) {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
  }
}


