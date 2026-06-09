import { base44 } from "@/api/base44Client";

// Sends a payment-confirmation email to the employee AND to the person who
// logged the payment (the current authenticated user). Used by both
// PayrollPayments and QuickPaymentModal so the behavior stays in sync.
export async function sendPaymentConfirmationEmails({
  employee,
  amount,
  currency,
  paymentDate,
  paymentMethod,
  season,
  notes,
}) {
  if (!amount) return;
  const me = await base44.auth.me().catch(() => null);

  const symbol = currency === "USD" ? "$" : "₪";
  const amountStr = `${symbol}${parseFloat(amount).toFixed(2)}`;
  const methodStr = (paymentMethod || "").replace(/_/g, " ");

  const buildBody = (greetingLine) => `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #059669;">Payment Confirmation</h2>
      <p>${greetingLine}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Employee</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${employee?.full_name || employee?.email || ""}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Amount</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${amountStr}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Currency</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${currency}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Payment Date</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${paymentDate}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Method</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${methodStr}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Season</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${season || "—"}</td></tr>
        ${notes ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Notes</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${notes}</td></tr>` : ""}
      </table>
      <p style="color: #6b7280; font-size: 13px;">— Zoozz Payroll</p>
    </div>
  `;

  // Send a single email to the employee, CC'ing the person who logged the payment.
  if (employee?.email) {
    try {
      await base44.functions.invoke("sendGridEmail", {
        to: employee.email,
        cc: me?.email && me.email !== employee.email ? [me.email] : [],
        subject: `Payment confirmation — ${amountStr}`,
        body: buildBody(`Hi ${employee.full_name || ""},<br/>A payment has been logged for you. Here are the details:`),
        context: "payroll_payment_logged",
      });
    } catch (err) {
      console.error("Failed to send payment confirmation email:", err);
    }
  }
}