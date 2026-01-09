import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Trash2, Search, Loader2, Package, ShoppingCart } from 'lucide-react';
import { Household, Vendor, Product } from '@/entities/all';
import { createQuickOrder } from '@/functions/createQuickOrder';
import { useLanguage } from '../i18n/LanguageContext';

export default function QuickOrderForm({ preSelectedVendorId, userType, onOrderCreated }) {
    const { t, language } = useLanguage();
    const [vendors, setVendors] = useState([]);
    const [households, setHouseholds] = useState([]);
    const [products, setProducts] = useState([]);
    
    const [selectedVendorId, setSelectedVendorId] = useState(preSelectedVendorId || '');
    const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
    const [selectedHousehold, setSelectedHousehold] = useState(null);
    
    const [productSearch, setProductSearch] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [deliveryPrice, setDeliveryPrice] = useState(0);
    
    const [paymentStatus, setPaymentStatus] = useState('kcs');
    const [isPaid, setIsPaid] = useState(false);
    const [isBilled, setIsBilled] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('kcs_cash');
    const [initialStatus, setInitialStatus] = useState('delivered');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [activeTab, setActiveTab] = useState('search');
    
    const [browseQuantities, setBrowseQuantities] = useState({});

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedVendorId) {
            loadVendorProducts();
            loadVendorDeliveryFee();
        }
    }, [selectedVendorId]);

    useEffect(() => {
        if (selectedHouseholdId) {
            loadHouseholdDetails();
        }
    }, [selectedHouseholdId]);

    useEffect(() => {
        if (productSearch && selectedVendorId) {
            filterProducts();
        } else {
            setFilteredProducts([]);
        }
    }, [productSearch, products]);

    const loadInitialData = async () => {
        try {
            const [vendorsData, householdsData] = await Promise.all([
                Vendor.list(),
                Household.list()
            ]);
            setVendors(vendorsData);
            setHouseholds(householdsData);
        } catch (error) {
            console.error('Error loading data:', error);
            alert(t('quickOrder.loadError', 'Failed to load initial data'));
        } finally {
            setIsLoadingData(false);
        }
    };

    const loadVendorProducts = async () => {
        try {
            const productsData = await Product.filter({ vendor_id: selectedVendorId });
            setProducts(productsData.filter(p => !p.is_draft));
        } catch (error) {
            console.error('Error loading products:', error);
        }
    };

    const loadVendorDeliveryFee = async () => {
        try {
            const vendor = await Vendor.get(selectedVendorId);
            setDeliveryPrice(vendor.delivery_fee || 0);
        } catch (error) {
            console.error('Error loading vendor delivery fee:', error);
        }
    };

    const loadHouseholdDetails = async () => {
        try {
            const household = await Household.get(selectedHouseholdId);
            setSelectedHousehold(household);
        } catch (error) {
            console.error('Error loading household:', error);
        }
    };

    const filterProducts = () => {
        const searchLower = productSearch.toLowerCase();
        const filtered = products.filter(p => 
            p.name?.toLowerCase().includes(searchLower) ||
            p.name_hebrew?.includes(productSearch) ||
            p.sku?.toLowerCase().includes(searchLower) ||
            p.barcode?.includes(productSearch)
        ).slice(0, 10);
        setFilteredProducts(filtered);
    };

    const handleAddProduct = (product, quantity = 1) => {
        const existingItem = selectedItems.find(item => item.productId === product.id);
        if (existingItem) {
            setSelectedItems(selectedItems.map(item => 
                item.productId === product.id 
                    ? { ...item, quantity: parseFloat(item.quantity) + parseFloat(quantity) }
                    : item
            ));
        } else {
            setSelectedItems([...selectedItems, {
                productId: product.id,
                name: product.name,
                name_hebrew: product.name_hebrew,
                quantity: parseFloat(quantity),
                price: product.price_base || 0,
                unit: product.unit || 'each'
            }]);
        }
        setProductSearch('');
        setFilteredProducts([]);
        setBrowseQuantities(prev => ({...prev, [product.id]: ''}));
    };

    const handleBrowseQuantityChange = (productId, value) => {
        setBrowseQuantities(prev => ({
            ...prev,
            [productId]: value
        }));
    };

    const handleBrowseQuantityKeyPress = (e, product) => {
        if (e.key === 'Enter') {
            const quantity = parseFloat(browseQuantities[product.id]) || 0;
            if (quantity > 0) {
                handleAddProduct(product, quantity);
            }
        }
    };

    const handleUpdateQuantity = (productId, newQuantity) => {
        if (parseFloat(newQuantity) <= 0) {
            handleRemoveProduct(productId);
            return;
        }
        setSelectedItems(selectedItems.map(item => 
            item.productId === productId 
                ? { ...item, quantity: parseFloat(newQuantity) || 0 }
                : item
        ));
    };

    const handleUpdatePrice = (productId, newPrice) => {
        setSelectedItems(selectedItems.map(item => 
            item.productId === productId 
                ? { ...item, price: parseFloat(newPrice) || 0 }
                : item
        ));
    };

    const handleRemoveProduct = (productId) => {
        setSelectedItems(selectedItems.filter(item => item.productId !== productId));
    };

    const calculateSubtotal = () => {
        return selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    };

    const calculateTotal = () => {
        return calculateSubtotal() + (deliveryPrice || 0);
    };

    const handleSubmit = async () => {
        if (!selectedVendorId || !selectedHouseholdId || selectedItems.length === 0) {
            alert(t('quickOrder.missingFields', 'Please select vendor, household and add at least one product'));
            return;
        }

        setIsSubmitting(true);
        try {
            const deliveryDetails = {
                street: selectedHousehold?.street || '',
                building_number: selectedHousehold?.building_number || '',
                household_number: selectedHousehold?.household_number || '',
                neighborhood: selectedHousehold?.neighborhood || '',
                entrance_code: selectedHousehold?.entrance_code || '',
                phone: selectedHousehold?.lead_phone || '',
                delivery_notes: '',
                delivery_time: ''
            };

            const response = await createQuickOrder({
                vendorId: selectedVendorId,
                householdId: selectedHouseholdId,
                deliveryDetails,
                items: selectedItems,
                deliveryPrice,
                paymentStatus,
                isPaid,
                isBilled,
                paymentMethod,
                initialStatus
            });

            if (response.data.success) {
                alert(t('quickOrder.success', 'Order created successfully!'));
                setSelectedHouseholdId('');
                setSelectedHousehold(null);
                setSelectedItems([]);
                setBrowseQuantities({});
                if (onOrderCreated) {
                    onOrderCreated(response.data.order);
                }
            } else {
                throw new Error(response.data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error creating quick order:', error);
            alert(t('quickOrder.error', 'Failed to create order: ') + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isProductSelected = (productId) => {
        return selectedItems.some(item => item.productId === productId);
    };

    const getProductQuantity = (productId) => {
        const item = selectedItems.find(item => item.productId === productId);
        return item ? item.quantity : 0;
    };

    if (isLoadingData) {
        return (
            <Card>
                <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        {t('quickOrder.title', 'Quick Order Entry')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!preSelectedVendorId && ['admin', 'chief of staff'].includes(userType) && (
                        <div>
                            <Label>{t('quickOrder.selectVendor', 'Select Vendor')}</Label>
                            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t('quickOrder.chooseVendor', 'Choose vendor...')} />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendors.map(vendor => (
                                        <SelectItem key={vendor.id} value={vendor.id}>
                                            {language === 'Hebrew' ? (vendor.name_hebrew || vendor.name) : vendor.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div>
                        <Label>{t('quickOrder.selectHousehold', 'Select Household')}</Label>
                        <Select value={selectedHouseholdId} onValueChange={setSelectedHouseholdId}>
                            <SelectTrigger>
                                <SelectValue placeholder={t('quickOrder.chooseHousehold', 'Choose household...')} />
                            </SelectTrigger>
                            <SelectContent>
                                {households.map(household => (
                                    <SelectItem key={household.id} value={household.id}>
                                        {language === 'Hebrew' ? (household.name_hebrew || household.name) : household.name} ({household.household_code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedVendorId && selectedHouseholdId && (
                        <div>
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="search" className="flex items-center gap-2">
                                        <Search className="w-4 h-4" />
                                        {t('quickOrder.searchTab', 'Search')}
                                    </TabsTrigger>
                                    <TabsTrigger value="browse" className="flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        {t('quickOrder.browseTab', 'Browse All')}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="search" className="mt-4">
                                    <div className="relative">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                            <Input
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                placeholder={t('quickOrder.searchPlaceholder', 'Search by name, SKU, or barcode...')}
                                                className="pl-10"
                                            />
                                        </div>
                                        {filteredProducts.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                {filteredProducts.map(product => (
                                                    <div
                                                        key={product.id}
                                                        onClick={() => handleAddProduct(product, 1)}
                                                        className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="font-medium">
                                                                    {language === 'Hebrew' ? (product.name_hebrew || product.name) : product.name}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {product.sku && `SKU: ${product.sku} | `}
                                                                    ₪{product.price_base?.toFixed(2)} / {product.unit}
                                                                </div>
                                                            </div>
                                                            {isProductSelected(product.id) && (
                                                                <div className="flex items-center gap-2">
                                                                    <ShoppingCart className="w-4 h-4 text-green-600" />
                                                                    <span className="text-sm font-medium text-green-600">
                                                                        {getProductQuantity(product.id)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="browse" className="mt-4">
                                    <div className="border rounded-lg max-h-96 overflow-y-auto">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white z-10">
                                                <TableRow>
                                                    <TableHead>{t('quickOrder.product', 'Product')}</TableHead>
                                                    <TableHead className="w-24">{t('quickOrder.price', 'Price')}</TableHead>
                                                    <TableHead className="w-24">{t('quickOrder.unit', 'Unit')}</TableHead>
                                                    <TableHead className="w-32">{t('quickOrder.quantity', 'Quantity')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {products.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                                            {t('quickOrder.noProducts', 'No products available')}
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    products.map(product => (
                                                        <TableRow key={product.id} className="hover:bg-gray-50">
                                                            <TableCell>
                                                                <div>
                                                                    <div className="font-medium">
                                                                        {language === 'Hebrew' ? (product.name_hebrew || product.name) : product.name}
                                                                    </div>
                                                                    {product.sku && (
                                                                        <div className="text-xs text-gray-500">SKU: {product.sku}</div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>₪{product.price_base?.toFixed(2)}</TableCell>
                                                            <TableCell>{product.unit}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        placeholder="0"
                                                                        value={browseQuantities[product.id] || ''}
                                                                        onChange={(e) => handleBrowseQuantityChange(product.id, e.target.value)}
                                                                        onKeyPress={(e) => handleBrowseQuantityKeyPress(e, product)}
                                                                        className="w-20"
                                                                    />
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const quantity = parseFloat(browseQuantities[product.id]) || 0;
                                                                            if (quantity > 0) {
                                                                                handleAddProduct(product, quantity);
                                                                            }
                                                                        }}
                                                                        disabled={!browseQuantities[product.id] || parseFloat(browseQuantities[product.id]) <= 0}
                                                                    >
                                                                        {t('quickOrder.add', 'Add')}
                                                                    </Button>
                                                                    {isProductSelected(product.id) && (
                                                                        <div className="flex items-center gap-1 text-green-600">
                                                                            <ShoppingCart className="w-4 h-4" />
                                                                            <span className="text-sm font-medium">
                                                                                {getProductQuantity(product.id)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}

                    {selectedItems.length > 0 && (
                        <div>
                            <Label>{t('quickOrder.selectedProducts', 'Selected Products')}</Label>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('quickOrder.product', 'Product')}</TableHead>
                                        <TableHead className="w-24">{t('quickOrder.quantity', 'Qty')}</TableHead>
                                        <TableHead className="w-32">{t('quickOrder.price', 'Price')}</TableHead>
                                        <TableHead className="w-32">{t('quickOrder.total', 'Total')}</TableHead>
                                        <TableHead className="w-16"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedItems.map(item => (
                                        <TableRow key={item.productId}>
                                            <TableCell>
                                                {language === 'Hebrew' ? (item.name_hebrew || item.name) : item.name}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateQuantity(item.productId, e.target.value)}
                                                    className="w-20"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.price}
                                                    onChange={(e) => handleUpdatePrice(item.productId, e.target.value)}
                                                    className="w-24"
                                                />
                                            </TableCell>
                                            <TableCell>₪{(item.price * item.quantity).toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveProduct(item.productId)}
                                                    className="text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {selectedItems.length > 0 && (
                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                            <div className="flex justify-between">
                                <span>{t('quickOrder.subtotal', 'Subtotal:')}</span>
                                <span className="font-semibold">₪{calculateSubtotal().toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>{t('quickOrder.deliveryFee', 'Delivery Fee:')}</Label>
                                <div className="text-right">
                                    <span className="font-semibold">₪{deliveryPrice.toFixed(2)}</span>
                                    <p className="text-xs text-gray-500">{t('quickOrder.autoFromVendor', '(Auto from vendor)')}</p>
                                </div>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2">
                                <span>{t('quickOrder.total', 'Total:')}</span>
                                <span>₪{calculateTotal().toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    {selectedItems.length > 0 && ['admin', 'chief of staff'].includes(userType) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                            <div>
                                <Label>{t('quickOrder.paymentStatus', 'Payment Status')}</Label>
                                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kcs">KCS</SelectItem>
                                        <SelectItem value="client">Client</SelectItem>
                                        <SelectItem value="denied">Denied</SelectItem>
                                        <SelectItem value="none">None</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>{t('quickOrder.paymentMethod', 'Payment Method')}</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kcs_cash">KCS Cash</SelectItem>
                                        <SelectItem value="aviCC">Avi CC</SelectItem>
                                        <SelectItem value="meirCC">Meir CC</SelectItem>
                                        <SelectItem value="chaimCC">Chaim CC</SelectItem>
                                        <SelectItem value="clientCC">Client CC</SelectItem>
                                        <SelectItem value="kcsBankTransfer">KCS Bank Transfer</SelectItem>
                                        <SelectItem value="none">None</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>{t('quickOrder.orderStatus', 'Initial Order Status')}</Label>
                                <Select value={initialStatus} onValueChange={setInitialStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="shopping">Shopping</SelectItem>
                                        <SelectItem value="ready_for_shipping">Ready for Shipping</SelectItem>
                                        <SelectItem value="delivery">Delivery</SelectItem>
                                        <SelectItem value="delivered">Delivered</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="isPaid"
                                        checked={isPaid}
                                        onChange={(e) => setIsPaid(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="isPaid" className="cursor-pointer">{t('quickOrder.isPaid', 'Is Paid')}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="isBilled"
                                        checked={isBilled}
                                        onChange={(e) => setIsBilled(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <Label htmlFor="isBilled" className="cursor-pointer">{t('quickOrder.isBilled', 'Is Billed')}</Label>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || selectedItems.length === 0}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                {t('quickOrder.creating', 'Creating Order...')}
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 mr-2" />
                                {t('quickOrder.createOrder', 'Create Quick Order')}
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}