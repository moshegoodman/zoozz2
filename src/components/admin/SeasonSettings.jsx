import React, { useState, useEffect } from 'react';
import { AppSettings, Household } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Loader2 } from 'lucide-react';

export default function SeasonSettings() {
    const [settings, setSettings] = useState(null);
    const [activeSeason, setActiveSeason] = useState('');
    const [availableSeasons, setAvailableSeasons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [settingsList, households] = await Promise.all([
                AppSettings.list(),
                Household.list()
            ]);

            // Extract unique seasons from households
            const seasons = [...new Set(
                households
                    .map(h => h.season)
                    .filter(Boolean)
            )].sort();
            setAvailableSeasons(seasons);

            if (settingsList.length > 0) {
                setSettings(settingsList[0]);
                setActiveSeason(settingsList[0].activeSeason || '');
            } else {
                const newSettings = await AppSettings.create({ activeSeason: '' });
                setSettings(newSettings);
                setActiveSeason('');
            }
        } catch (error) {
            console.error("Error loading season settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (settings) {
                const updated = await AppSettings.update(settings.id, { activeSeason });
                setSettings(updated);
            } else {
                const newSettings = await AppSettings.create({ activeSeason });
                setSettings(newSettings);
            }
            alert('Season settings saved successfully!');
        } catch (error) {
            console.error('Error saving season settings:', error);
            alert('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Active Season Filter
                </CardTitle>
                <CardDescription>
                    Set the current season. Only orders from households belonging to this season will be shown to all users. Admins can override this filter in the orders view.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Current Active Season</Label>
                    <Select value={activeSeason || '__all__'} onValueChange={(val) => setActiveSeason(val === '__all__' ? '' : val)}>
                        <SelectTrigger className="w-64">
                            <SelectValue placeholder="Select a season..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">All Seasons (no filter)</SelectItem>
                            {availableSeasons.map(season => (
                                <SelectItem key={season} value={season}>
                                    {season}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                        Seasons are automatically detected from your households' season field.
                        {availableSeasons.length === 0 && ' No seasons found — make sure households have a season set.'}
                    </p>
                </div>

                <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <p className="text-sm text-blue-800">
                        <strong>Currently active: </strong>
                        {activeSeason ? (
                            <span className="font-semibold">{activeSeason}</span>
                        ) : (
                            <span className="italic">All seasons (no filter applied)</span>
                        )}
                    </p>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-green-600 hover:bg-green-700"
                >
                    {isSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    ) : (
                        'Save Season Settings'
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}