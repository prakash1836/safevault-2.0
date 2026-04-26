import { differenceInDays, format, isBefore, parseISO } from 'date-fns';

export type DocStatus = 'valid' | 'expiring_soon' | 'expired' | 'none';

export function getDocStatus(expiryISO?: string): DocStatus {
  if (!expiryISO) return 'none';
  const exp = parseISO(expiryISO);
  const now = new Date();
  const days = differenceInDays(exp, now);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'valid';
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return differenceInDays(parseISO(iso), new Date());
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

export function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return isBefore(parseISO(iso), new Date());
}

export function groupByTimeline<T extends { date: string }>(items: T[]): {
  overdue: T[];
  thisMonth: T[];
  next3: T[];
  later: T[];
} {
  const now = new Date();
  const res: { overdue: T[]; thisMonth: T[]; next3: T[]; later: T[] } = {
    overdue: [],
    thisMonth: [],
    next3: [],
    later: [],
  };
  for (const it of items) {
    const d = parseISO(it.date);
    const diff = differenceInDays(d, now);
    if (diff < 0) res.overdue.push(it);
    else if (diff <= 30) res.thisMonth.push(it);
    else if (diff <= 90) res.next3.push(it);
    else res.later.push(it);
  }
  return res;
}
