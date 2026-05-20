import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Store, Loader2 } from 'lucide-react';

/**
 * Modal that lets the admin pick which Vendors a given staff member is
 * authorized to apply AP charges to. Persists to User.authorized_vendor_charge_ids.
 */
export default function StaffVendorChargeEditor({ staff, isOpen, onClose, onSaved }) {
  const [vendors, setVendors] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !staff) return;
    setIsLoading(true);
    base44.entities.Vendor.list()
      .then(v => setVendors(v || []))
      .finally(() => setIsLoading(false));
    setSelectedIds(staff.authorized_vendor_charge_ids || []);
  }, [isOpen, staff]);

  const toggle = (vendorId) => {
    setSelectedIds(prev =>
      prev.includes(vendorId) ? prev.filter(id => id !== vendorId) : [...prev, vendorId]
    );
  };

  const handleSave = async () => {
    if (!staff) return;
    setIsSaving(true);
    try {
      await base44.entities.User.update(staff.id, { authorized_vendor_charge_ids: selectedIds });
      onSaved?.(selectedIds);
      onClose();
    } catch (e) {
      console.error('Failed to save authorized vendors', e);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const staffName = staff?.full_name || staff?.email || 'Staff member';

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-blue-600" />
            AP vendors to bill — {staffName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500 -mt-2">
          Select which vendors this staff member can choose as the "bill to" when creating an AP entry.
        </p>

        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading vendors...
            </div>
          ) : vendors.length === 0 ? (
            <p className="text-sm text-gray-400 italic px-3 py-4 text-center">No vendors found.</p>
          ) : (
            vendors.map(v => (
              <label
                key={v.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selectedIds.includes(v.id)}
                  onCheckedChange={() => toggle(v.id)}
                />
                <span className="flex-1 text-gray-800">
                  {v.name}
                  {v.name_hebrew ? <span className="text-gray-400 ml-1.5"> / {v.name_hebrew}</span> : null}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="text-xs text-gray-500">{selectedIds.length} vendor(s) selected</div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}