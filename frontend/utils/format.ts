/**
 * Format paise to INR with Indian digit grouping.
 * e.g. 684000 → "₹6,840.00", 12345678 → "₹1,23,456.78"
 */
export function formatINR(paise: number): string {
  const cleanPaise = Math.round(paise || 0);
  const rupees = cleanPaise / 100;
  const [intPart, decPart] = Math.abs(rupees).toFixed(2).split('.');

  // Indian grouping: last 3 digits, then groups of 2
  const isNegative = cleanPaise < 0;

  if (intPart.length <= 3) {
    return `${isNegative ? '-' : ''}₹${intPart}.${decPart}`;
  }

  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `${isNegative ? '-' : ''}₹${grouped},${lastThree}.${decPart}`;
}

/**
 * Format a Date to IST time string (e.g., "2:30 PM").
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function getKolkataYMD(date: Date): [number, number, number] {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(date)
      .split('-');
    return [parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)];
  } catch {
    return [date.getFullYear(), date.getMonth(), date.getDate()];
  }
}

/**
 * Format a Date for display (e.g., "28 Oct 2026" or "Today", "Yesterday").
 */
export function formatDate(date: Date): string {
  const [ty, tm, td] = getKolkataYMD(new Date());
  const [dy, dm, dd] = getKolkataYMD(date);

  const todayUtc = Date.UTC(ty, tm, td);
  const targetUtc = Date.UTC(dy, dm, dd);

  const diffDays = Math.round((todayUtc - targetUtc) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  if (dy !== ty) {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Format a Date in DD/MM/YYYY format.
 */
export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
