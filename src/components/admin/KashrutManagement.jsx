
import React, { useState, useEffect } from 'react';
import { KashrutOption } from '@/entities/KashrutOption';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Save, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useLanguage } from '../i18n/LanguageContext';

export default function KashrutManagement() {
    const { t } = useLanguage();
    const [options, setOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingOption, setEditingOption] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        name_hebrew: '',
        is_active: true
    });

    useEffect(() => {
        loadOptions();
    }, []);

    const loadOptions = async () => {
        setIsLoading(true);
        try {
            const data = await KashrutOption.list('display_order');
            setOptions(data);
        } catch (error) {
            console.error("Error loading kashrut options:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const openDialog = (option = null) => {
        if (option) {
            setEditingOption(option);
            setFormData({
                name: option.name,
                name_hebrew: option.name_hebrew || '',
                is_active: option.is_active !== false
            });
        } else {
            setEditingOption(null);
            setFormData({
                name: '',
                name_hebrew: '',
                is_active: true
            });
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert('Name is required.');
            return;
        }

        try {
            const dataToSave = {
                ...formData,
                name: formData.name.trim(),
                name_hebrew: formData.name_hebrew.trim() || null,
            };

            if (editingOption) {
                await KashrutOption.update(editingOption.id, dataToSave);
            } else {
                // Auto-generate value and set display order for new items
                const value = formData.name.toLowerCase().replace(/\s+/g, '_');
                await KashrutOption.create({
                    ...dataToSave,
                    value: value,
                    display_order: options.length,
                });
            }

            setIsDialogOpen(false);
            loadOptions();
        } catch (error) {
            console.error("Error saving kashrut option:", error);
            alert("Failed to save kashrut option.");
        }
    };

    const handleDelete = async (optionId) => {
        if (window.confirm(t('admin.kashrutManagement.deleteConfirm'))) {
            try {
                await KashrutOption.delete(optionId);
                loadOptions();
            } catch (error) {
                console.error("Error deleting kashrut option:", error);
                alert("Failed to delete kashrut option.");
            }
        }
    };

    const onDragEnd = async (result) => {
        if (!result.destination) {
            return;
        }

        const reorderedOptions = Array.from(options);
        const [movedItem] = reorderedOptions.splice(result.source.index, 1);
        reorderedOptions.splice(result.destination.index, 0, movedItem);

        // Update state immediately for a smooth user experience
        setOptions(reorderedOptions);

        // Update the display_order for all items in the database
        const updatePromises = reorderedOptions.map((option, index) =>
            KashrutOption.update(option.id, { display_order: index })
        );

        try {
            await Promise.all(updatePromises);
        } catch (error) {
            console.error("Failed to save new order:", error);
            alert("Could not save new order. Please refresh and try again.");
            // Revert state if the API call fails
            loadOptions();
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>{t('admin.kashrutManagement.title')}</CardTitle>
                        <CardDescription>
                            {t('admin.kashrutManagement.description')}
                        </CardDescription>
                    </div>
                    <Button onClick={() => openDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        {t('admin.kashrutManagement.addOption')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p>{t('admin.kashrutManagement.loading')}</p>
                ) : (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="kashrut-options">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                                    {options.map((option, index) => (
                                        <Draggable key={option.id} draggableId={option.id} index={index}>
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-gray-50 shadow-sm"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{option.name}</span>
                                                                {option.name_hebrew && (
                                                                    <span className="text-gray-600" style={{ direction: 'rtl' }}>
                                                                        ({option.name_hebrew})
                                                                    </span>
                                                                )}
                                                                {!option.is_active && (
                                                                    <Badge variant="secondary">Inactive</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => openDialog(option)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(option.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                    {options.length === 0 && (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500">{t('admin.kashrutManagement.noOptions')}</p>
                                            <p className="text-sm text-gray-400">{t('admin.kashrutManagement.noOptionsDesc')}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                )}

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingOption ? t('admin.kashrutManagement.editTitle') : t('admin.kashrutManagement.addTitle')}
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="name">{t('admin.kashrutManagement.nameEn')}</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder={t('admin.kashrutManagement.nameEnPlaceholder')}
                                    disabled={!!editingOption} // Internal value depends on name, so prevent editing name after creation.
                                />
                                {editingOption && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {t('admin.kashrutManagement.nameChangeWarning')}
                                    </p>
                                )}
                            </div>
                            
                            <div>
                                <Label htmlFor="name_hebrew">{t('admin.kashrutManagement.nameHe')}</Label>
                                <Input
                                    id="name_hebrew"
                                    value={formData.name_hebrew}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name_hebrew: e.target.value }))}
                                    placeholder={t('admin.kashrutManagement.nameHePlaceholder')}
                                    style={{ direction: 'rtl' }}
                                />
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                                />
                                <Label htmlFor="is_active">{t('admin.kashrutManagement.active')}</Label>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSave}>
                                <Save className="w-4 h-4 mr-2" />
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
