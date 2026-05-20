import React, { useEffect, useState } from 'react';
import { Vendor, Household } from '@/entities/all';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Store, Wand2 } from 'lucide-react';

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

    const currentEntry = value.find((e) => (e.season || '').trim().toUpperCase() === (selectedSeason || '').trim().toUpperCase());
    const selectedVendorIds = (currentEntry?.vendors || []).map((v) => v.vendor_id);
    const [isApplying, setIsApplying] = useState(false);

    const handleApplyToHouseholds = async () => {
        const defaults = currentEntry?.vendors || [];
        if (defaults.length === 0) {
            alert(`No default stores selected for season ${selectedSeason}. Pick at least one store first.`);
            return;
        }
        try {
            setIsApplying(true);
            const householdsInSeason = await Household.filter({ season: selectedSeason });
            if (!householdsInSeason || householdsInSeason.length === 0) {
                alert(`No households found for season ${selectedSeason}.`);
                return;
            }
            if (!window.confirm(
                `Replace staff-orderable stores on ${householdsInSeason.length} household(s) in season ${selectedSeason} with the ${defaults.length} default store(s)?\n\nThis will overwrite each household's existing staff-orderable stores.`
            )) {
                return;
            }
            await Promise.all(householdsInSeason.map((h) =>
                Household.update(h.id, { staff_orderable_vendors: defaults })
            ));
            alert(`Applied default stores to ${householdsInSeason.length} household(s) in season ${selectedSeason}.`);
        } catch (e) {
            console.error('Failed to apply default stores to households:', e);
            alert('Failed to apply default stores. Please try again.');
        } finally {
            setIsApplying(false);
        }
    };

    const handleToggle = (vendor, checked) => {
        const targetKey = (selectedSeason || '').trim().toUpperCase();
        const others = value.filter((e) => (e.season || '').trim().toUpperCase() !== targetKey);
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
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <Label className="flex items-center gap-2">
                        <Store className="w-4 h-4" /> Default staff-orderable stores for {selectedSeason || '—'}
                    </Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleApplyToHouseholds}
                        disabled={isApplying || !selectedSeason}
                        className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                        title={`Apply these defaults to every household in season ${selectedSeason}`}
                    >
                        {isApplying ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
                        Apply to All Households in {selectedSeason || 'Season'}
                    </Button>
                </div>
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