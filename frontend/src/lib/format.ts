/** Format paise to INR with Indian digit grouping. */
export function formatINR(paise: number): string {
  const cleanPaise = Math.round(paise || 0);
  const rupees = cleanPaise / 100;
  const [intPart, decPart] = Math.abs(rupees).toFixed(2).split('.');
  const isNegative = cleanPaise < 0;

  if (intPart.length <= 3) {
    return `${isNegative ? '-' : ''}₹${intPart}.${decPart}`;
  }

  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${isNegative ? '-' : ''}₹${grouped},${lastThree}.${decPart}`;
}

/** Parse a user-entered rupee amount into integer paise. */
export function parseAmountToPaise(input: string): number | null {
  if (!input) return null;
  let cleaned = input
    .replace(/[\u20b9]/g, '')
    .replace(/\b(?:inr|rs\.?)\b/gi, '')
    .replace(/[,\s]/g, '')
    .trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/\u2212/g, '-');
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const rupees = Number(cleaned);
  if (!Number.isFinite(rupees)) return null;
  return Math.round(rupees * 100);
}

function kolkataParts(date: Date): [number, number, number] {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(date)
      .split('-');
    return [Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])];
  } catch {
    return [date.getFullYear(), date.getMonth(), date.getDate()];
  }
}

export function formatDate(date: Date): string {
  const [ty, tm, td] = kolkataParts(new Date());
  const [dy, dm, dd] = kolkataParts(date);
  const diffDays = Math.round(
    (Date.UTC(ty, tm, td) - Date.UTC(dy, dm, dd)) / 86_400_000
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(dy !== ty ? { year: 'numeric' } : {}),
    timeZone: 'Asia/Kolkata',
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

/** YYYY-MM-DD in IST for date inputs and payloads. */
export function toISODate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseExpenseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function parseTimestamp(value?: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });
}

export function isSameMonth(date: Date, reference: Date = new Date()): boolean {
  const [ay, am] = kolkataParts(date);
  const [by, bm] = kolkataParts(reference);
  return ay === by && am === bm;
}
