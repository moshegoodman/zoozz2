import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Order } from '@/entities/all';

/**
 * Modal for admins to edit order item prices, delivery fee, and VAT rate.
 *
 * Props:
 *  - order: the order being edited (null = closed)
 *  - language: 'Hebrew' | 'English'
 *  - t: translation function
 *  - formatDeliveryTime: helper to format the delivery time string
 *  - onClose: () => void
 *  - onSaved: () => Promise<void> | void  (called after a successful save)
 */
export default function PriceEditorModal({ order, language, t, formatDeliveryTime, onClose, onSaved }) {
  const [editedPrices, setEditedPrices] = useState({});
  const [editedDeliveryPrice, setEditedDeliveryPrice] = useState(0);
  const [editedVatRate, setEditedVatRate] = useState(18); // percentage
  const [isSaving, setIsSaving] = useState(false);

  // Initialize when the order changes
  useEffect(() => {
    if (!order) return;
    const initial = {};
    // Key by line-item index (not product_id) — duplicate or empty product_ids would otherwise collide and overwrite each other on save.
    (order.items || []).forEach((item, idx) => { initial[idx] = item.price; });
    setEditedPrices(initial);
    setEditedDeliveryPrice(order.delivery_price || 0);
    // vat_rate stored as a fraction (e.g. 0.18). Convert to percentage for the UI.
    const stored = order.vat_rate;
    setEditedVatRate((stored !== null && stored !== undefined) ? Number(stored) * 100 : 18);
  }, [order]);

  if (!order) return null;

  const handlePriceChange = (index, newPrice) => {
    setEditedPrices(prev => ({ ...prev, [index]: parseFloat(newPrice) || 0 }));
  };

  const itemsSubtotal = (order.items || []).reduce((sum, item, idx) => {
    const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : item.quantity;
    const price = editedPrices[idx] !== undefined ? editedPrices[idx] : item.price;
    return sum + (price * quantity);
  }, 0);

  const preVatTotal = itemsSubtotal + editedDeliveryPrice;
  const vatFraction = (parseFloat(editedVatRate) || 0) / 100;
  const vatAmount = preVatTotal * vatFraction;
  const grandTotal = preVatTotal + vatAmount;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedItems = (order.items || []).map((item, idx) => ({
        ...item,
        price: editedPrices[idx] !== undefined ? editedPrices[idx] : item.price,
      }));

      await Order.update(order.id, {
        items: updatedItems,
        delivery_price: editedDeliveryPrice,
        vat_rate: vatFraction,
        total_amount: grandTotal,
      });

      if (onSaved) await onSaved();
      onClose();
    } catch (error) {
      console.error('Error updating prices:', error);
      alert(t('vendor.billing.pricesUpdateFailed', 'Failed to update prices.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('vendor.billing.editItemPrices', 'Edit Item Prices')} - {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            <p><strong>{t('vendor.billing.household', 'Household')}:</strong> {order.household_name}</p>
            <p><strong>{t('vendor.billing.deliveryDate', 'Delivery Date')}:</strong> {order.delivery_time ? formatDeliveryTime(order.delivery_time, language) : t('common.notSet')}</p>
          </div>

          <div className="border rounded-lg divide-y">
            {(order.items || []).map((item, index) => {
              const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined) ? item.actual_quantity : item.quantity;
              const currentPrice = editedPrices[index] !== undefined ? editedPrices[index] : item.price;
              const itemTotal = currentPrice * quantity;
              return (
                <div key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold">{language === 'Hebrew' && item.product_name_hebrew ? item.product_name_hebrew : item.product_name}</p>
                      <p className="text-sm text-gray-600">
                        {t('vendor.billing.quantity', 'Quantity')}: {quantity} {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div>
                        <Label htmlFor={`price-${index}`} className="text-xs text-gray-600">
                          {t('vendor.billing.pricePerUnit', 'Price/Unit')}
                        </Label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm">₪</span>
                          <Input
                            id={`price-${index}`}
                            type="number"
                            step="0.01"
                            value={currentPrice}
                            onChange={(e) => handlePriceChange(index, e.target.value)}
                            className="w-24"
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">{t('vendor.billing.total', 'Total')}</p>
                        <p className="font-semibold text-green-600">₪{itemTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Delivery Cost Editor */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="delivery-price" className="text-sm font-semibold text-gray-700">
                  {t('vendor.billing.deliveryCost', 'Delivery Cost')}
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  {t('vendor.billing.deliveryCostDescription', 'Adjust the delivery fee for this order')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold">₪</span>
                <Input
                  id="delivery-price"
                  type="number"
                  step="0.01"
                  value={editedDeliveryPrice}
                  onChange={(e) => setEditedDeliveryPrice(parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
              </div>
            </div>
          </div>

          {/* VAT Rate Editor */}
          <div className="border rounded-lg p-4 bg-amber-50">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="vat-rate" className="text-sm font-semibold text-gray-700">
                  {t('vendor.billing.vatRate', 'VAT Rate')}
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  {t('vendor.billing.vatRateDescription', 'Adjust the VAT percentage applied on top of items + delivery.')}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="vat-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editedVatRate}
                  onChange={(e) => setEditedVatRate(parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-sm font-semibold">%</span>
              </div>
            </div>
          </div>

          {/* Order Total Summary */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('vendor.billing.itemsTotal', 'Items Total')}:</span>
              <span className="font-semibold">₪{itemsSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('vendor.billing.deliveryFee', 'Delivery Fee')}:</span>
              <span className="font-semibold">₪{editedDeliveryPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>{t('vendor.billing.vat', 'VAT')} ({(parseFloat(editedVatRate) || 0).toFixed(2)}%):</span>
              <span className="font-semibold">₪{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>{t('vendor.billing.newTotal', 'New Total')}:</span>
              <span className="text-green-600">₪{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2"></div>
                {t('common.saving', 'Saving...')}
              </>
            ) : (
              t('common.save', 'Save Changes')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}