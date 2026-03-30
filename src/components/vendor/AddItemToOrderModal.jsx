import React, { useState, useEffect, useMemo } from "react";
import { Product } from "@/entities/Product";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Package, X, RefreshCw } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

export default function AddItemToOrderModal({ isOpen, onClose, vendorId, onItemAdded, existingItems = [] }) {
  const { language } = useLanguage();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [quantities, setQuantities] = useState({});

  // Build a map of product_id -> ordered quantity from existing order items
  const existingQtyMap = useMemo(() => {
    const map = {};
    existingItems.forEach(item => { map[item.product_id] = item.quantity; });
    return map;
  }, [existingItems]);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const productsData = await Product.filter({ vendor_id: vendorId, is_draft: false });
        setProducts(productsData);
        setQuantities({});
      } catch (error) {
        console.error("Error loading products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && vendorId) {
      loadProducts();
    }
  }, [isOpen, vendorId]);

  const categories = useMemo(() => {
    const cats = new Set();
    products.forEach(p => {
      if (p.subcategory) cats.add(p.subcategory);
    });
    return ["all", ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => !p.is_draft);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.name_hebrew?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.subcategory === selectedCategory);
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  const handleQuantityChange = (productId, change) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newQty = Math.max(0, current + change);
      return { ...prev, [productId]: newQty };
    });
  };

  const handleCardClick = (product) => {
    const inCart = quantities[product.id] || 0;
    const alreadyInOrder = existingQtyMap[product.id] != null;
    if (inCart === 0) {
      // Pre-fill with existing order quantity so the user can adjust from there
      const startQty = alreadyInOrder ? existingQtyMap[product.id] : 1;
      setQuantities(prev => ({ ...prev, [product.id]: startQty }));
    } else {
      setQuantities(prev => ({ ...prev, [product.id]: inCart + 1 }));
    }
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
      actual_quantity: quantity,
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle>Add Item to Order</DialogTitle>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="flex flex-col flex-1 gap-3 min-h-0">
          {/* Search & Category */}
          <div className="flex gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search products or SKU…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => window.location.reload()} className="h-10 w-10 flex-shrink-0">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? "bg-gray-900 text-white shadow"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-gray-400">Loading products…</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Package className="w-10 h-10 mb-2" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-3">
                {filteredProducts.map(product => {
                  const inCart = quantities[product.id] || 0;
                  const alreadyInOrder = existingQtyMap[product.id] != null;
                  const price = product.price_base || 0;
                  const displayName = language === 'Hebrew' && product.name_hebrew ? product.name_hebrew : product.name;

                  return (
                    <button
                      key={product.id}
                      onClick={() => handleCardClick(product)}
                      className={`relative bg-white rounded-xl border-2 p-3 text-left transition-all hover:shadow-md active:scale-95 ${
                        inCart > 0
                          ? "border-green-500 shadow-green-100 shadow-md"
                          : alreadyInOrder
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-100 hover:border-gray-300"
                      }`}
                    >
                      {/* Already-in-order badge */}
                      {alreadyInOrder && inCart === 0 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                          {existingQtyMap[product.id]}
                        </div>
                      )}
                      {inCart > 0 && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                          {inCart}
                        </div>
                      )}

                      {/* Product image */}
                      <div className="aspect-square w-full mb-2 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        {product.image_url ? (
                          <img src={product.image_url} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-8 h-8 text-gray-300" />
                        )}
                      </div>

                      {/* Product info */}
                      <div className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2rem]">
                        {displayName}
                      </div>
                      {product.subcategory && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{product.subcategory}</div>
                      )}

                      {/* Price and quantity controls */}
                      <div className="mt-1.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-green-600">₪{price.toFixed(2)}</span>
                          {product.unit && product.unit !== "each" && (
                            <span className="text-xs text-gray-400">{product.unit}</span>
                          )}
                        </div>

                        {/* "Already in order" hint when not editing */}
                        {alreadyInOrder && inCart === 0 && (
                          <div className="text-xs text-blue-600 font-medium text-center py-1">
                            In order (×{existingQtyMap[product.id]}) — tap to edit
                          </div>
                        )}

                        {/* Quantity controls + action button */}
                        {inCart > 0 && (
                          <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1 bg-gray-50 rounded-lg p-1">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleQuantityChange(product.id, -1);
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                              >
                                <Minus className="w-3 h-3 text-gray-600" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-gray-800">{inCart}</span>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleQuantityChange(product.id, 1);
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center hover:bg-green-100 transition-colors"
                              >
                                <Plus className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                handleAddItem(product);
                              }}
                              className={`w-full text-white text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                                alreadyInOrder
                                  ? "bg-blue-500 hover:bg-blue-600"
                                  : "bg-green-600 hover:bg-green-700"
                              }`}
                            >
                              {alreadyInOrder ? "Update Quantity" : "Add to Order"}
                            </button>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}