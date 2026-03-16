// Shared translation keys and objects used across multiple sections
// This reduces duplication across admin, vendor, and billing sections

export const getSharedTranslations = (lang) => {
  const isHebrew = lang === 'Hebrew';

  // Day labels
  const days = {
    sunday: isHebrew ? "ראשון" : "Sunday",
    monday: isHebrew ? "שני" : "Monday",
    tuesday: isHebrew ? "שלישי" : "Tuesday",
    wednesday: isHebrew ? "רביעי" : "Wednesday",
    thursday: isHebrew ? "חמישי" : "Thursday",
    friday: isHebrew ? "שישי" : "Friday",
    saturday: isHebrew ? "שבת" : "Saturday",
    shabbos: isHebrew ? "שבת" : "Shabbos"
  };

  // Meal labels
  const meals = {
    breakfast: isHebrew ? "ארוחת בוקר" : "Breakfast",
    lunch: isHebrew ? "ארוחת צהריים" : "Lunch",
    dinner: isHebrew ? "ארוחת ערב" : "Dinner",
    snack: isHebrew ? "חטיף / ביניים" : "Snack / In-Between"
  };

  // Payment statuses
  const paymentStatuses = {
    client: isHebrew ? "לקוח" : "Client",
    kcs: isHebrew ? "KCS" : "KCS",
    denied: isHebrew ? "נדחה" : "Denied",
    none: isHebrew ? "ללא" : "None"
  };

  // Payment methods
  const paymentMethods = {
    kcs_cash: isHebrew ? "מזומן KCS" : "KCS Cash",
    aviCC: isHebrew ? "כרטיס אשראי אבי" : "Avi CC",
    meirCC: isHebrew ? "כרטיס אשראי מאיר" : "Meir CC",
    chaimCC: isHebrew ? "כרטיס אשראי חיים" : "Chaim CC",
    clientCC: isHebrew ? "כרטיס אשראי לקוח" : "Client CC",
    kcsBankTransfer: isHebrew ? "העברה בנקאית KCS" : "KCS Bank Transfer",
    none: isHebrew ? "ללא" : "None"
  };

  // Order status labels
  const orderStatusLabels = {
    temp: isHebrew ? "זמני" : "Temporary",
    follow_up: isHebrew ? "הזמנת השלמה" : "Follow-Up Order",
    pending: isHebrew ? "ממתינה" : "Pending",
    confirmed: isHebrew ? "מאושרת" : "Confirmed",
    shopping: isHebrew ? "בליקוט" : "Shopping",
    ready_for_shipping: isHebrew ? "מוכנה למשלוח" : "Ready for Shipping",
    delivery: isHebrew ? "במשלוח" : "Out for Delivery",
    delivered: isHebrew ? "נמסרה" : "Delivered",
    cancelled: isHebrew ? "בוטלה" : "Cancelled",
    return_processed: isHebrew ? "return processed" : "return processed"
  };

  // Status filters
  const statusFilter = {
    ready_for_shipping: isHebrew ? "מוכן למשלוח" : "Ready for Shipping",
    delivery: isHebrew ? "במשלוח" : "In Delivery",
    delivered: isHebrew ? "נמסר" : "Delivered"
  };

  // Job roles
  const jobRoles = {
    chef: isHebrew ? "שף" : "Chef",
    cook: isHebrew ? "טבח" : "Cook",
    houseManager: isHebrew ? "מנהל בית" : "House Manager",
    householdManager: isHebrew ? "מנהל משק בית" : "Household Manager",
    waiter: isHebrew ? "מלצר" : "Waiter",
    housekeeping: isHebrew ? "משק בית" : "Housekeeping"
  };

  // Units of measurement
  const uom = {
    each: isHebrew ? "יחידה" : "each",
    unit: isHebrew ? "יחידה" : "unit",
    lb: isHebrew ? "ליברה" : "lb",
    oz: isHebrew ? "אונקיה" : "oz",
    kg: isHebrew ? 'ק"ג' : "kg",
    pack: isHebrew ? "חבילה" : "pack",
    bottle: isHebrew ? "בקבוק" : "bottle",
    box: isHebrew ? "קופסה" : "box",
    bag: isHebrew ? "שקית" : "bag"
  };

  // Common buttons/actions
  const common = {
    save: isHebrew ? "שמור" : "Save",
    cancel: isHebrew ? "ביטול" : "Cancel",
    delete: isHebrew ? "מחק" : "Delete",
    edit: isHebrew ? "ערוך" : "Edit",
    add: isHebrew ? "הוסף" : "Add",
    close: isHebrew ? "סגור" : "Close",
    update: isHebrew ? "עדכן" : "Update",
    submit: isHebrew ? "שלח" : "Submit",
    loading: isHebrew ? "טוען..." : "Loading...",
    saving: isHebrew ? "שומר..." : "Saving...",
    yes: isHebrew ? "כן" : "Yes",
    no: isHebrew ? "לא" : "No",
    all: isHebrew ? "הכל" : "All",
    search: isHebrew ? "חיפוש..." : "Search...",
    status: isHebrew ? "סטטוס" : "Status",
    actions: isHebrew ? "פעולות" : "Actions",
    total: isHebrew ? 'סה"כ' : "Total",
    price: isHebrew ? "מחיר" : "Price",
    quantity: isHebrew ? "כמות" : "Quantity",
    name: isHebrew ? "שם" : "Name",
    phone: isHebrew ? "טלפון" : "Phone",
    email: isHebrew ? "אימייל" : "Email",
    address: isHebrew ? "כתובת" : "Address",
    notes: isHebrew ? "הערות" : "Notes",
    description: isHebrew ? "תיאור" : "Description",
    amount: isHebrew ? "סכום" : "Amount",
    date: isHebrew ? "תאריך" : "Date",
    view: isHebrew ? "צפה" : "View",
    error: isHebrew ? "אירעה שגיאה לא צפויה." : "An unexpected error occurred.",
    success: isHebrew ? "הפעולה הושלמה בהצלחה!" : "Operation completed successfully!"
  };

  return {
    days,
    meals,
    paymentStatuses,
    paymentMethods,
    orderStatusLabels,
    statusFilter,
    jobRoles,
    uom,
    common
  };
};