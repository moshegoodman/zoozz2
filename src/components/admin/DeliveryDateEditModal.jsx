import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from 'date-fns';
import { useLanguage } from "../i18n/LanguageContext";

export default function DeliveryDateEditModal({
  isOpen,
  onOpenChange,
  newDeliveryDate,
  setNewDeliveryDate,
  onCancel,
  onSave,
}) {
  const { t, isRTL } = useLanguage();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('vendor.orderManagement.editDeliveryDate', 'Edit Delivery Date')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col space-y-4">
            <Calendar
              mode="single"
              selected={newDeliveryDate ? new Date(newDeliveryDate.split(' ')[0]) : undefined}
              onSelect={(date) => {
                if (date) {
                  const timepart = newDeliveryDate && newDeliveryDate.includes(' ') 
                    ? newDeliveryDate.split(' ').slice(1).join(' ') 
                    : '09:00-17:00';
                  const formattedDate = format(date, 'yyyy-MM-dd');
                  setNewDeliveryDate(`${formattedDate} ${timepart}`);
                }
              }}
              className="rounded-md border"
            />
            <Input
              value={newDeliveryDate}
              onChange={(e) => setNewDeliveryDate(e.target.value)}
              placeholder="2025-01-15 09:00-17:00"
              className="w-full"
            />
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