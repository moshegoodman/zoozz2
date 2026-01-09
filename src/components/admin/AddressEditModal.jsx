import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '../i18n/LanguageContext';
import { Household } from '@/entities/Household';
import { Loader2 } from 'lucide-react';

export default function AddressEditModal({ household, isOpen, onClose, onSave }) {
  const { t } = useLanguage();
  const [addressData, setAddressData] = useState({
    neighborhood: '',
    street: '',
    building_number: '',
    household_number: '',
    entrance_code: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (household) {
      setAddressData({
        neighborhood: household.neighborhood || '',
        street: household.street || '',
        building_number: household.building_number || '',
        household_number: household.household_number || '',
        entrance_code: household.entrance_code || '',
      });
    }
  }, [household]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setAddressData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveChanges = async () => {
    if (!household) return;
    setIsSaving(true);
    try {
      await Household.update(household.id, addressData);
      onSave(); // This will trigger a refresh and close the modal in the parent
    } catch (error) {
      console.error('Failed to save address:', error);
      alert(t('admin.addressEditModal.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!household) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('admin.addressEditModal.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.addressEditModal.description', { householdName: household.name })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="neighborhood" className="text-right">
              {t('admin.addressEditModal.neighborhood')}
            </Label>
            <Input
              id="neighborhood"
              name="neighborhood"
              value={addressData.neighborhood}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="street" className="text-right">
              {t('admin.addressEditModal.street')}
            </Label>
            <Input
              id="street"
              name="street"
              value={addressData.street}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="building_number" className="text-right">
              {t('admin.addressEditModal.building')}
            </Label>
            <Input
              id="building_number"
              name="building_number"
              value={addressData.building_number}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="household_number" className="text-right">
              {t('admin.addressEditModal.apartment')}
            </Label>
            <Input
              id="household_number"
              name="household_number"
              value={addressData.household_number}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="entrance_code" className="text-right">
              {t('admin.addressEditModal.code')}
            </Label>
            <Input
              id="entrance_code"
              name="entrance_code"
              value={addressData.entrance_code}
              onChange={handleChange}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? t('common.saving') : t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}