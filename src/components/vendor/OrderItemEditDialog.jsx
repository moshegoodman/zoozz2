
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Product } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ChevronsUpDown, PlusCircle, ScanBarcode, Undo2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import ProductForm from './ProductForm';
import BarcodeScanner from '../shared/BarcodeScanner';
import { Label } from "@/components/ui/label";
import AssignBarcodeDialog from './AssignBarcodeDialog';

export default function OrderItemEditDialog({ 
    item, 
    order, 
    onSave, 
    onClose, 
    onCancel,
    isOpen = true,
    vendorId // Added as per the outline for product operations
}) {
    const { t, language } = useLanguage();
    const isRTL = language === 'Hebrew';
    const [editingProduct, setEditingProduct] = useState(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [substituteProductId, setSubstituteProductId] = useState(item.substitute_product_id || null);
    
    // Data and UI state
    const [vendorProducts, setVendorProducts] = useState([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isProductFormOpen, setIsProductFormOpen] = useState(false);
    const [newProductInitialData, setNewProductInitialData] = useState(null);
    const [assignBarcodeInfo, setAssignBarcodeInfo] = useState(null);

    const handleClose = onClose || onCancel || (() => {});

    const loadVendorProducts = useCallback(async () => {
        // Use order.vendor_id for loading vendor products as it's the source of truth for the order context
        if (!order.vendor_id) return; 
        setIsLoading(true);
        try {
            const products = await Product.filter({ vendor_id: order.vendor_id });
            setVendorProducts(products);
        } catch (error) {
            console.error("Failed to load vendor products:", error);
        } finally {
            setIsLoading(false);
        }
    }, [order.vendor_id]);

    useEffect(() => {
        loadVendorProducts();
    }, [loadVendorProducts]);

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return vendorProducts;
        const query = searchQuery.toLowerCase();
        return vendorProducts.filter(product => 
            product.name?.toLowerCase().includes(query) ||
            product.name_hebrew?.toLowerCase().includes(query) ||
            product.sku?.toLowerCase().includes(query)
        );
    }, [vendorProducts, searchQuery]);

    const getProductPrice = useCallback((product) => {
        if (!product) return null;
        let price;
        // Check if it's a KCS/Household order to determine which price to use
        if (order.household_id) {
            price = product.price_customer_kcs;
        } else {
            price = product.price_customer_app;
        }
        // Fallback to base price if the specific price isn't set
        if (price === null || price === undefined) {
            price = product.price_base;
        }
        return price;
    }, [order.household_id]);

    const handleSave = async () => {
        setIsSaving(true);
        let updatedItemData = { ...item, modified: true };

        const substituteProduct = vendorProducts.find(p => p.id === substituteProductId);

        if (substituteProduct) {
            // A substitute is selected, update details and price
            updatedItemData.available = true;
            if (item.actual_quantity === 0) { // If it was previously marked unavailable
                updatedItemData.actual_quantity = item.quantity;
            }
            updatedItemData.substitute_product_id = substituteProductId;
            updatedItemData.substitute_product_name = language === 'Hebrew' && substituteProduct.name_hebrew ? substituteProduct.name_hebrew : substituteProduct.name;
            updatedItemData.price = getProductPrice(substituteProduct);

        } else {
            // No substitute is selected (or it was undone)
            updatedItemData.substitute_product_id = null;
            updatedItemData.substitute_product_name = null;

            // Revert price to the original item's price
            const originalProduct = vendorProducts.find(p => p.id === item.product_id);
            if (originalProduct) {
                updatedItemData.price = getProductPrice(originalProduct);
            }
        }

        await onSave(updatedItemData);
        setIsSaving(false);
        handleClose();
    };

    const handleScanSuccess = async (scannedCode) => {
        setIsScannerOpen(false); // Close scanner first
        const product = vendorProducts.find(p => p.barcode === scannedCode);
        if (product) {
            setSubstituteProductId(product.id);
        } else {
            // Barcode not found, open the assignment dialog
            setAssignBarcodeInfo({ isOpen: true, barcode: scannedCode });
        }
    };

    // This function is called by handleProductCreated to persist product data
    const handleSave2 = async (productData) => {
        try {
            if (editingProduct) { // This path is unlikely to be taken in this component's current usage
                await Product.update(editingProduct.id, productData);
                const { notifyProductUpdate } = await import("@/functions/notifyProductUpdate"); // Dynamic import as per outline
                notifyProductUpdate({
                    productId: editingProduct.id,
                    vendorId: vendorId, // Use vendorId prop here
                    changedData: productData
                }).catch(err => console.error("Failed to send product update notification:", err));
            } else { // This path is taken when adding a new product
                await Product.create({ ...productData, vendor_id: vendorId }); // Use vendorId prop here
            }
            // Removed setIsFormOpen, setEditingProduct, onProductUpdate, loadData calls as they are not relevant to this component's state or scope.
        } catch (error) {
            console.error("Error saving product:", error);
            alert("Error saving product. Please check console for details.");
        }
    };

    // This function is the callback for ProductForm after a product is created/saved
    const handleProductCreated = async (newProduct) => {
        await handleSave2(newProduct); // Call handleSave2 to persist the product
        setIsProductFormOpen(false);
        setNewProductInitialData(null); // Clear initial data
        await loadVendorProducts(); // Reload vendor products to include the new one
        setSubstituteProductId(newProduct.id); // Automatically select the newly created product as substitute
    };

    const handleUndoReplacement = () => {
        setSubstituteProductId(null);
    };

    const selectedSubstituteName = React.useMemo(() => {
        if (!substituteProductId) {
            return t('vendor.orderItemEdit.selectSubstitute', 'Select a substitute...');
        }
        const product = vendorProducts.find(p => p.id === substituteProductId);
        return product ? (language === 'Hebrew' && product.name_hebrew ? product.name_hebrew : product.name) : t('common.loading');
    }, [substituteProductId, vendorProducts, language, t]);

    const selectedSubstitute = useMemo(() => {
        if (!substituteProductId) return null;
        return vendorProducts.find(p => p.id === substituteProductId);
    }, [substituteProductId, vendorProducts]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent 
                    className="max-w-md"
                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                    onPointerDownOutside={(e) => {
                        if (e.target.closest('[data-radix-popper-content-wrapper]')) {
                            e.preventDefault();
                        }
                    }}
                    onInteractOutside={(e) => {
                         if (e.target.closest('[data-radix-popper-content-wrapper]')) {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className={isRTL ? 'text-right' : 'text-left'}>
                            {t('vendor.orderItemEdit.title')}
                        </DialogTitle>
                    </DialogHeader>

                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Original Item Info */}
                            <div className={`p-3 bg-gray-50 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                                <p className="font-semibold text-gray-900">
                                    {language === 'Hebrew' && item.product_name_hebrew 
                                        ? item.product_name_hebrew 
                                        : item.product_name}
                                </p>
                                <p className="text-xs text-gray-600">
                                    {t('vendor.orderItemEdit.quantity')}: {item.quantity} {item.unit}
                                </p>
                            </div>

                            {/* Substitute Options */}
                            <div className="space-y-3">
                                <div className={isRTL ? 'text-right' : 'text-left'}>
                                    <Label className="text-sm font-medium">
                                        {t('vendor.orderItemEdit.replaceWith', 'Replace with:')}
                                    </Label>
                                    {substituteProductId && (
                                        <p className="text-xs text-green-600 mt-1">
                                            {t('vendor.orderItemEdit.currentSubstitute', 'Currently replacing with:')} {selectedSubstituteName}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Simple dropdown */}
                                <div className="relative">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className={`w-full justify-between ${isRTL ? 'flex-row-reverse' : ''}`}
                                    >
                                        <span className={isRTL ? 'mr-2' : 'ml-2'}>{selectedSubstituteName}</span>
                                        <ChevronsUpDown className={`h-4 w-4 shrink-0 opacity-50 ${isRTL ? 'mr-2' : 'ml-2'}`} />
                                    </Button>
                                    
                                    {isDropdownOpen && (
                                        <div 
                                            className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                                            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                                        >
                                            {/* Search input */}
                                            <div className="p-2 border-b">
                                                <Input
                                                    type="text"
                                                    placeholder={t('vendor.orderItemEdit.searchProducts', 'Search products...')}
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className={`w-full ${isRTL ? 'text-right' : 'text-left'}`}
                                                    style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                                                />
                                            </div>
                                            
                                            {/* Product list */}
                                            <div className="p-1">
                                                {filteredProducts.length > 0 ? (
                                                    filteredProducts.map(product => (
                                                        <div
                                                            key={product.id}
                                                            onClick={() => {
                                                                setSubstituteProductId(product.id);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className={`p-2 rounded-md cursor-pointer hover:bg-gray-100 ${isRTL ? 'text-right' : 'text-left'}`}
                                                        >
                                                            {language === 'Hebrew' && product.name_hebrew ? product.name_hebrew : product.name}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="p-4 text-center text-sm text-gray-500">
                                                        {t('vendor.orderItemEdit.noProductsFound', 'No products found.')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Action Buttons */}
                                <div className="pt-2 grid grid-cols-2 gap-2">
                                     <Button variant="outline" onClick={() => setIsScannerOpen(true)} className="w-full justify-center">
                                         <ScanBarcode className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                         {t('vendor.orderItemEdit.scanBarcode')}
                                     </Button>
                                     <Button variant="outline" onClick={() => {
                                            setNewProductInitialData({}); // Prepare initial data for new product form
                                            setIsProductFormOpen(true);
                                        }} className="w-full justify-center">
                                         <PlusCircle className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                                         {t('vendor.orderItemEdit.addNewProduct')}
                                     </Button>
                                </div>
                                <p className="text-xs text-gray-500 text-center">
                                    {t('vendor.orderItemEdit.addNewProductHint')}
                                </p>

                                {substituteProductId && (
                                     <div className="pt-2 flex justify-center">
                                         <Button variant="link" size="sm" onClick={handleUndoReplacement} className="text-red-600 h-auto p-1">
                                             <Undo2 className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                             {t('vendor.orderItemEdit.undoReplacement')}
                                         </Button>
                                     </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className={`pt-4 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Button variant="outline" onClick={handleClose}>{t('vendor.orderItemEdit.cancel')}</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin ltr:mr-2 rtl:ml-2" />}
                            {t('vendor.orderItemEdit.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Other Modals */}
            <BarcodeScanner
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />

            <Dialog open={isProductFormOpen} onOpenChange={setIsProductFormOpen}>
                 <ProductForm
                    key={newProductInitialData ? 'new-product-with-data' : 'new-product'}
                    isOpen={isProductFormOpen}
                    onClose={() => setIsProductFormOpen(false)}
                    // onProductCreated and onSave point to the same handler, handleProductCreated acts as the save initiator
                    // and the callback from the ProductForm
                    onProductCreated={handleProductCreated} 
                    onSave={handleProductCreated} 
                    vendorId={order.vendor_id} // Existing usage, keeping for consistency
                    initialData={newProductInitialData}
                    vendorSubcategories={order?.vendor?.subcategories || []}
                    onCancel={() => setIsProductFormOpen(false)}
                />
            </Dialog>
             
            {assignBarcodeInfo?.isOpen && (
                <AssignBarcodeDialog
                    isOpen={assignBarcodeInfo.isOpen}
                    scannedBarcode={assignBarcodeInfo.barcode}
                    vendorId={order.vendor_id}
                    products={vendorProducts}
                    onClose={() => setAssignBarcodeInfo(null)}
                    onAssignSuccess={(updatedProduct) => {
                        setVendorProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
                        setSubstituteProductId(updatedProduct.id);
                        setAssignBarcodeInfo(null);
                    }}
                    onCreateNew={(barcode) => {
                        setAssignBarcodeInfo(null);
                        setNewProductInitialData({ barcode });
                        setIsProductFormOpen(true);
                    }}
                />
            )}
        </>
    );
}
