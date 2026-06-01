// Shared helper to compute an order's live cost-with-VAT total.
// Mirrors the PO/invoice PDF formula so Order Matrix, Vendor Billing, and PDF
// exports all show the same number for a given order.
//
//   subtotal = Σ(delivered qty × price) over available, non-returned items
//   + delivery_price
//   + VAT on top when the vendor stores NET prices (vendor.has_vat === false).
//
// Order-level `vat_rate` overrides the default 18%.
export function computeOrderTotalWithVat(order, vendor) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const itemsSubtotal = items.reduce((sum, item) => {
    if (item.available === false) return sum;
    const qty = (item.actual_quantity !== null && item.actual_quantity !== undefined)
      ? item.actual_quantity
      : (item.quantity || 0);
    if (qty <= 0) return sum;
    return sum + qty * (Number(item.price) || 0);
  }, 0);
  const preVat = itemsSubtotal + (Number(order?.delivery_price) || 0);
  const vendorHasVat = vendor ? vendor.has_vat !== false : true;
  const rate = (order?.vat_rate != null) ? order.vat_rate : 0.18;
  return vendorHasVat ? preVat : preVat * (1 + rate);
}