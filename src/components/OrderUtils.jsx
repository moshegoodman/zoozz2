export function generateOrderNumber(vendorId, householdId) {
  const now = new Date();

  // Format: D<YYMMDD>
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const datePart = `D${year}${month}${day}`;

  // Format: H<HHMM>
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const timePart = `H${hours}${minutes}`;

  // Format: C<Last_4_Digits_Household_ID>
  // Uses '0000' as a fallback if no household ID is provided.
  const householdPart = `C${(householdId || '0000').slice(-4)}`;

  // Format: V<Last_4_Digits_Vendor_ID>
  const vendorPart = `V${(vendorId || '0000').slice(-4)}`;

  // Format: <4_digit_running_number>
  // A timestamp-based number provides a robust and practically sequential number.
  const runningNumber = Date.now().toString().slice(-4).padStart(4, '0');

  return `PO-${datePart}-${timePart}-${householdPart}-${vendorPart}-${runningNumber}`;
}