import { format } from 'date-fns';

// Helper to get day of week from date string
const getDayOfWeek = (dateStr) => {
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getUTCDay()];
};

// Summer 2026 Calendar (SH26) - Shavuot & Summer
export const sh2026Data = [
  // Shavuot 2026 & Summer Holiday Period
  {
    date: '2026-05-13',
    hebrew_date: "כ\"ה אייר",
    dayOfWeek: getDayOfWeek('2026-05-13'),
    holiday: 'Erev Shavuot',
    meals: [
      { id: 'SH26_051301', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
  },
  {
    date: '2026-05-14',
    hebrew_date: "כ\"ו אייר",
    dayOfWeek: getDayOfWeek('2026-05-14'),
    holiday: 'Shavuot - 1st Day',
    meals: [
      { id: 'SH26_051401', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_051402', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_051403', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
    candleLighting: '8:13 PM',
    shabbosEnds: '9:17 PM',
  },
  {
    date: '2026-05-15',
    hebrew_date: "כ\"ז אייר",
    dayOfWeek: getDayOfWeek('2026-05-15'),
    holiday: 'Shavuot - 2nd Day',
    meals: [
      { id: 'SH26_051501', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_051502', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_051503', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
    candleLighting: '8:14 PM',
  },
  {
    date: '2026-05-16',
    hebrew_date: "כ\"ח אייר",
    dayOfWeek: getDayOfWeek('2026-05-16'),
    holiday: 'Shabbat Shavuot',
    meals: [
      { id: 'SH26_051601', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_051602', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_051603', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
    candleLighting: '8:15 PM',
    shabbosEnds: '9:20 PM',
  },
  {
    date: '2026-05-17',
    hebrew_date: "כ\"ט אייר",
    dayOfWeek: getDayOfWeek('2026-05-17'),
    holiday: 'Post-Shavuot',
    meals: [
      { id: 'SH26_051701', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_051702', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_051703', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
  },
  {
    date: '2026-05-18',
    hebrew_date: "ל׳ אייר",
    dayOfWeek: getDayOfWeek('2026-05-18'),
    holiday: '',
    meals: [
      { id: 'SH26_051801', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_051802', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_051803', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
  },
  {
    date: '2026-05-19',
    hebrew_date: "א׳ סיוון",
    dayOfWeek: getDayOfWeek('2026-05-19'),
    holiday: '',
    meals: [
      { id: 'SH26_051901', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_051902', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_051903', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
  },
  {
    date: '2026-05-20',
    hebrew_date: "ב׳ סיוון",
    dayOfWeek: getDayOfWeek('2026-05-20'),
    holiday: '',
    meals: [
      { id: 'SH26_052001', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_052002', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_052003', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
  },
  {
    date: '2026-05-21',
    hebrew_date: "ג׳ סיוון",
    dayOfWeek: getDayOfWeek('2026-05-21'),
    holiday: '',
    meals: [
      { id: 'SH26_052101', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_052102', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_052103', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
  },
  {
    date: '2026-05-22',
    hebrew_date: "ד׳ סיוון",
    dayOfWeek: getDayOfWeek('2026-05-22'),
    holiday: 'Erev Shabbat',
    meals: [
      { id: 'SH26_052201', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_052202', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_052203', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
    candleLighting: '8:17 PM',
  },
  {
    date: '2026-05-23',
    hebrew_date: "ה׳ סיוון",
    dayOfWeek: getDayOfWeek('2026-05-23'),
    holiday: 'Shabbat',
    meals: [
      { id: 'SH26_052301', name: 'Breakfast', hebrewName: 'ארוחת בוקר' },
      { id: 'SH26_052302', name: 'Lunch', hebrewName: 'ארוחת צהריים' },
      { id: 'SH26_052303', name: 'Dinner', hebrewName: 'ארוחת ערב' },
    ],
    shabbosEnds: '9:21 PM',
  },
];