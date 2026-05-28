import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../i18n/LanguageContext";

export default function StatusEditModal({ isOpen, onOpenChange, newStatus, setNewStatus, onCancel, onSave }) {
  const { t, isRTL } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.orderManagement.changeOrderStatus', 'Change Order Status')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('admin.orderManagement.selectNewStatus', 'Select New Status')}</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t('admin.orderManagement.chooseStatus', 'Choose status...')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t('admin.orderManagement.statusLabels.pending', 'Pending')}</SelectItem>
                <SelectItem value="follow_up">{t('admin.orderManagement.statusLabels.follow_up', 'Follow Up')}</SelectItem>
                <SelectItem value="shopping">{t('admin.orderManagement.statusLabels.shopping', 'Shopping')}</SelectItem>
                <SelectItem value="ready_for_shipping">{t('admin.orderManagement.statusLabels.ready_for_shipping', 'Ready for Shipping')}</SelectItem>
                <SelectItem value="delivery">{t('admin.orderManagement.statusLabels.delivery', 'In Delivery')}</SelectItem>
                <SelectItem value="delivered">{t('admin.orderManagement.statusLabels.delivered', 'Delivered')}</SelectItem>
                <SelectItem value="cancelled">{t('admin.orderManagement.statusLabels.cancelled', 'Cancelled')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {t('admin.orderManagement.statusChangeWarning', 'This will change the status directly without sending notifications or triggering automations.')}
            </p>
          </div>
          <div className={`flex justify-end gap-2 pt-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
            <Button onClick={onSave}>{t('common.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}