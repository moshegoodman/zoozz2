
import React, { useState, useEffect, useCallback } from 'react';
import { Product, Vendor } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Download, Search } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProductForm from './ProductForm';
import { useLanguage } from '../i18n/LanguageContext';
import { notifyProductUpdate } from '@/functions/notifyProductUpdate';

// This component can be used in two ways:
// 1. By passing `vendor` (for VendorDashboard) - it will fetch its own products.
// 2. By passing `products` and `vendorId` (for AdminDashboard's VendorManagement) - it will use the passed products.
export default function ProductManagement({ vendor: initialVendor, vendorId, products: initialProducts, onProductUpdate, userType }) {
    const { t, language } = useLanguage();
    const isRTL = language === 'Hebrew'; // Assuming Hebrew is the primary RTL language
    const [products, setProducts] = useState(initialProducts || []);
    const [vendor, setVendor] = useState(initialVendor || null);
    const [isLoading, setIsLoading] = useState(!initialProducts && !initialVendor);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const effectiveVendorId = initialVendor?.id || vendorId;

    const loadData = useCallback(async () => {
        if (!effectiveVendorId) return;
        setIsLoading(true);
        try {
            // Fetch products only if not provided via props
            if (!initialProducts) {
                const productsData = await Product.filter({ vendor_id: effectiveVendorId }, "-created_date");
                setProducts(productsData);
            }
            
            // Fetch vendor data only if not provided as a prop.
            if (!initialVendor) {
                const allVendors = await Vendor.list();
                const currentVendor = allVendors.find(v => v.id === effectiveVendorId);
                setVendor(currentVendor);
            }
            
        } catch (error) {
            console.error("Error loading products/vendor:", error);
        } finally {
            setIsLoading(false);
        }
    }, [effectiveVendorId, initialProducts, initialVendor]);
    
    useEffect(() => {
        loadData();
    }, [loadData]);
    
    useEffect(() => {
        if (initialProducts) {
            setProducts(initialProducts);
        }
        if (initialVendor) {
            setVendor(initialVendor);
        }
    }, [initialProducts, initialVendor]);

    // Filter products based on search term
    const filteredProducts = products.filter(product => {
        if (!searchTerm.trim()) return true;
        
        const searchLower = searchTerm.toLowerCase();
        const searchFields = [
            product.name,
            product.name_hebrew,
            product.sku,
            product.brand,
            product.brand_hebrew,
            product.subcategory,
            product.subcategory_hebrew,
            product.barcode,
            product.description,
            product.description_hebrew
        ];
        
        return searchFields.some(field => 
            field && String(field).toLowerCase().includes(searchLower)
        );
    });

    const handleSaveProduct = async (productData) => {
        try {
            // Ensure quantity_in_unit is always a string, even if empty or null, and trim whitespace
            const sanitizedData = {
                ...productData,
                quantity_in_unit: String(productData.quantity_in_unit || '').trim()
            };

            if (editingProduct) {
                await Product.update(editingProduct.id, sanitizedData);
                // Notify admins of the update. This is a "fire-and-forget" call.
                notifyProductUpdate({
                    productId: editingProduct.id,
                    vendorId: effectiveVendorId,
                    changedData: sanitizedData
                }).catch(err => console.error("Failed to send product update notification:", err));
            } else {
                await Product.create({ ...sanitizedData, vendor_id: effectiveVendorId });
            }
            setIsFormOpen(false);
            setEditingProduct(null);
            
            if (onProductUpdate) {
                await onProductUpdate();
            } else {
                await loadData();
            }
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Error saving product: " + (error.response?.data?.message || error.message || "Unknown error."));
        }
    };

    const handleEditProduct = (product) => {
        // Ensure quantity_in_unit is converted to string when editing, to correctly pre-fill the form input
        const productToEdit = {
            ...product,
            quantity_in_unit: String(product.quantity_in_unit || '')
        };
        setEditingProduct(productToEdit);
        setIsFormOpen(true);
    };

    const handleExportProducts = async () => {
        // Ensure vendor data is loaded before attempting to export
        if (!vendor) {
            alert(t('vendor.productManagement.exportVendorLoading'));
            return;
        }

        try {
            const productsToExport = await Product.filter({ vendor_id: vendor.id });
            
            if (productsToExport.length === 0) {
                alert(t('vendor.productManagement.noProductsToExport', { name: vendor.name }));
                return;
            }

            const headers = [
                'sku', 'name', 'name_hebrew', 'description', 'description_hebrew',
                'price_base', 'price_customer_app', 'price_customer_kcs',
                'subcategory', 'subcategory_hebrew', 'unit', 'quantity_in_unit',
                'stock_quantity', 'brand', 'brand_hebrew', 'barcode', 'kashrut',
                'kashrut_hebrew', 'image_url', 'is_draft'
            ];

            const csvContent = [
                headers.join(','),
                ...productsToExport.map(p => [
                    p.sku || '',
                    `"${(p.name || '').replace(/"/g, '""')}"`,
                    `"${(p.name_hebrew || '').replace(/"/g, '""')}"`,
                    `"${(p.description || '').replace(/"/g, '""')}"`,
                    `"${(p.description_hebrew || '').replace(/"/g, '""')}"`,
                    p.price_base ?? '', // Use nullish coalescing operator for cleaner handling of undefined/null
                    p.price_customer_app ?? '',
                    p.price_customer_kcs ?? '',
                    `"${(p.subcategory || '').replace(/"/g, '""')}"`,
                    `"${(p.subcategory_hebrew || '').replace(/"/g, '""')}"`,
                    p.unit || 'each',
                    String(p.quantity_in_unit ?? ''), // Ensure quantity_in_unit is string for CSV
                    p.stock_quantity ?? '',
                    `"${(p.brand || '').replace(/"/g, '""')}"`,
                    `"${(p.brand_hebrew || '').replace(/"/g, '""')}"`,
                    p.barcode || '',
                    `"${(p.kashrut || '').replace(/"/g, '""')}"`, // Ensure kashrut fields are quoted
                    `"${(p.kashrut_hebrew || '').replace(/"/g, '""')}"`,
                    p.image_url || '',
                    p.is_draft ? 'true' : 'false'
                ].join(','))
            ].join('\n');

            // Create and download file with UTF-8 BOM
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `${vendor.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_products_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up the object URL

            alert(t('vendor.productManagement.exportSuccess', { count: productsToExport.length, name: vendor.name }));

        } catch (error) {
            console.error('Error exporting products:', error);
            alert(t('vendor.productManagement.exportError'));
        }
    };

    const handleAddNew = () => {
        setEditingProduct(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (productId) => {
        if (window.confirm(t('common.confirmDelete'))) {
            try {
                await Product.delete(productId);
                if (onProductUpdate) {
                    await onProductUpdate();
                } else {
                    await loadData();
                }
            } catch (error) {
                console.error("Error deleting product:", error);
                alert(t('common.deleteError'));
            }
        }
    };

    const handlePriceUpdate = async (e, productId, priceField) => {
        const product = products.find(p => p.id === productId);
        let newValue = e.target.value.trim() === '' ? null : parseFloat(e.target.value);
    
        if (newValue === (product[priceField] || null)) {
            return;
        }

        if (newValue !== null && isNaN(newValue)) {
            e.target.value = product[priceField] ?? '';
            return;
        }

        try {
            e.target.disabled = true;
            await Product.update(productId, { [priceField]: newValue });

            // Notify admins of the price update. This is a "fire-and-forget" call.
            notifyProductUpdate({
                productId: productId,
                vendorId: effectiveVendorId,
                changedData: { [priceField]: newValue }
            }).catch(err => console.error("Failed to send price update notification:", err));

            if (onProductUpdate) {
                await onProductUpdate();
            } else {
                await loadData();
            }
        } catch (error) {
            console.error(`Error updating price for ${productId}:`, error);
            alert(t('common.updateError'));
            e.target.value = product[priceField] ?? '';
            e.target.disabled = false;
        } finally {
            e.target.disabled = false;
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                    <div>
                        <CardTitle>{t('vendor.productManagement.title')}</CardTitle>
                        <CardDescription>{t('vendor.productManagement.description')}</CardDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto"> {/* Wrapper div for buttons */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportProducts}
                            className="w-1/2 sm:w-auto"
                        >
                            <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            {t('vendor.productManagement.exportProducts')}
                        </Button>
                        <Button onClick={handleAddNew} className="w-1/2 sm:w-auto">
                            <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            {t('vendor.productManagement.addProduct')}
                        </Button>
                    </div>
                </div>
                
                {/* Search Bar */}
                <div className="relative mt-4">
                    <Search className={`absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                    <Input
                        placeholder={t('vendor.productManagement.searchProducts', 'Search products by name, SKU, brand, category...')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`${isRTL ? 'pr-10 text-right' : 'pl-10'} w-full`}
                        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                    />
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p>{t('vendor.productManagement.loadingProducts')}</p>
                ) : (
                    <div className="space-y-4">
                        {/* Results count */}
                        {searchTerm && (
                            <div className="text-sm text-gray-600 mb-4">
                                {t('vendor.productManagement.searchResults', {
                                    count: filteredProducts.length,
                                    total: products.length,
                                    defaultValue: `Showing ${filteredProducts.length} of ${products.length} products`
                                })}
                            </div>
                        )}
                        
                        {filteredProducts.map(product => (
                            <div key={product.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg hover:bg-gray-50 gap-4">
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <img
                                        src={product.image_url || vendor?.banner_url ||vendor?.image_url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo='}
                                        alt={language === 'Hebrew' ? (product.name_hebrew || product.name) : product.name}
                                        className="w-16 h-16 object-cover rounded-md bg-gray-100 flex-shrink-0"
                                        onError={(e) => {
                                            if (e.target.src !== 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo=') {
                                                e.target.onerror = null; // Prevent infinite loop
                                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo=';
                                            }
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="mb-1">
                                            <p className="font-semibold text-gray-900 break-words">{language === 'Hebrew' ? (product.name_hebrew || product.name) : product.name}</p>
                                            {product.is_draft && (
                                                <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs mt-1 inline-block">
                                                    {t('vendor.productManagement.draft')}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">{product.brand}</p>
                                        <p className="text-sm text-gray-600 font-medium">{t('vendor.productManagement.base')}: ₪{product.price_base?.toFixed(2) || 'N/A'}</p>
                                    </div>
                                </div>
                                
                                {userType === 'admin' && (
                                    <div className="w-full sm:w-auto flex flex-wrap items-end gap-4">
                                        <div className="flex-1 sm:flex-auto sm:w-28">
                                            <Label htmlFor={`kcs-price-${product.id}`} className="text-xs">{t('vendor.productManagement.kcsPrice')}</Label>
                                            <Input
                                                id={`kcs-price-${product.id}`}
                                                type="number"
                                                step="0.01"
                                                defaultValue={product.price_customer_kcs ?? ''}
                                                onBlur={(e) => handlePriceUpdate(e, product.id, 'price_customer_kcs')}
                                                className="w-full h-9"
                                                placeholder="₪"
                                            />
                                        </div>
                                        <div className="flex-1 sm:flex-auto sm:w-28">
                                            <Label htmlFor={`app-price-${product.id}`} className="text-xs">{t('vendor.productManagement.appPrice')}</Label>
                                            <Input
                                                id={`app-price-${product.id}`}
                                                type="number"
                                                step="0.01"
                                                defaultValue={product.price_customer_app ?? ''}
                                                onBlur={(e) => handlePriceUpdate(e, product.id, 'price_customer_app')}
                                                className="w-full h-9"
                                                placeholder="₪"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 flex-shrink-0">
                                    <Button variant="outline" size="icon" onClick={() => handleEditProduct(product)}>
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(product.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        
                        {filteredProducts.length === 0 && !isLoading && (
                            <div className="text-center py-10">
                                {searchTerm ? (
                                    <div>
                                        <p className="text-gray-500">{t('vendor.productManagement.noSearchResults', 'No products found matching your search.')}</p>
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => setSearchTerm('')}
                                            className="mt-2"
                                        >
                                            {t('vendor.productManagement.clearSearch', 'Clear search')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-gray-500">{t('vendor.productManagement.noProductsFound')}</p>
                                        <p className="text-sm text-gray-400">{t('vendor.productManagement.clickToAddFirst')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                <Dialog open={isFormOpen} onOpenChange={(isOpen) => { if(!isOpen) { setEditingProduct(null); } setIsFormOpen(isOpen);}}>
                    <ProductForm
                        key={editingProduct ? editingProduct.id : 'new'}
                        product={editingProduct}
                        vendorSubcategories={vendor?.subcategories || []}
                        onSave={handleSaveProduct}
                        onCancel={() => setIsFormOpen(false)}
                    />
                </Dialog>
            </CardContent>
        </Card>
    );
}
