import React, { useEffect, useState } from 'react';
import { Vendor } from '@/entities/all';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Store } from 'lucide-react';

/**
 * Editor for picking default staff-orderable stores per season.
 * Props:
 *  - seasons: string[] available season codes
 *  - value: array of { season, vendors: [{vendor_id, vendor_name, vendor_name_hebrew}] }
 *  - onChange: (newValue) => void
 */
export default function SeasonDefaultStoresEditor({ seasons, value = [], onChange }) {
    const [vendors, setVendors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSeason, setSelectedSeason] = useState(seasons[0] || '');

    useEffect(() => {
        Vendor.list()
            .then(setVendors)
            .catch((e) => console.error('Failed to load vendors:', e))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (!selectedSeason && seasons.length > 0) {
            setSelectedSeason(seasons[0]);
        }
    }, [seasons, selectedSeason]);

    const currentEntry = value.find((e) => e.season === selectedSeason);
    const selectedVendorIds = (currentEntry?.vendors || []).map((v) => v.vendor_id);

    const handleToggle = (vendor, checked) => {
        const others = value.filter((e) => e.season !== selectedSeason);
        const existing = currentEntry?.vendors || [];
        const updatedVendors = checked
            ? [
                ...existing,
                {
                    vendor_id: vendor.id,
                    vendor_name: vendor.name,
                    vendor_name_hebrew: vendor.name_hebrew || null,
                },
            ]
            : existing.filter((v) => v.vendor_id !== vendor.id);

        const newValue = updatedVendors.length > 0
            ? [...others, { season: selectedSeason, vendors: updatedVendors }]
            : others;

        onChange(newValue);
    };

    if (seasons.length === 0) {
        return (
            <p className="text-sm text-gray-500 italic">
                No seasons found yet. Add a household with a season to enable default stores.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label>Season</Label>
                <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="Select a season..." />
                    </SelectTrigger>
                    <SelectContent>
                        {seasons.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div>
                <Label className="flex items-center gap-2 mb-2">
                    <Store className="w-4 h-4" /> Default staff-orderable stores for {selectedSeason || '—'}
                </Label>
                {isLoading ? (
                    <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></div>
                ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto border rounded p-2">
                        {vendors.map((vendor) => (
                            <div key={vendor.id} className="flex items-center gap-3 p-1.5">
                                <Checkbox
                                    id={`season-default-vendor-${vendor.id}`}
                                    checked={selectedVendorIds.includes(vendor.id)}
                                    onCheckedChange={(checked) => handleToggle(vendor, !!checked)}
                                />
                                <Label htmlFor={`season-default-vendor-${vendor.id}`} className="font-normal cursor-pointer">
                                    {vendor.name}
                                    {vendor.name_hebrew && (
                                        <span className="text-gray-500 mr-2" style={{ direction: 'rtl' }}> ({vendor.name_hebrew})</span>
                                    )}
                                </Label>
                            </div>
                        ))}
                        {vendors.length === 0 && (
                            <p className="text-xs text-gray-500 italic p-2">No vendors found.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}