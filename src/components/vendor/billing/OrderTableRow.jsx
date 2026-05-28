import React from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Edit2, X, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLanguage } from "../../i18n/LanguageContext";

export default function OrderTableRow({
  order,
  isReturn,
  userType,
  isEditing,
  editingOrderId,
  editFormData,
  isGeneratingPDF,
  paymentStatusOptions,
  paymentMethodOptions,
  generatingSingleInvoice,
  isUpdatingPrices,
  onStatusChange,
  onPaymentMethodChange,
  onEditClick,
  onCancelEdit,
  onSaveEdit,
  onTogglePaid,
  onToggleBilled,
  onOpenPriceEditor,
  onDownloadInvoice,
  onDownloadShoppedOnly,
  onDownloadShoppedOnlyConverted,
  onDownloadReturnNote,
  onDownloadReturnNoteConverted,
  onViewOrderDetails,
  getStatusColor,
  getStatusLabel,
  getCurrencySymbol,
  formatDateUtil,
}) {
  const { t, language, isRTL } = useLanguage();

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="py-3 px-4 text-sm font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => onViewOrderDetails(order)}>
        {order.order_number}
      </td>
      <td className="py-3 px-4 text-sm">{order.created_date ? format(parseISO(order.created_date), 'MMM d, yyyy') : t('common.na')}</td>
      {(userType === 'admin' || userType === 'chief of staff') && <td className="py-3 px-4 text-sm">{order.vendor_name}</td>}
      <td className="py-3 px-4 text-sm">{order.household_name || t('common.na')}</td>
      <td className="py-3 px-4 text-sm font-semibold">{getCurrencySymbol(order)}{(order.total_amount || 0).toFixed(2)}</td>
      {(userType === 'admin' || userType === 'chief of staff') && (
        <td className="py-3 px-4 text-sm">
          {isReturn ? (
            <Badge className={`${getStatusColor(order.status)} border text-xs`}>{getStatusLabel(order.status)}</Badge>
          ) : (
            <Select value={order.status} onValueChange={(val) => onStatusChange(order.id, val)}>
              <SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t('vendor.billing.statusLabels.pending', 'Pending')}</SelectItem>
                <SelectItem value="confirmed">{t('vendor.billing.statusLabels.confirmed', 'Confirmed')}</SelectItem>
                <SelectItem value="shopping">{t('vendor.billing.statusLabels.shopping', 'Shopping')}</SelectItem>
                <SelectItem value="ready_for_shipping">{t('vendor.billing.statusLabels.ready_for_shipping', 'Ready for Shipping')}</SelectItem>
                <SelectItem value="delivery">{t('vendor.billing.statusLabels.delivery', 'In Delivery')}</SelectItem>
                <SelectItem value="delivered">{t('vendor.billing.statusLabels.delivered', 'Delivered')}</SelectItem>
                <SelectItem value="cancelled">{t('vendor.billing.statusLabels.cancelled', 'Cancelled')}</SelectItem>
                <SelectItem value="follow_up">{t('vendor.billing.statusLabels.follow_up', 'Follow Up')}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </td>
      )}
      <td className="py-3 px-4 text-sm">
        {isReturn ? <span className="text-gray-400">-</span> : (
          <Select value={order.payment_status || 'none'} onValueChange={(val) => onPaymentMethodChange(order.id, val === 'none' ? null : val)}>
            <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {paymentStatusOptions.map((option) => (
                <SelectItem key={option} value={option}>{t(`vendor.billing.paymentStatuses.${option}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        {isReturn ? <span className="text-gray-400">-</span> : (
          <input type="checkbox" checked={!!order.for_billing} onChange={(e) => onToggleBilled(order.id, e.target.checked)} className="cursor-pointer" />
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        {isReturn ? <span className="text-gray-400">-</span> : (
          <input type="checkbox" checked={!!order.is_paid} onChange={(e) => onTogglePaid(order.id, e.target.checked)} className="cursor-pointer" />
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        {isReturn ? <span className="text-gray-400">-</span> : (userType === 'admin' || userType === 'chief of staff') ? (
          <Select value={order.payment_method || 'none'} onValueChange={(val) => onPaymentMethodChange(order.id, val === 'none' ? null : val)}>
            <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {paymentMethodOptions.map((option) => (
                <SelectItem key={option} value={option}>{t(`vendor.billing.paymentMethods.${option}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm">{t(`vendor.billing.paymentMethods.${order.payment_method || 'none'}`)}</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm">
        <div className="flex gap-1 flex-wrap">
          {!isReturn && (userType === 'admin' || userType === 'chief of staff') && (
            <Button size="sm" variant="outline" onClick={() => onOpenPriceEditor(order)} disabled={isUpdatingPrices === order.id}>
              {isUpdatingPrices === order.id ? <span className="text-xs">...</span> : <span className="text-xs">₪</span>}
            </Button>
          )}
          {isReturn ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onDownloadReturnNote(order)} disabled={isGeneratingPDF === order.id}>
                {isGeneratingPDF === order.id ? <span className="text-xs animate-spin">⟳</span> : <Download className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDownloadReturnNoteConverted(order)} disabled={isGeneratingPDF === order.id}>
                {isGeneratingPDF === order.id ? <span className="text-xs animate-spin">⟳</span> : <span className="text-xs">$</span>}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => onDownloadInvoice(order)} disabled={generatingSingleInvoice === order.id}>
                {generatingSingleInvoice === order.id ? <span className="text-xs animate-spin">⟳</span> : <Download className="w-3 h-3" />}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDownloadShoppedOnly(order)} disabled={generatingSingleInvoice === order.id}>
                {generatingSingleInvoice === order.id ? <span className="text-xs animate-spin">⟳</span> : <span className="text-xs">S</span>}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDownloadShoppedOnlyConverted(order)} disabled={generatingSingleInvoice === order.id}>
                {generatingSingleInvoice === order.id ? <span className="text-xs animate-spin">⟳</span> : <span className="text-xs">S$</span>}
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}