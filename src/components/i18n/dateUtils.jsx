
import { format, differenceInMinutes } from 'date-fns';
import { he, enUS } from 'date-fns/locale';

/**
 * Converts a date to Israeli time by applying the Israeli timezone offset
 * Note: This uses a simplified fixed offset and doesn't handle DST transitions perfectly
 */
export function toIsraeliTime(date) {
  if (!date) return null;
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return null;
  
  // Simple offset calculation - Israel is typically UTC+2 or UTC+3
  // This is a simplified approach and doesn't handle DST transitions perfectly
  const israelOffset = 3; // hours ahead of UTC (simplified)
  const israeliTime = new Date(dateObj.getTime() + (israelOffset * 60 * 60 * 1000));
  
  return israeliTime;
}

/**
 * Formats a date string according to the specified format and language
 */
export function formatDate(date, formatString = 'PPP', language = 'English') {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const locale = language === 'Hebrew' ? he : enUS;
  
  try {
    return format(dateObj, formatString, { locale });
  } catch (error) {
    console.warn('Date formatting error:', error);
    return dateObj.toLocaleDateString();
  }
}

/**
 * Gets the current time in Israeli timezone
 */
export function getCurrentIsraeliTime() {
  const now = new Date();
  const israelOffset = 3; // hours ahead of UTC (simplified) - Fixed to match toIsraeliTime
  return new Date(now.getTime() + (israelOffset * 60 * 60 * 1000));
}

/**
 * Formats a date specifically for Israeli timezone
 */
export function formatIsraeliTime(date, formatString = 'PPP', language = 'English') {
  const israeliTime = toIsraeliTime(date);
  return formatDate(israeliTime, formatString, language);
}

/**
 * Gets the day name for a given date
 */
export function getDayName(date, language = 'English', short = false) {
  const formatStr = short ? 'EEE' : 'EEEE';
  return formatDate(date, formatStr, language);
}

/**
 * Formats relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(date, language = 'English') {
  if (!date) return '';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const now = new Date(); // Current time in user's browser (or UTC on server)
  
  // Directly calculate the difference in minutes.
  // `date-fns` handles the Date objects correctly, regardless of their timezone representation.
  const diffInMinutes = differenceInMinutes(now, dateObj);
  
  if (language === 'Hebrew') {
    if (diffInMinutes < 1) return 'עכשיו';
    if (diffInMinutes === 1) return 'לפני דקה';
    if (diffInMinutes < 60) return `לפני ${diffInMinutes} דקות`;
    
    const hours = Math.floor(diffInMinutes / 60);
    if (hours === 1) return 'לפני שעה';
    if (hours < 24) return `לפני ${hours} שעות`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'אתמול';
    return `לפני ${days} ימים`;
  } else {
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes === 1) return '1 minute ago';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const hours = Math.floor(diffInMinutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    return `${days} days ago`;
  }
}

/**
 * Creates a Date object for Israeli time from components
 * Fixed to properly create Israeli time dates
 */
export function createIsraeliDate(year, month, day = 1, hour = 0, minute = 0, second = 0) {
  // Create a UTC date first, then adjust by Israeli offset
  const israelOffset = 3; // hours ahead of UTC
  
  // Create UTC date and subtract Israeli offset to get the correct Israeli time
  const utcDate = new Date(Date.UTC(year, month, day, hour - israelOffset, minute, second));
  
  // Now convert to Israeli time using our standard function
  return toIsraeliTime(utcDate);
}

/**
 * Checks if two dates fall on the same day in Israeli time
 */
export function isSameDayInIsrael(date1, date2) {
  if (!date1 || !date2) return false;
  
  // Convert both dates to Israeli time first
  const d1 = toIsraeliTime(date1);
  const d2 = toIsraeliTime(date2);
  
  if (!d1 || !d2) return false;
  
  return formatDate(d1, 'yyyy-MM-dd') === formatDate(d2, 'yyyy-MM-dd');
}

/**
 * Gets the start of day (00:00:00) for a given date in Israeli time
 */
export function startOfDayInIsrael(date) {
  if (!date) return null;
  
  // Convert to Israeli time first
  const israeliDate = toIsraeliTime(date);
  if (!israeliDate) return null;
  
  // Extract components from Israeli time
  const year = israeliDate.getUTCFullYear();
  const month = israeliDate.getUTCMonth();
  const day = israeliDate.getUTCDate();
  
  // Create start of day in Israeli time using our corrected function
  return createIsraeliDate(year, month, day, 0, 0, 0);
}

/**
 * Gets the end of day (23:59:59.999) for a given date in Israeli time
 */
export function endOfDayInIsrael(date) {
  if (!date) return null;
  
  // Convert to Israeli time first
  const israeliDate = toIsraeliTime(date);
  if (!israeliDate) return null;
  
  // Extract components from Israeli time
  const year = israeliDate.getUTCFullYear();
  const month = israeliDate.getUTCMonth();
  const day = israeliDate.getUTCDate();
  
  // Create end of day in Israeli time using our corrected function
  return createIsraeliDate(year, month, day, 23, 59, 59);
}
