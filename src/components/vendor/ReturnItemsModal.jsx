import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '../i18n/LanguageContext';
import { Loader2 } from 'lucide-react';

export default function ReturnItemsModal({ order, isOpen, onClose, onSave }) {
    const { t, isRTL } = useLanguage();
    const [items, setItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (order?.items) {
            // Initialize local state with a deep copy to handle edits
            setItems(JSON.parse(JSON.stringify(order.items)));
        }
    }, [order]);

    const handleReturnToggle = (index, checked) => {
        const newItems = [...items];
        newItems[index].is_returned = checked;
        // If unchecking, reset the returned amount
        if (!checked) {
            newItems[index].amount_returned = 0;
        }
        setItems(newItems);
    };

    const handleAmountChange = (index, value) => {
        const newItems = [...items];
        const deliveredQty = newItems[index].actual_quantity || 0;
        let returnedAmount = parseFloat(value);
        
        // Handle empty input gracefully
        if (isNaN(returnedAmount)) {
            returnedAmount = 0;
        }

        // Validation: cannot return more than what was delivered or a negative amount
        if (returnedAmount > deliveredQty) {
            returnedAmount = deliveredQty;
        }
        if (returnedAmount < 0) {
            returnedAmount = 0;
        }

        newItems[index].amount_returned = returnedAmount;
        
        // Automatically check the box if a return amount is entered
        if (returnedAmount > 0) {
            newItems[index].is_returned = true;
        }

        setItems(newItems);
    };

    const handleSaveClick = async () => {
        setIsSaving(true);
        try {
            await onSave(items);
            onClose();
        } catch (error) {
            console.error("Failed to save returns:", error);
            alert(t('vendor.returns.saveFailed', 'Failed to save returns. Please try again.'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{t('vendor.returns.title', 'Manage Returns')} - {order.order_number}</DialogTitle>
                    <DialogDescription>
                        {t('vendor.returns.description', 'Select items that were returned and specify the quantity.')}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto my-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('vendor.returns.product', 'Product')}</TableHead>
                                <TableHead className="text-center">{t('vendor.returns.deliveredQty', 'Delivered Qty')}</TableHead>
                                <TableHead className="text-center">{t('vendor.returns.isReturned', 'Returned?')}</TableHead>
                                <TableHead>{t('vendor.returns.returnedQty', 'Returned Qty')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={item.product_id || index}>
                                    <TableCell className="font-medium">
                                        {isRTL ? item.product_name_hebrew || item.product_name : item.product_name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {item.actual_quantity || 0}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={!!item.is_returned}
                                            onCheckedChange={(checked) => handleReturnToggle(index, checked)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={item.amount_returned || ''}
                                            onChange={(e) => handleAmountChange(index, e.target.value)}
                                            disabled={!item.is_returned}
                                            min="0"
                                            max={item.actual_quantity || 0}
                                            className="w-28"
                                            placeholder="0"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>{t('common.cancel', 'Cancel')}</Button>
                    <Button onClick={handleSaveClick} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save Changes')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}