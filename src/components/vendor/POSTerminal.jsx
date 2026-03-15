import React, { useState, useEffect, useRef, useCallback } from "react";
import { Product, Order, Household } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "../i18n/LanguageContext";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Receipt,
  X,
  CheckCircle,
  Package,
  User,
  ChevronRight,
  Tag,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { generateOrderNumber } from "@/components/OrderUtils";

export default function POSTerminal({ vendorId, vendor, user }) {
  const { language, isRTL } = useLanguage();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState([]);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [householdSearch, setHouseholdSearch] = useState("");
  const [showHouseholdPicker, setShowHouseholdPicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, householdsData] = await Promise.all([
        Product.filter({ vendor_id: vendorId, is_draft: false }),
        Household.list(),
      ]);
      setProducts(productsData);
      setHouseholds(householdsData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = ["all", ...Array.from(new Set(products.map(p => p.subcategory).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.name_hebrew?.includes(search) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "all" || p.subcategory === selectedCategory;
    return matchSearch && matchCat;
  });

  const filteredHouseholds = households.filter(h => {
    const q = householdSearch.toLowerCase();
    return (
      h.name?.toLowerCase().includes(q) ||
      h.name_hebrew?.includes(q) ||
      h.household_code?.includes(q)
    );
  });

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const price = product.price_customer_kcs ?? product.price_customer_app ?? product.price_base ?? 0;
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        product_name_hebrew: product.name_hebrew,
        sku: product.sku,
        subcategory: product.subcategory,
        subcategory_hebrew: product.subcategory_hebrew,
        price,
        quantity: 1,
        unit: product.unit || "each",
        quantity_per_unit: product.quantity_in_unit,
        image: product.image_url,
      }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev =>
      prev
        .map(i => i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0)
    );
  };

  const removeItem = (productId) => {
    setCart(prev => prev.filter(i => i.product_id !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!cart.length || !paymentMethod) return;
    setIsPlacingOrder(true);
    try {
      const orderNumber = generateOrderNumber(vendorId, selectedHousehold?.id || "pos");
      const orderData = {
        order_number: orderNumber,
        user_email: selectedHousehold?.owner_user_id || user.email,
        vendor_id: vendorId,
        household_id: selectedHousehold?.id || null,
        household_code: selectedHousehold?.household_code || null,
        household_name: selectedHousehold?.name || null,
        household_name_hebrew: selectedHousehold?.name_hebrew || null,
        items: cart.map(i => ({
          product_id: i.product_id,
          sku: i.sku,
          product_name: i.product_name,
          product_name_hebrew: i.product_name_hebrew,
          subcategory: i.subcategory,
          subcategory_hebrew: i.subcategory_hebrew,
          quantity: i.quantity,
          price: i.price,
          unit: i.unit,
          quantity_per_unit: i.quantity_per_unit,
          actual_quantity: i.quantity,
          shopped: true,
          available: true,
        })),
        total_amount: cartTotal,
        status: "delivered",
        payment_status: "kcs",
        is_billed: false,
        is_paid: true,
        payment_method: paymentMethod === "cash" ? "kcs_cash" : "clientCC",
        street: selectedHousehold?.street || "POS",
        building_number: selectedHousehold?.building_number || "0",
        order_currency: "ILS",
        order_language: language,
      };
      const created = await Order.create(orderData);
      setOrderSuccess({ orderNumber, total: cartTotal, paymentMethod });
      setCart([]);
      setPaymentMethod(null);
      setSelectedHousehold(null);
    } catch (e) {
      console.error(e);
      alert("Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const dismissSuccess = () => setOrderSuccess(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Success overlay
  if (orderSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-2xl p-10 text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Order Placed!</h2>
          <p className="text-gray-500 text-sm mb-4">{orderSuccess.orderNumber}</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Paid</span>
              <span className="font-bold text-gray-900">₪{orderSuccess.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment</span>
              <span className="font-medium capitalize flex items-center gap-1">
                {orderSuccess.paymentMethod === "cash"
                  ? <><Banknote className="w-3 h-3" /> Cash</>
                  : <><CreditCard className="w-3 h-3" /> Card</>}
              </span>
            </div>
          </div>
          <Button onClick={dismissSuccess} className="w-full bg-green-600 hover:bg-green-700">
            New Sale
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-4 h-[calc(100vh-220px)] min-h-[600px] ${isRTL ? "flex-row-reverse" : ""}`}>
      {/* LEFT: Product browser */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? "right-3" : "left-3"}`} />
            <Input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products, SKU…"
              className={`h-10 ${isRTL ? "pr-9" : "pl-9"}`}
            />
            {search && (
              <button onClick={() => setSearch("")} className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 ${isRTL ? "left-3" : "right-3"}`}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={loadData} className="h-10 w-10 flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
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
              {cat === "all" ? (language === "Hebrew" ? "הכל" : "All") : cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Package className="w-10 h-10 mb-2" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts.map(product => {
                const inCart = cart.find(i => i.product_id === product.id);
                const price = product.price_customer_kcs ?? product.price_customer_app ?? product.price_base ?? 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`relative bg-white rounded-xl border-2 p-3 text-left transition-all hover:shadow-md active:scale-95 ${
                      inCart ? "border-green-500 shadow-green-100 shadow-md" : "border-gray-100 hover:border-gray-300"
                    }`}
                  >
                    {inCart && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                        {inCart.quantity}
                      </div>
                    )}
                    <div className="aspect-square w-full mb-2 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2rem]">
                      {language === "Hebrew" && product.name_hebrew ? product.name_hebrew : product.name}
                    </div>
                    {product.subcategory && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate">{product.subcategory}</div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-green-600">₪{price.toFixed(2)}</span>
                      {product.unit && product.unit !== "each" && (
                        <span className="text-xs text-gray-400">{product.unit}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart panel */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Cart header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-800">Current Sale</span>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Household selector */}
        <div className="px-3 py-2 border-b border-gray-100">
          {selectedHousehold ? (
            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-purple-800 truncate">
                    {language === "Hebrew" && selectedHousehold.name_hebrew ? selectedHousehold.name_hebrew : selectedHousehold.name}
                  </div>
                  <div className="text-xs text-purple-500">#{selectedHousehold.household_code?.slice(0, 4)}</div>
                </div>
              </div>
              <button onClick={() => setSelectedHousehold(null)} className="text-purple-400 hover:text-purple-600 ml-2">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowHouseholdPicker(true)}
              className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-lg px-3 py-2 transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Assign to Household (optional)</span>
            </button>
          )}
        </div>

        {/* Household picker dropdown */}
        {showHouseholdPicker && (
          <div className="absolute z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 mt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Select Household</span>
              <button onClick={() => setShowHouseholdPicker(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <Input
              placeholder="Search..."
              value={householdSearch}
              onChange={e => setHouseholdSearch(e.target.value)}
              className="h-8 text-sm mb-2"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredHouseholds.slice(0, 20).map(h => (
                <button
                  key={h.id}
                  onClick={() => { setSelectedHousehold(h); setShowHouseholdPicker(false); setHouseholdSearch(""); }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-800">{language === "Hebrew" && h.name_hebrew ? h.name_hebrew : h.name}</div>
                  <div className="text-xs text-gray-400">#{h.household_code?.slice(0, 4)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-300">
              <ShoppingCart className="w-10 h-10 mb-2" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Tap a product to add</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 leading-tight truncate">
                    {language === "Hebrew" && item.product_name_hebrew ? item.product_name_hebrew : item.product_name}
                  </div>
                  <div className="text-xs text-gray-500">₪{item.price.toFixed(2)} × {item.quantity} = <span className="font-bold text-gray-700">₪{(item.price * item.quantity).toFixed(2)}</span></div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateQty(item.product_id, -1)} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50 hover:border-red-300 transition-colors">
                    <Minus className="w-3 h-3 text-gray-600" />
                  </button>
                  <span className="w-6 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, 1)} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-green-50 hover:border-green-300 transition-colors">
                    <Plus className="w-3 h-3 text-gray-600" />
                  </button>
                  <button onClick={() => removeItem(item.product_id)} className="w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100">
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary & checkout */}
        {cart.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
            {/* Totals */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Items ({cartCount})</span>
                <span>₪{cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900">
                <span>Total</span>
                <span className="text-green-600">₪{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5 font-medium">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    paymentMethod === "cash"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Banknote className="w-4 h-4" /> Cash
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    paymentMethod === "card"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> Card
                </button>
              </div>
            </div>

            {/* Charge button */}
            <Button
              onClick={handlePlaceOrder}
              disabled={!paymentMethod || isPlacingOrder}
              className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isPlacingOrder ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  Charge ₪{cartTotal.toFixed(2)}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}