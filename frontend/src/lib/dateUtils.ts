/**
 * Utilities for parsing and formatting dates for display.
 *
 * This normalizes values coming from the backend that might be stored
 * as `YYYY-MM-DD` or `YYYY-MM-DD 00:00:00` (midnight). To avoid
 * timezone off-by-one when a midnight UTC timestamp is interpreted in
 * the user's local timezone, date-only or midnight timestamps are
 * rendered using a safe midday anchor (T12:00:00) so the calendar day
 * remains the expected one.
 */

export const formatDateForDisplay = (dateString?: string | null, includeTime: boolean = false) => {
  if (!dateString) return '-';

  // Matches: YYYY-MM-DD OR YYYY-MM-DDT00:00:00(.000Z)? OR YYYY-MM-DD 00:00:00
  const dateOnlyRegex = /^(\d{4}-\d{2}-\d{2})(?:[T ]00:00:00(?:\.000Z|Z)?)?$/;
  const match = String(dateString).match(dateOnlyRegex);

  let d: Date;
  if (match) {
    // Treat as date-only: anchor to noon to avoid timezone shifts
    d = new Date(match[1] + 'T12:00:00');
  } else {
    // Otherwise let JS parse the full timestamp
    d = new Date(dateString as string);
  }

  // Fallback if date is invalid
  if (isNaN(d.getTime())) return '-';

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  if (includeTime && !match) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  return d.toLocaleString('es-VE', options);
};

export const getLocalDateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const normalizeDateInputForApi = (dateValue?: string | null) => {
  if (!dateValue) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return `${dateValue}T12:00:00`;
  }

  return dateValue;
};

export default formatDateForDisplay;
