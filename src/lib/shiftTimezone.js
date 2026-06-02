// Shift timestamps are stored in UTC. When displayed, they should show in the
// HOUSEHOLD's local timezone (where the shift was actually performed), not the
// viewer's browser timezone. Otherwise an admin in NYC viewing an Israel shift
// will see times shifted by ~7 hours.

const USA_VALUES = ["america", "usa"];
const isUSA = (country) => USA_VALUES.includes((country || "").toLowerCase().trim());

export const tzForHousehold = (country) => (isUSA(country) ? "America/New_York" : "Asia/Jerusalem");

// Format an ISO timestamp in a given IANA timezone.
// Supported tokens in formatStr: yyyy, MMM, dd, d, HH, mm
export const formatInTz = (iso, timeZone, formatStr) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const month = get("month");
  const day = get("day");
  const year = get("year");
  let hour = get("hour");
  const minute = get("minute");
  // Intl can return "24" for midnight in hour12:false on some runtimes — normalize to "00".
  if (hour === "24") hour = "00";
  const dayNoZero = String(parseInt(day, 10));
  return formatStr
    .replace("yyyy", year)
    .replace("MMM", month)
    .replace("dd", day)
    .replace("d", dayNoZero)
    .replace("HH", hour)
    .replace("mm", minute);
};

export const formatShiftTime = (iso, country, formatStr) =>
  formatInTz(iso, tzForHousehold(country), formatStr);