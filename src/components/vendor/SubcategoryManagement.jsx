
import React, { useState, useEffect } from 'react';
import { Vendor, AdminNotification } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tag, Plus } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export default function SubcategoryManagement({ vendor, onUpdate }) {
    const { t, language } = useLanguage();
    const [subcategories, setSubcategories] = useState(vendor?.subcategories || []);
    const [newSubcategory, setNewSubcategory] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (vendor?.subcategories) {
            setSubcategories(vendor.subcategories);
        }
    }, [vendor?.subcategories]);

    const handleAddSubcategory = async () => {
        if (!newSubcategory.trim()) {
            setError(t('vendor.subcategories.enterSubcategoryName'));
            return;
        }
        
        const trimmedSubcategory = newSubcategory.trim();
        
        if (subcategories.some(s => s.toLowerCase() === trimmedSubcategory.toLowerCase())) {
            setError(t('vendor.subcategories.subcategoryExists'));
            return;
        }
        
        setError("");
        setIsLoading(true);

        try {
            const updatedSubcategories = [...subcategories, trimmedSubcategory];
            await Vendor.update(vendor.id, { subcategories: updatedSubcategories });
            
            setSubcategories(updatedSubcategories);
            setNewSubcategory("");
            
            if (onUpdate) {
                onUpdate({ subcategories: updatedSubcategories });
            }

            // Create admin notification
            try {
                await AdminNotification.create({
                    type: "subcategory_added",
                    title: "New Subcategory Added",
                    message: `${vendor.name} added subcategory: "${trimmedSubcategory}"`,
                    vendor_id: vendor.id,
                    vendor_name: vendor.name,
                    subcategory_name: trimmedSubcategory
                });
            } catch (notificationError) {
                console.error("Failed to create admin notification:", notificationError);
            }
        } catch (err) {
            console.error("Error adding subcategory:", err);
            setError(t('vendor.subcategories.failedToAdd'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAddSubcategory();
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    {t('vendor.subcategories.title')}
                </CardTitle>
                <CardDescription>
                    {t('vendor.subcategories.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder={t('vendor.subcategories.placeholder')}
                            value={newSubcategory}
                            onChange={(e) => {
                                setNewSubcategory(e.target.value);
                                setError("");
                            }}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                        />
                        <Button 
                            onClick={handleAddSubcategory} 
                            disabled={isLoading || !newSubcategory.trim()}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            {isLoading ? t('vendor.subcategories.adding') : t('vendor.subcategories.add')}
                        </Button>
                    </div>
                    
                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <h4 className="font-medium text-sm text-gray-700">
                            {language === 'Hebrew' 
                                ? `תת־קטגוריות נוכחיות (${subcategories.length})`
                                : `${t('vendor.subcategories.currentSubcategories')} (${subcategories.length})`
                            }
                        </h4>
                        {subcategories.length > 0 ? (
                            <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border rounded-lg">
                                {subcategories.map((sub) => (
                                    <Badge key={sub} variant="secondary" className="px-3 py-1.5 text-sm bg-white border-gray-300">
                                        <span>{sub}</span>
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">{t('vendor.subcategories.noSubcategoriesYet')}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
