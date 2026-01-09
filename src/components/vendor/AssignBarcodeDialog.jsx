import React, { useState, useMemo } from 'react';
import { Product } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '../i18n/LanguageContext';
import { Loader2, Link, PlusCircle, Search } from 'lucide-react';

export default function AssignBarcodeDialog({
    isOpen,
    onClose,
    scannedBarcode,
    vendorId,
    products,
    onAssignSuccess,
    onCreateNew
}) {
    const { t, language, isRTL } = useLanguage();
    const [view, setView] = useState('options'); // 'options' or 'assign'
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const query = searchTerm.toLowerCase();
        return products.filter(p =>
            p.name?.toLowerCase().includes(query) ||
            p.name_hebrew?.toLowerCase().includes(query) ||
            p.sku?.toLowerCase().includes(query)
        );
    }, [products, searchTerm]);

    const handleAssign = async () => {
        if (!selectedProductId) return;
        setIsSaving(true);
        try {
            const productToUpdate = products.find(p => p.id === selectedProductId);
            if (productToUpdate) {
                const updatedProductData = { ...productToUpdate, barcode: scannedBarcode };
                await Product.update(selectedProductId, { barcode: scannedBarcode });
                onAssignSuccess(updatedProductData);
            }
        } catch (error) {
            console.error("Error assigning barcode:", error);
        } finally {
            setIsSaving(false);
            handleClose();
        }
    };

    const handleClose = () => {
        setView('options');
        setSearchTerm('');
        setSelectedProductId(null);
        onClose();
    };

    const renderOptionsView = () => (
        <div className="pt-4 space-y-4">
            <Button onClick={() => setView('assign')} className="w-full justify-start h-auto py-3">
                <Link className={`w-5 h-5 ${isRTL ? 'ml-3' : 'mr-3'}`} />
                <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold">{t('vendor.assignBarcodeDialog.assignToExisting')}</p>
                    <p className="font-normal text-sm opacity-80">{t('vendor.assignBarcodeDialog.assignToExistingHint')}</p>
                </div>
            </Button>
            <Button onClick={() => onCreateNew(scannedBarcode)} className="w-full justify-start h-auto py-3">
                <PlusCircle className={`w-5 h-5 ${isRTL ? 'ml-3' : 'mr-3'}`} />
                <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold">{t('vendor.assignBarcodeDialog.createNew')}</p>
                     <p className="font-normal text-sm opacity-80">{t('vendor.assignBarcodeDialog.createNewHint')}</p>
                </div>
            </Button>
        </div>
    );

    const renderAssignView = () => (
        <div className="pt-4 space-y-4">
            <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
                <Input
                    placeholder={t('vendor.assignBarcodeDialog.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={isRTL ? 'pr-10' : 'pl-10'}
                />
            </div>
            <ScrollArea className="h-64 border rounded-md">
                <div className="p-2 space-y-1">
                    {filteredProducts.length > 0 ? filteredProducts.map(p => (
                        <div
                            key={p.id}
                            onClick={() => setSelectedProductId(p.id)}
                            className={`p-2 rounded-md cursor-pointer text-sm ${isRTL ? 'text-right' : 'text-left'} ${selectedProductId === p.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                        >
                            <p className="font-medium">{language === 'Hebrew' ? p.name_hebrew : p.name}</p>
                            <p className={`text-xs ${selectedProductId === p.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>SKU: {p.sku || 'N/A'}</p>
                        </div>
                    )) : (
                        <p className="p-4 text-center text-sm text-muted-foreground">{t('vendor.assignBarcodeDialog.noProductsFound')}</p>
                    )}
                </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setView('options')}>{t('common.back')}</Button>
                <Button onClick={handleAssign} disabled={!selectedProductId || isSaving}>
                    {isSaving && <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                    {isSaving ? t('vendor.assignBarcodeDialog.assigning') : t('vendor.assignBarcodeDialog.assign')}
                </Button>
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader className={isRTL ? 'text-right' : 'text-left'}>
                    <DialogTitle>{t('vendor.assignBarcodeDialog.title', { barcode: scannedBarcode })}</DialogTitle>
                    {view === 'options' && (
                        <DialogDescription>{t('vendor.assignBarcodeDialog.description')}</DialogDescription>
                    )}
                </DialogHeader>
                {view === 'options' ? renderOptionsView() : renderAssignView()}
            </DialogContent>
        </Dialog>
    );
}