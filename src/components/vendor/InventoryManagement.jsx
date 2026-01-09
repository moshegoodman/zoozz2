
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Product, Order } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added Button import
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, Search, Truck, ShoppingBasket, Download } from 'lucide-react'; // Added Download icon import
import { useLanguage } from '../i18n/LanguageContext';

const ProductListTable = ({ products, searchTerm, isRTL, language, t }) => {
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            if (!searchTerm) return true;
            const searchLower = searchTerm.toLowerCase();
            return (
                product.name?.toLowerCase().includes(searchLower) ||
                product.name_hebrew?.toLowerCase().includes(searchLower) ||
                product.sku?.toLowerCase().includes(searchLower) ||
                product.barcode?.toLowerCase().includes(searchLower) ||
                product.subcategory?.toLowerCase().includes(searchLower) ||
                product.subcategory_hebrew?.toLowerCase().includes(searchLower)
            );
        });
    }, [products, searchTerm]);

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={`w-1/4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('vendor.inventory.table_product')}</TableHead>
                        <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('vendor.inventory.table_sku')}</TableHead>
                        <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('vendor.inventory.table_barcode')}</TableHead>
                        <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('vendor.inventory.table_subcategory')}</TableHead>
                        <TableHead className={`text-center ${isRTL ? 'text-right' : 'text-left'}`}>{t('vendor.inventory.table_total_quantity')}</TableHead>
                        <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('vendor.inventory.table_unit')}</TableHead>
                        <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('vendor.inventory.table_quantity_per_unit')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <TableRow key={product.id}>
                                <TableCell>
                                    <div className="font-medium">{language === 'Hebrew' ? product.name_hebrew || product.name : product.name}</div>
                                    <div className="text-sm text-gray-500">{language !== 'Hebrew' ? product.name_hebrew : product.name}</div>
                                </TableCell>
                                <TableCell>{product.sku || 'N/A'}</TableCell>
                                <TableCell>
                                    <span className="font-mono text-sm">{product.barcode || 'N/A'}</span>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm">
                                        {language === 'Hebrew' ? product.subcategory_hebrew || product.subcategory || 'N/A' : product.subcategory || 'N/A'}
                                    </div>
                                    {language !== 'Hebrew' && product.subcategory_hebrew && (
                                        <div className="text-xs text-gray-500">{product.subcategory_hebrew}</div>
                                    )}
                                </TableCell>
                                <TableCell className="text-center font-semibold">{product.total_quantity}</TableCell>
                                <TableCell>{product.unit || 'each'}</TableCell>
                                <TableCell className="text-center">
                                    {product.quantity_in_unit ? `${product.quantity_in_unit} ${t('vendor.inventory.per_unit')}` : 'N/A'}
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan="7" className="text-center h-24">
                                {t('vendor.inventory.noProducts')}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};


export default function InventoryManagement({ vendorId }) {
    const { t, language, isRTL } = useLanguage();
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('picked'); // New state for active tab

    const loadData = useCallback(async () => {
        if (!vendorId) return;
        setIsLoading(true);
        try {
            const [productsData, ordersData] = await Promise.all([
                Product.filter({ vendor_id: vendorId }, "-created_date"),
                Order.filter({ vendor_id: vendorId, status: { $in: ['shopping', 'ready_for_shipping', 'delivery', 'delivered'] } })
            ]);
            setProducts(productsData);
            setOrders(ordersData);
        } catch (error) {
            console.error("Error loading inventory data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [vendorId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const aggregateProducts = useCallback((orderFilter, itemFilter) => {
        const relevantOrders = orders.filter(orderFilter);
        const aggregation = {};

        relevantOrders.forEach(order => {
            (order.items || []).filter(itemFilter).forEach(item => {
                const quantity = item.actual_quantity ?? 0;
                if (quantity > 0) {
                  /*  if item.modified is true then it should use the item.substitute_product_id   */
                  const current_item = item.modified ? item.substitute_product_id : item.product_id;
                    if (aggregation[current_item]) {
                        aggregation[current_item].total_quantity += quantity;
                    } else {
                        const productInfo = products.find(p => p.id === current_item);
                        if (productInfo) {
                            aggregation[current_item] = {
                                ...productInfo,
                                total_quantity: quantity
                            };
                        }
                    }
                }
            });
        });
        return Object.values(aggregation).sort((a,b) => b.total_quantity - a.total_quantity);
    }, [orders, products]);

    const shippedProducts = useMemo(
        () => aggregateProducts(o => ['delivery', 'delivered'].includes(o.status), () => true),
        [aggregateProducts]
    );

    const pickedProducts = useMemo(
        () => aggregateProducts(o => ['shopping','confirmed', 'ready_for_shipping'].includes(o.status), i =>  true),
        [aggregateProducts]
    );

    const handleExportCSV = () => {
        const productsToExport = activeTab === 'picked' ? pickedProducts : shippedProducts;
        if (productsToExport.length === 0) {
            alert(t('vendor.inventory.noProductsToExport', 'There are no products in this list to export.'));
            return;
        }

        const headers = ['SKU', 'Product Name (EN)', 'Product Name (HE)', 'Barcode', 'Subcategory (EN)', 'Subcategory (HE)', 'Total Quantity', 'Unit', 'Quantity per Unit'];
        const csvRows = [headers.join(',')];

        productsToExport.forEach(product => {
            const row = [
                product.sku || '',
                `"${(product.name || '').replace(/"/g, '""')}"`,
                `"${(product.name_hebrew || '').replace(/"/g, '""')}"`,
                product.barcode || '',
                `"${(product.subcategory || '').replace(/"/g, '""')}"`,
                `"${(product.subcategory_hebrew || '').replace(/"/g, '""')}"`,
                product.total_quantity,
                product.unit || 'each',
                product.quantity_in_unit || ''
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        // Add BOM for proper Excel compatibility with UTF-8
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                <p className="ml-4 text-gray-600">{t('vendor.inventory.loading')}</p>
            </div>
        );
    }

    return (
        <Card dir={isRTL ? 'rtl' : 'ltr'}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            {t('vendor.inventory.title')}
                        </CardTitle>
                        <CardDescription>{t('vendor.inventory.description')}</CardDescription>
                    </div>
                    <Button onClick={handleExportCSV} variant="outline" size="sm">
                        <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                        {t('vendor.inventory.exportCSV', 'Export CSV')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className={`grid w-full grid-cols-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <TabsTrigger value="picked">
                            <ShoppingBasket className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            {t('vendor.inventory.tabs.picked')}
                        </TabsTrigger>
                        <TabsTrigger value="shipped">
                            <Truck className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
                            {t('vendor.inventory.tabs.shipped')}
                        </TabsTrigger>
                    </TabsList>
                    <div className="relative mt-4 mb-4">
                        <Search className={`absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                        <Input
                            placeholder={t('vendor.inventory.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`${isRTL ? 'pr-10 text-right' : 'pl-10'} w-full`}
                            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                        />
                    </div>
                    <TabsContent value="picked">
                        <ProductListTable products={pickedProducts} searchTerm={searchTerm} isRTL={isRTL} language={language} t={t} />
                    </TabsContent>
                    <TabsContent value="shipped">
                        <ProductListTable products={shippedProducts} searchTerm={searchTerm} isRTL={isRTL} language={language} t={t} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
