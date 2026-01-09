import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import DeliverySchedule from '../vendor/DeliverySchedule';
import { useLanguage } from '../i18n/LanguageContext';
import { Truck, Users, Edit } from 'lucide-react';
import { Vendor } from '@/entities/Vendor';

export default function AdminDeliveryScheduleManagement({ vendors, onVendorUpdate }) {
  const { t } = useLanguage();
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [bulkSelectedVendorIds, setBulkSelectedVendorIds] = useState([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('single');

  const selectedVendor = useMemo(() => 
    vendors.find(v => v.id === selectedVendorId), 
    [vendors, selectedVendorId]
  );
  
  const handleVendorUpdate = () => {
    if (onVendorUpdate) {
        onVendorUpdate();
    }
  }

  const handleBulkSelectChange = (vendorId, isChecked) => {
    setBulkSelectedVendorIds(prev => 
      isChecked ? [...prev, vendorId] : prev.filter(id => id !== vendorId)
    );
  };

  const handleSelectAll = () => {
    if (bulkSelectedVendorIds.length === vendors.length) {
      setBulkSelectedVendorIds([]);
    } else {
      setBulkSelectedVendorIds(vendors.map(v => v.id));
    }
  };

  const handleBulkSave = async (newSchedule) => {
    if (bulkSelectedVendorIds.length === 0) {
      alert(t('admin.deliverySchedule.noVendorsSelectedWarning'));
      return;
    }
    if (!window.confirm(t('admin.deliverySchedule.bulkSaveConfirm', { count: bulkSelectedVendorIds.length }))) {
        return;
    }

    setIsBulkSaving(true);
    try {
      const promises = bulkSelectedVendorIds.map(vendorId =>
        Vendor.update(vendorId, { detailed_schedule: newSchedule })
      );
      await Promise.all(promises);
      alert(t('admin.deliverySchedule.bulkSaveSuccess', { count: bulkSelectedVendorIds.length }));
      setBulkSelectedVendorIds([]);
      if (onVendorUpdate) onVendorUpdate();
    } catch (error) {
      console.error("Error during bulk schedule update:", error);
      alert(t('admin.deliverySchedule.bulkSaveError'));
    } finally {
      setIsBulkSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.deliverySchedule.title')}</CardTitle>
        <CardDescription>{t('admin.deliverySchedule.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">
              <Edit className="w-4 h-4 mr-2" />
              {t('admin.deliverySchedule.editSingle')}
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <Users className="w-4 h-4 mr-2" />
              {t('admin.deliverySchedule.bulkCreate')}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="single" className="mt-6">
            <div className="mb-8 max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.deliverySchedule.selectVendorLabel')}</label>
              <Select onValueChange={setSelectedVendorId} value={selectedVendorId || ''}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.deliverySchedule.selectVendorPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedVendor ? (
              <DeliverySchedule vendor={selectedVendor} onUpdate={handleVendorUpdate} />
            ) : (
              <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg">
                <Truck className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="font-semibold">{t('admin.deliverySchedule.pleaseSelect')}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bulk" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="font-semibold mb-3">{t('admin.deliverySchedule.selectVendorsForBulk')}</h3>
                <div className="p-4 border rounded-lg bg-gray-50 max-h-96 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b">
                        <label className="text-sm font-medium">{t('admin.deliverySchedule.selectedCount', { count: bulkSelectedVendorIds.length })}</label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                        >
                            {bulkSelectedVendorIds.length === vendors.length ? t('admin.deliverySchedule.deselectAll') : t('admin.deliverySchedule.selectAll')}
                        </Button>
                    </div>
                  <div className="space-y-3">
                    {vendors.map(vendor => (
                      <div key={vendor.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`vendor-${vendor.id}`}
                          checked={bulkSelectedVendorIds.includes(vendor.id)}
                          onCheckedChange={(checked) => handleBulkSelectChange(vendor.id, checked)}
                        />
                        <label
                          htmlFor={`vendor-${vendor.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {vendor.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-3">{t('admin.deliverySchedule.createSchedule')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('admin.deliverySchedule.bulkDescription')}</p>
                <DeliverySchedule 
                    isTemplateMode={true}
                    onApplyTemplate={handleBulkSave}
                    isSaving={isBulkSaving}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}