import { formatDate } from "../../i18n/dateUtils";

export const convertToMilitaryTime = (timeString) => {
  if (!timeString) return '';

  // Handle time ranges like "9:00 AM - 5:00 PM" or "9:00-17:00"
  const timeRangeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(-)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
  const singleTimeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;

  const convertTimePartTo24Hour = (hour, minute, period) => {
    let h = parseInt(hour, 10);
    const m = parseInt(minute, 10);

    if (period) {
      if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
      if (period.toUpperCase() === 'AM' && h === 12) h = 0;
    }

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const rangeMatch = timeString.match(timeRangeRegex);
  if (rangeMatch) {
    const [, startHour, startMin, startPeriod, separator, endHour, endMin, endPeriod] = rangeMatch;
    const startTime = convertTimePartTo24Hour(startHour, startMin, startPeriod);
    const endTime = convertTimePartTo24Hour(endHour, endMin, endPeriod);
    return `${startTime}${separator}${endTime}`;
  }

  const singleMatch = timeString.match(singleTimeRegex);
  if (singleMatch) {
    const [, hour, minute, period] = singleMatch;
    return convertTimePartTo24Hour(hour, minute, period);
  }

  return timeString;
};

export const formatDeliveryTime = (deliveryTime, lang) => {
  if (!deliveryTime) return '';

  let datePartForDisplay = '';
  let timeStringForConversion = deliveryTime;

  const yyyyMmDdRegex = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/;
  const yyyyMmDdMatch = yyyyMmDdRegex.exec(deliveryTime);

  if (yyyyMmDdMatch) {
    const dateStr = yyyyMmDdMatch[1];
    timeStringForConversion = yyyyMmDdMatch[2].trim();
    try {
      const parts = dateStr.split('-').map(Number);
      const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      if (!isNaN(utcDate.getTime())) {
        const dateFormat = lang === 'Hebrew' ? 'd MMM' : 'MMM d';
        datePartForDisplay = formatDate(utcDate, dateFormat, lang);
      }
    } catch (e) {
      console.warn("Failed to parse YYYY-MM-DD date part:", e);
    }
  } else {
    const mmmDdRegex = /^([A-Za-z]{3})\s+(\d{1,2}),?\s*(.*)$/;
    const mmmDdMatch = mmmDdRegex.exec(deliveryTime);

    if (mmmDdMatch) {
      const monthStr = mmmDdMatch[1];
      const dayStr = mmmDdMatch[2];
      timeStringForConversion = mmmDdMatch[3].trim();

      if (lang === 'Hebrew') {
        const monthMap = {
          'Jan': 'ינו', 'Feb': 'פבר', 'Mar': 'מרץ', 'Apr': 'אפר',
          'May': 'מאי', 'Jun': 'יונ', 'Jul': 'יול', 'Aug': 'אוג',
          'Sep': 'ספט', 'Oct': 'אוק', 'Nov': 'נוב', 'Dec': 'דצמ'
        };
        const hebrewMonth = monthMap[monthStr] || monthStr;
        datePartForDisplay = `${dayStr} ${hebrewMonth}`;
      } else {
        datePartForDisplay = `${monthStr} ${dayStr}`;
      }
    }
  }

  const militaryTime = convertToMilitaryTime(timeStringForConversion);
  const tzSuffix = '';

  if (datePartForDisplay && militaryTime) {
    return `${datePartForDisplay}, ${militaryTime}${tzSuffix}`;
  } else if (datePartForDisplay) {
    return datePartForDisplay;
  } else if (militaryTime && deliveryTime === timeStringForConversion) {
    return `${militaryTime}${tzSuffix}`;
  }

  return deliveryTime;
};