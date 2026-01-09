
import React, { useState, useEffect, useMemo } from "react";
import { Product } from "@/entities/Product";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export default function AddItemToOrderModal({ isOpen, onClose, vendorId, onItemAdded }) {
  const { t, language } = useLanguage();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [quantities, setQuantities] = useState({}); // Track quantities for each product

  // Load products when modal opens
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const productsData = await Product.filter({ vendor_id: vendorId }, "-name");
        setProducts(productsData);
        setQuantities({}); // Reset quantities when loading new products
      } catch (error) {
        console.error("Error loading products for adding to order:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && vendorId) {
      loadProducts();
    }
  }, [isOpen, vendorId]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set();
    products.forEach(p => {
      // Use Hebrew subcategory if language is Hebrew and it exists, otherwise use English
      const categoryName = language === 'Hebrew' ? (p.subcategory_hebrew || p.subcategory) : p.subcategory;
      if (categoryName) cats.add(categoryName);
    });
    return Array.from(cats).sort();
  }, [products, language]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.name_hebrew?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower)
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(product => {
        // The selectedCategory value itself will be in the active language (English or Hebrew)
        // so we need to compare it against the product's category name in the active language.
        const productCategoryForLang = language === 'Hebrew' ? (product.subcategory_hebrew || product.subcategory) : product.subcategory;
        return productCategoryForLang === selectedCategory;
      });
    }

    return filtered;
  }, [products, searchQuery, selectedCategory, language]);

  const handleQuantityChange = (productId, change) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + change);
      return { ...prev, [productId]: newQty };
    });
  };

  const handleAddItem = (product) => {
    const quantity = quantities[product.id] || 1;
    
    const orderItem = {
      product_id: product.id,
      sku: product.sku || '',
      product_name: product.name,
      product_name_hebrew: product.name_hebrew || '',
      subcategory: product.subcategory || '',
      subcategory_hebrew: product.subcategory_hebrew || '',
      quantity: quantity,
      quantity_per_unit: product.quantity_in_unit || '',
      actual_quantity: quantity, // Set actual_quantity same as quantity initially
      price: product.price_base || 0,
      unit: product.unit || 'each',
      shopped: false,
      available: true,
      substitute_product_id: null,
      substitute_product_name: null,
      vendor_notes: '',
      modified: false,
      is_returned: false,
      amount_returned: null
    };

    onItemAdded(orderItem);
    
    // Reset quantity for this product after adding
    setQuantities(prev => ({ ...prev, [product.id]: 0 }));
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setQuantities({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('vendor.orderManagement.addItemToOrder', 'Add Item to Order')}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* Filters - Fixed at top */}
          <div className="flex gap-4 mb-4 flex-shrink-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder={t('products.searchPlaceholder', 'Search products...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('products.allCategories', 'All Categories')}</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products List - Scrollable */}
          <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">{t('common.loading', 'Loading...')}</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">{t('products.noProductsFound', 'No products found')}</div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredProducts.map(product => {
                  const quantity = quantities[product.id] || 0;
                  const productName = language === 'Hebrew' ? (product.name_hebrew || product.name) : product.name;
                  const price = product.price_base || 0;
                  
                  return (
                    <div key={product.id} className="bg-white p-4 rounded-lg border hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{productName}</h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            {product.sku && <div>SKU: {product.sku}</div>}
                            {(product.subcategory || product.subcategory_hebrew) && (
                              <div>{language === 'Hebrew' ? (product.subcategory_hebrew || product.subcategory) : product.subcategory}</div>
                            )}
                            {product.quantity_in_unit && <div>{product.quantity_in_unit}</div>}
                            <div className="font-semibold text-green-600">₪{price.toFixed(2)}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQuantityChange(product.id, -1)}
                              disabled={quantity === 0}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-12 text-center font-medium">{quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleQuantityChange(product.id, 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Add to Order Button */}
                          <Button
                            onClick={() => handleAddItem(product)}
                            disabled={quantity === 0}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {t('vendor.orderManagement.addToOrder', 'Add to Order')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={handleClose}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
