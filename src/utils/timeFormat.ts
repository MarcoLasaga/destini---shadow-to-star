/**
 * Relative time formatter for community and account feeds
 * Formats timestamps cleanly:
 *  - < 1 hour: "Just now" (or "Xm")
 *  - 1 to 23 hours: "1h", "2h", ..., "23h"
 *  - 24 hours to 6 days: "1D", "2D", ..., "6D" (NEVER show 96 hrs ago!)
 *  - 7 to 29 days: "1W", "2W", "3W", "4W"
 *  - 30 to 364 days: "1M", "2M", ..., "11M"
 *  - >= 365 days: "1Y", "2Y", ...
 */
export function formatRelativeTime(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return 'Just now';

  let timestamp: number;
  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    timestamp = new Date(dateInput).getTime();
  } else if (dateInput instanceof Date) {
    timestamp = dateInput.getTime();
  } else {
    return 'Just now';
  }

  if (isNaN(timestamp)) return 'Just now';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffHour < 1) {
    return diffMin <= 1 ? 'Just now' : `${diffMin}m`;
  }
  if (diffHour < 24) {
    return `${diffHour}h`;
  }
  if (diffDay < 7) {
    return `${diffDay}D`;
  }
  if (diffDay < 30) {
    return `${diffWeek}W`;
  }
  if (diffDay < 365) {
    return `${diffMonth}M`;
  }
  return `${diffYear}Y`;
}

