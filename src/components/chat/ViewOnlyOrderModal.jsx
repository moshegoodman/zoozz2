import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, Phone, Clock, User, Calendar } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate } from '../i18n/dateUtils';

export default function ViewOnlyOrderModal({ order, isOpen, onClose }) {
  const { t, language, isRTL } = useLanguage();

  if (!order) return null;

  // Helper function to format price based on order's original currency
  const formatOrderPrice = (amount) => {
    if (amount === null || amount === undefined) return '';
    
    const currency = order.order_currency || 'ILS';
    const currencySymbol = currency === 'USD' ? '$' : '₪';
    
    return `${currencySymbol}${amount.toFixed(2)}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'shopping': return 'bg-yellow-100 text-yellow-800';
      case 'ready_for_shipping': return 'bg-purple-100 text-purple-800';
      case 'delivery': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return t('orderStatus.pending');
      case 'shopping': return t('orderStatus.shopping');
      case 'ready_for_shipping': return t('orderStatus.ready_for_shipping');
      case 'delivery': return t('orderStatus.delivery');
      case 'delivered': return t('orderStatus.delivered');
      case 'cancelled': return t('orderStatus.cancelled');
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              {order.order_number}
            </DialogTitle>
            <Badge className={`${getStatusColor(order.status)} text-xs`}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(new Date(order.created_date), "MMM d, yyyy h:mm a")}
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {order.household_name && (
            <div className="border-l-4 border-blue-500 pl-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm">{t('common.household', 'Household')}</h3>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  {language === 'Hebrew' && order.household_name_hebrew 
                    ? order.household_name_hebrew 
                    : order.household_name}
                </p>
                {order.household_lead_name && (
                  <p className="text-xs">{order.household_lead_name}</p>
                )}
                {order.household_lead_phone && (
                  <p className="text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {order.household_lead_phone}
                  </p>
                )}
              </div>
            </div>
          )}

          <div dir={isRTL?'rtl':'ltr'} className="border-l-4 border-green-500 pl-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <h3 className="font-semibold text-sm">{t('ordersPage.deliveryDetails', 'Delivery Details')}</h3>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              {order.neighborhood && (
                <p><span className="font-medium text-gray-900">{order.neighborhood}</span></p>
              )}
              {order.street && (
                <p>{order.street} {order.building_number}{order.household_number && `, ${t('common.apartment', 'Apt')} ${order.household_number}`}</p>
              )}
              {order.entrance_code && (
                <p>{t('orderManagement.entranceCode', 'Code')}: {order.entrance_code}</p>
              )}
              {order.phone && (
                <p className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {order.phone}
                </p>
              )}
              {order.delivery_time && (
                <p className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {order.delivery_time}
                </p>
              )}
              {order.delivery_notes && (
                <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                  <p className="font-medium text-yellow-800 mb-1">{t('common.notes', 'Notes')}:</p>
                  <p className="text-yellow-700">{order.delivery_notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-l-4 border-purple-500 pl-3 py-2">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-purple-600" />
              <h3 className="font-semibold text-sm">
                {t('ordersPage.itemsHeading', 'Items')} ({order.items?.length || 0})
              </h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {order.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-start gap-3 text-xs p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {language === 'Hebrew' && item.product_name_hebrew 
                        ? item.product_name_hebrew 
                        : item.product_name}
                    </p>
                    <div className="flex items-center gap-2 text-gray-600 mt-1">
                      <span>{item.quantity} {item.unit}</span>
                      {item.actual_quantity !== null && item.actual_quantity !== undefined && (
                        <span className="text-blue-600">→ {item.actual_quantity} {item.unit}</span>
                      )}
                    </div>
                    {item.substitute_product_name && (
                      <p className="text-blue-600 mt-1 text-[10px]">
                        ↻ {item.substitute_product_name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">
                    {formatOrderPrice(item.price * (item.actual_quantity ?? item.quantity))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-l-4 border-green-500 pl-3 py-2">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('ordersPage.itemsTotal', 'Items Total')}:</span>
                <span className="font-medium">{formatOrderPrice((order.total_amount || 0) - (order.delivery_price || 0))}</span>
              </div>
              {order.delivery_price > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('ordersPage.deliveryFee', 'Delivery Fee')}:</span>
                  <span className="font-medium">{formatOrderPrice(order.delivery_price)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1 border-t">
                <span>{t('ordersPage.total', 'Total')}:</span>
                <span className="text-green-600">{formatOrderPrice(order.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}