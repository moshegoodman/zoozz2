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
import { base44 } from '@/api/base44Client';
import { Loader2, Search, MapPin } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Look up this exact address on Google Maps and return its standardized components: "${searchQuery}". Return the real, verified address. If the address is in Israel, prefer Hebrew street names. Return only the parts found - leave fields empty if not applicable.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            neighborhood: { type: 'string', description: 'Neighborhood or city/town name' },
            street: { type: 'string', description: 'Street name only, without the number' },
            building_number: { type: 'string', description: 'Building or house number only' },
            found: { type: 'boolean', description: 'True if a real address was found' }
          },
          required: ['found']
        }
      });

      if (result?.found) {
        setAddressData((prev) => ({
          ...prev,
          neighborhood: result.neighborhood || prev.neighborhood,
          street: result.street || prev.street,
          building_number: result.building_number || prev.building_number,
        }));
      } else {
        setSearchError(t('admin.addressEditModal.notFound') || 'Address not found. Please try again.');
      }
    } catch (error) {
      console.error('Address search failed:', error);
      setSearchError(t('admin.addressEditModal.searchError') || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

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
          <div className="border rounded-lg p-3 bg-blue-50 border-blue-200">
            <Label className="flex items-center gap-1 text-sm font-medium text-blue-900 mb-2">
              <MapPin className="w-4 h-4" />
              {t('admin.addressEditModal.searchLabel') || 'Search address on Google'}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('admin.addressEditModal.searchPlaceholder') || 'e.g. 123 Main St, Jerusalem'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddressSearch();
                  }
                }}
                disabled={isSearching}
                className="bg-white"
              />
              <Button
                type="button"
                onClick={handleAddressSearch}
                disabled={isSearching || !searchQuery.trim()}
                size="sm"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {searchError && <p className="text-xs text-red-600 mt-1">{searchError}</p>}
            <p className="text-xs text-blue-700 mt-1">
              {t('admin.addressEditModal.searchHint') || 'Auto-fills fields below. You can still edit them.'}
            </p>
          </div>
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