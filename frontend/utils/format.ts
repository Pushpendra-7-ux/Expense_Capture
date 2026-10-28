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

/**
 * Format a Date for display (e.g., "28 Oct 2026" or "Today", "Yesterday").
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const todayIST = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );
  const dateIST = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  const today = new Date(
    todayIST.getFullYear(),
    todayIST.getMonth(),
    todayIST.getDate()
  );
  const target = new Date(
    dateIST.getFullYear(),
    dateIST.getMonth(),
    dateIST.getDate()
  );

  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

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
