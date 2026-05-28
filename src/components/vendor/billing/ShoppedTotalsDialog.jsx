import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function ShoppedTotalsDialog({ isOpen, onClose, totals, conversionRate }) {
  const { t, isRTL } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`sm:max-w-md ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            {t('billing.shoppedTotalsTitle', 'Shopped Items Totals')}
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            {t('billing.onlyShoppedItemsIncluded', 'Only items that were actually supplied/shopped')}
          </p>
        </DialogHeader>

        {totals && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">{t('billing.ordersWithShoppedItems', 'Orders with Shopped Items')}</div>
              <div className="text-2xl font-bold text-blue-900">{totals.totalOrders}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-xs text-blue-600 font-medium mb-1">{t('billing.ilsOrders', 'ILS Orders')}</div>
                <div className="text-lg font-bold text-blue-900">{totals.ilsOrders.count}</div>
                <div className="text-xs text-blue-600 mt-1">{totals.ilsOrders.itemsCount} {t('common.items', 'items')}</div>
                <div className="text-sm text-blue-700 mt-1">₪{totals.ilsOrders.total.toFixed(2)}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-xs text-green-600 font-medium mb-1">{t('billing.usdOrders', 'USD Orders')}</div>
                <div className="text-lg font-bold text-green-900">{totals.usdOrders.count}</div>
                <div className="text-xs text-green-600 mt-1">{totals.usdOrders.itemsCount} {t('common.items', 'items')}</div>
                <div className="text-sm text-green-700 mt-1">${totals.usdOrders.total.toFixed(2)}</div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-2">{t('billing.combinedTotals', 'Combined Totals (All Orders Converted)')}</div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-purple-700 font-medium">{t('billing.totalInILS', 'Total in ILS')}</div>
                  <div className="text-xl font-bold text-purple-900">₪{totals.totalILS.toFixed(2)}</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-green-700 font-medium">{t('billing.totalInUSD', 'Total in USD')}</div>
                  <div className="text-xl font-bold text-green-900">${totals.totalUSD.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 text-center pt-2 border-t">
              {t('billing.conversionNote', 'Conversion rate:')} 1 USD = {conversionRate} ILS
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onClose(false)} variant="outline">{t('common.close', 'Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}