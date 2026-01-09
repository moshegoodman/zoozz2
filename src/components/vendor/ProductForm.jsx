
import React, { useState, useEffect } from 'react';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X } from 'lucide-react';
import { UploadFile } from '@/integrations/Core';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProductForm({ 
    product = null, 
    vendorSubcategories = [], 
    onSave, 
    onCancel, 
    vendorId = null,
    initialData = null 
}) {
    const { t, language } = useLanguage();
    const isRTL = language === 'Hebrew';
    
    const [formData, setFormData] = useState({
        name: '',
        name_hebrew: '',
        description: '',
        description_hebrew: '',
        price_base: '',
        price_customer_app: '',
        price_customer_kcs: '',
        subcategory: '',
        subcategory_hebrew: '',
        unit: 'each',
        quantity_in_unit: '',
        stock_quantity: 100,
        brand: '',
        brand_hebrew: '',
        barcode: '',
        kashrut: '',
        kashrut_hebrew: '',
        image_url: '',
        is_draft: false,
        sku: '',
        ...product,
        ...initialData // Apply initial data (including barcode from scan)
    });

    const unitOptions = [
        { value: 'each', labelEn: 'Each', labelHe: 'כל אחד' },
        { value: 'unit', labelEn: 'Unit', labelHe: 'יחידה' },
        { value: 'lb', labelEn: 'Pound', labelHe: 'פאונד' },
        { value: 'oz', labelEn: 'Ounce', labelHe: 'אונקייה' },
        { value: 'kg', labelEn: 'Kilogram', labelHe: 'קילוגרם' },
        { value: 'pack', labelEn: 'Pack', labelHe: 'חבילה' },
        { value: 'bottle', labelEn: 'Bottle', labelHe: 'בקבוק' },
        { value: 'box', labelEn: 'Box', labelHe: 'קופסה' },
        { value: 'bag', labelEn: 'Bag', labelHe: 'שקית' },
        { value: 'case', labelEn: 'Case', labelHe: 'ארגז' },
        { value: 'container', labelEn: 'Container', labelHe: 'קופסא' }
    ];

    // Update form data when product or initialData changes
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            ...product,
            ...initialData // Ensure initialData (like scanned barcode) takes precedence
        }));
    }, [product, initialData]);

    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true); // Keep existing state variable

        try {
            // Prepare data for submission with proper trimming and type conversion
            const dataToSubmit = {
                // Apply trimming to string fields. Convert empty optional strings to null.
                name: formData.name.trim(),
                name_hebrew: formData.name_hebrew?.trim() || null,
                description: formData.description?.trim() || null,
                description_hebrew: formData.description_hebrew?.trim() || null,

                // Numeric fields. Convert to float/int, null if empty, undefined, or invalid.
                price_base: (formData.price_base === '' || formData.price_base === null || formData.price_base === undefined) ? null : parseFloat(formData.price_base),
                price_customer_app: (formData.price_customer_app === '' || formData.price_customer_app === null || formData.price_customer_app === undefined) ? null : parseFloat(formData.price_customer_app),
                price_customer_kcs: (formData.price_customer_kcs === '' || formData.price_customer_kcs === null || formData.price_customer_kcs === undefined) ? null : parseFloat(formData.price_customer_kcs),
                
                subcategory: formData.subcategory?.trim() || null,
                subcategory_hebrew: formData.subcategory_hebrew?.trim() || null,
                unit: formData.unit || 'each',
                
                // IMPORTANT FIX: Ensure quantity_in_unit is explicitly a trimmed string.
                quantity_in_unit: String(formData.quantity_in_unit || '').trim(), 

                // Stock quantity as integer, null for empty, undefined, or invalid.
                stock_quantity: (formData.stock_quantity === '' || formData.stock_quantity === null || formData.stock_quantity === undefined) ? null : parseInt(formData.stock_quantity),

                brand: formData.brand?.trim() || null,
                brand_hebrew: formData.brand_hebrew?.trim() || null,
                barcode: formData.barcode?.trim() || null,
                kashrut: formData.kashrut?.trim() || null,
                kashrut_hebrew: formData.kashrut_hebrew?.trim() || null,
                image_url: formData.image_url?.trim() || null,
                is_draft: formData.is_draft || false,
                sku: formData.sku?.trim() || null,
                
                // Add vendor_id only if creating a new product
                ...( (!product && vendorId) ? { vendor_id: vendorId } : {})
            };

            // Post-process numeric fields to ensure NaN values are converted to null
            ['price_base', 'price_customer_app', 'price_customer_kcs'].forEach(field => {
                if (typeof dataToSubmit[field] === 'number' && isNaN(dataToSubmit[field])) {
                    dataToSubmit[field] = null;
                }
            });
            if (typeof dataToSubmit.stock_quantity === 'number' && isNaN(dataToSubmit.stock_quantity)) {
                dataToSubmit.stock_quantity = null;
            }

            await onSave(dataToSubmit); // Keep existing onSave prop
            
        } catch (error) {
            console.error("Error saving product:", error);
            // Provide more detailed error message
            alert(t('common.saveError') + ': ' + (error.response?.data?.message || error.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            setFormData(prev => ({ ...prev, image_url: file_url }));
        } catch (error) {
            console.error("Error uploading image:", error);
            alert(t('common.uploadError'));
        } finally {
            setIsUploading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <DialogContent className={`max-w-2xl max-h-[90vh] overflow-y-auto ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
            <DialogHeader>
                <DialogTitle>
                    {product ? t('vendor.productForm.editProduct') : t('vendor.productForm.addProduct')}
                </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="name">{t('vendor.productForm.productName')} *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="name_hebrew">{t('vendor.productForm.productNameHebrew')}</Label>
                        <Input
                            id="name_hebrew"
                            value={formData.name_hebrew}
                            onChange={(e) => handleChange('name_hebrew', e.target.value)}
                            dir="rtl"
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="description">{t('vendor.productForm.description')}</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div>
                        <Label htmlFor="description_hebrew">{t('vendor.productForm.descriptionHebrew')}</Label>
                        <Textarea
                            id="description_hebrew"
                            value={formData.description_hebrew}
                            onChange={(e) => handleChange('description_hebrew', e.target.value)}
                            rows={3}
                            dir="rtl"
                        />
                    </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="price_base">{t('vendor.productForm.basePrice')} *</Label>
                        <Input
                            id="price_base"
                            type="number"
                            step="0.01"
                            value={formData.price_base}
                            onChange={(e) => handleChange('price_base', e.target.value)}
                            required
                        />
                    </div>
                  
                </div>

                {/* Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="subcategory">{t('vendor.productForm.subcategory')}</Label>
                        <Select value={formData.subcategory} onValueChange={(value) => handleChange('subcategory', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('vendor.productForm.selectSubcategory')} />
                            </SelectTrigger>
                            <SelectContent>
                                {vendorSubcategories.map(sub => (
                                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="subcategory_hebrew">{t('vendor.productForm.subcategoryHebrew')}</Label>
                        <Input
                            id="subcategory_hebrew"
                            value={formData.subcategory_hebrew}
                            onChange={(e) => handleChange('subcategory_hebrew', e.target.value)}
                            dir="rtl"
                        />
                    </div>
                </div>

                {/* Product Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="unit">{t('vendor.productForm.unit')}</Label>
                        <Select name="unit" value={formData.unit} onValueChange={(value) => handleChange('unit', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('vendor.productForm.selectUnit')} />
                            </SelectTrigger>
                            <SelectContent>
                                {unitOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {language === 'Hebrew' ? option.labelHe : option.labelEn}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="quantity_in_unit">{t('vendor.productForm.quantityInUnit')}</Label>
                        <Input
                            id="quantity_in_unit"
                            type="text"
                            value={formData.quantity_in_unit}
                            onChange={(e) => handleChange('quantity_in_unit', e.target.value)}
                            placeholder="e.g., 200G, 50 plates, 12 pieces"
                        />
                    </div>
                    <div>
                        <Label htmlFor="stock_quantity">{t('vendor.productForm.stockQuantity')}</Label>
                        <Input
                            id="stock_quantity"
                            type="number"
                            value={formData.stock_quantity}
                            onChange={(e) => handleChange('stock_quantity', e.target.value)}
                        />
                    </div>
                </div>

                {/* Brand and SKU */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label htmlFor="brand">{t('vendor.productForm.brand')}</Label>
                        <Input
                            id="brand"
                            value={formData.brand}
                            onChange={(e) => handleChange('brand', e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="brand_hebrew">{t('vendor.productForm.brandHebrew')}</Label>
                        <Input
                            id="brand_hebrew"
                            value={formData.brand_hebrew}
                            onChange={(e) => handleChange('brand_hebrew', e.target.value)}
                            dir="rtl"
                        />
                    </div>
                    <div>
                        <Label htmlFor="sku">{t('vendor.productForm.sku')}</Label>
                        <Input
                            id="sku"
                            value={formData.sku}
                            onChange={(e) => handleChange('sku', e.target.value)}
                        />
                    </div>
                </div>

                {/* Barcode and Kashrut */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="barcode">{t('vendor.productForm.barcode')}</Label>
                        <Input
                            id="barcode"
                            value={formData.barcode}
                            onChange={(e) => handleChange('barcode', e.target.value)}
                            placeholder={t('vendor.productForm.barcodePlaceholder')}
                            className={initialData?.barcode ? 'bg-green-50 border-green-300' : ''}
                        />
                        {initialData?.barcode && (
                            <p className="text-xs text-green-600 mt-1">
                                {t('vendor.productForm.barcodeFromScan', 'Barcode filled from scan')}
                            </p>
                        )}
                    </div>
                    <div>
                        <Label htmlFor="kashrut">{t('vendor.productForm.kashrut')}</Label>
                        <Input
                            id="kashrut"
                            value={formData.kashrut}
                            onChange={(e) => handleChange('kashrut', e.target.value)}
                        />
                    </div>
                </div>

                {/* Kashrut Hebrew */}
                <div>
                    <Label htmlFor="kashrut_hebrew">{t('vendor.productForm.kashrutHebrew')}</Label>
                    <Input
                        id="kashrut_hebrew"
                        value={formData.kashrut_hebrew}
                        onChange={(e) => handleChange('kashrut_hebrew', e.target.value)}
                        dir="rtl"
                    />
                </div>

                {/* Image Upload */}
                <div>
                    <Label htmlFor="image_upload">{t('vendor.productForm.productImage')}</Label>
                    <div className="mt-2">
                        {formData.image_url && (
                            <div className="relative inline-block mb-2">
                                <img
                                    src={formData.image_url}
                                    alt="Product"
                                    className="w-20 h-20 object-cover rounded-lg"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleChange('image_url', '')}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <Input
                            id="image_upload"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={isUploading}
                        />
                        {isUploading && (
                            <div className="flex items-center mt-2 text-sm text-gray-600">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                {t('common.uploading')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Draft Status */}
                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="is_draft"
                        checked={formData.is_draft}
                        onChange={(e) => handleChange('is_draft', e.target.checked)}
                        className="rounded"
                    />
                    <Label htmlFor="is_draft">{t('vendor.productForm.saveDraft')}</Label>
                </div>

                {/* Buttons */}
                <div className={`flex gap-2 pt-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                        {product ? t('common.update') : t('common.create')}
                    </Button>
                </div>
            </form>
        </DialogContent>
    );
}
