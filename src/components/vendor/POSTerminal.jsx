import React, { useState, useEffect, useRef } from "react";
import { Product, Order, Household } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "../i18n/LanguageContext";
import {
  Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
  Receipt, X, CheckCircle, Package, User, ChevronRight, Loader2, RefreshCw, Sparkles,
} from "lucide-react";
import { generateOrderNumber } from "@/components/OrderUtils";
import AddProductFromImageModal from "./AddProductFromImageModal";

const newCart = (id) => ({ id, label: `Cart ${id}`, items: [], household: null, paymentMethod: null });

export default function POSTerminal({ vendorId, vendor, user }) {
  const { language, isRTL } = useLanguage();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [households, setHouseholds] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Multi-cart state
  const [carts, setCarts] = useState([newCart(1)]);
  const [activeCartId, setActiveCartId] = useState(1);
  const [nextCartId, setNextCartId] = useState(2);

  // Per-cart UI state
  const [showHouseholdPicker, setShowHouseholdPicker] = useState(false);
  const [householdSearch, setHouseholdSearch] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => { loadData(); }, [vendorId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, householdsData] = await Promise.all([
        Product.filter({ vendor_id: vendorId, is_draft: false }),
        Household.list(),
      ]);
      setProducts(productsData);
      setHouseholds(householdsData);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  // Helpers
  const activeCart = carts.find(c => c.id === activeCartId) || carts[0];

  const updateActiveCart = (updater) => {
    setCarts(prev => prev.map(c => c.id === activeCartId ? updater(c) : c));
  };

  const addCart = () => {
    const id = nextCartId;
    setCarts(prev => [...prev, newCart(id)]);
    setActiveCartId(id);
    setNextCartId(id + 1);
  };

  const removeCart = (cartId) => {
    if (carts.length === 1) return;
    const remaining = carts.filter(c => c.id !== cartId);
    setCarts(remaining);
    if (activeCartId === cartId) setActiveCartId(remaining[0].id);
  };

  // Product grid helpers
  const categories = ["all", ...Array.from(new Set(products.map(p => p.subcategory).filter(Boolean)))];
  const filteredProducts = products.filter(p => {
    const matchSearch = !search ||
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.name_hebrew?.includes(search) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "all" || p.subcategory === selectedCategory;
    return matchSearch && matchCat;
  });

  const filteredHouseholds = households.filter(h => {
    const q = householdSearch.toLowerCase();
    return h.name?.toLowerCase().includes(q) || h.name_hebrew?.includes(q) || h.household_code?.includes(q);
  });

  // Cart operations
  const addToCart = (product) => {
    const price = product.price_customer_kcs ?? product.price_customer_app ?? product.price_base ?? 0;
    updateActiveCart(cart => {
      const existing = cart.items.find(i => i.product_id === product.id);
      if (existing) {
        return { ...cart, items: cart.items.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i) };
      }
      return {
        ...cart,
        items: [...cart.items, {
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
        }]
      };
    });
  };

  const updateQty = (productId, delta) => {
    updateActiveCart(cart => ({
      ...cart,
      items: cart.items.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0)
    }));
  };

  const removeItem = (productId) => {
    updateActiveCart(cart => ({ ...cart, items: cart.items.filter(i => i.product_id !== productId) }));
  };

  const setCartHousehold = (household) => {
    updateActiveCart(cart => ({ ...cart, household }));
    setShowHouseholdPicker(false);
    setHouseholdSearch("");
  };

  const setCartPaymentMethod = (method) => {
    updateActiveCart(cart => ({ ...cart, paymentMethod: method }));
  };

  const setCartStatus = (status) => {
    updateActiveCart(cart => ({ ...cart, orderStatus: status }));
  };

  const setCartDeliveryPrice = (price) => {
    updateActiveCart(cart => ({ ...cart, deliveryPrice: parseFloat(price) || 0 }));
  };

  const cartSubtotal = activeCart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartDeliveryPrice = activeCart.deliveryPrice || 0;
  const cartTotal = cartSubtotal + cartDeliveryPrice;
  const cartCount = activeCart.items.reduce((sum, i) => sum + i.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!activeCart.items.length || !activeCart.paymentMethod) return;
    setIsPlacingOrder(true);
    try {
      const orderNumber = generateOrderNumber(vendorId, activeCart.household?.id || "pos");
      await Order.create({
        order_number: orderNumber,
        user_email: activeCart.household?.owner_user_id || user.email,
        vendor_id: vendorId,
        household_id: activeCart.household?.id || null,
        household_code: activeCart.household?.household_code || null,
        household_name: activeCart.household?.name || null,
        household_name_hebrew: activeCart.household?.name_hebrew || null,
        items: activeCart.items.map(i => ({
          product_id: i.product_id, sku: i.sku,
          product_name: i.product_name, product_name_hebrew: i.product_name_hebrew,
          subcategory: i.subcategory, subcategory_hebrew: i.subcategory_hebrew,
          quantity: i.quantity, price: i.price, unit: i.unit,
          quantity_per_unit: i.quantity_per_unit,
          actual_quantity: i.quantity, shopped: true, available: true,
        })),
        delivery_price: cartDeliveryPrice,
        total_amount: cartTotal,
        status: activeCart.orderStatus || "delivered",
        payment_status: "kcs",
        is_billed: false,
        is_paid: true,
        payment_method: activeCart.paymentMethod === "cash" ? "kcs_cash" : "clientCC",
        street: activeCart.household?.street || "POS",
        building_number: activeCart.household?.building_number || "0",
        order_currency: "ILS",
        order_language: language,
      });
      setOrderSuccess({ orderNumber, total: cartTotal, paymentMethod: activeCart.paymentMethod, cartId: activeCartId });
      // Clear the cart after success
      updateActiveCart(cart => ({ ...cart, items: [], household: null, paymentMethod: null }));
    } catch (e) {
      console.error(e);
      alert("Failed to place order");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-220px)] min-h-[600px]">
      {/* Cart Tabs */}
      <div className={`flex items-center gap-1 overflow-x-auto pb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
        {carts.map(cart => {
          const total = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
          const count = cart.items.reduce((s, i) => s + i.quantity, 0);
          const isActive = cart.id === activeCartId;
          return (
            <div
              key={cart.id}
              onClick={() => setActiveCartId(cart.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer flex-shrink-0 transition-all ${
                isActive
                  ? "border-gray-900 bg-gray-900 text-white shadow"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">
                {cart.household
                  ? (language === "Hebrew" && cart.household.name_hebrew ? cart.household.name_hebrew : cart.household.name)
                  : cart.label}
              </span>
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-white text-gray-900" : "bg-gray-900 text-white"}`}>
                  {count}
                </span>
              )}
              {count > 0 && (
                <span className={`text-xs font-medium ${isActive ? "text-green-300" : "text-green-600"}`}>
                  ₪{total.toFixed(0)}
                </span>
              )}
              {carts.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeCart(cart.id); }}
                  className={`ml-1 rounded-full p-0.5 transition-colors ${isActive ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={addCart}
          className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600 flex-shrink-0 transition-all text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> New Cart
        </button>
      </div>

      {/* Success banner (inline, not full-page) */}
      {orderSuccess && orderSuccess.cartId === activeCartId && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <span className="text-sm font-semibold text-green-800">Order placed!</span>
              <span className="text-sm text-green-700 ml-2">{orderSuccess.orderNumber}</span>
              <span className="text-sm text-green-600 ml-2">₪{orderSuccess.total.toFixed(2)}</span>
            </div>
          </div>
          <button onClick={() => setOrderSuccess(null)} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main POS area */}
      <div className={`flex gap-4 flex-1 overflow-hidden ${isRTL ? "flex-row-reverse" : ""}`}>
        {/* LEFT: Product browser */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? "right-3" : "left-3"}`} />
              <Input
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
            <Button onClick={() => setShowAddProduct(true)} className="h-10 flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
              <Sparkles className="w-4 h-4" /> Add Product
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
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

          <div className="flex-1 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Package className="w-10 h-10 mb-2" />
                <p className="text-sm">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(product => {
                  const inCart = activeCart.items.find(i => i.product_id === product.id);
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
                        {product.image_url
                          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          : <Package className="w-8 h-8 text-gray-300" />}
                      </div>
                      <div className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2rem]">
                        {language === "Hebrew" && product.name_hebrew ? product.name_hebrew : product.name}
                      </div>
                      {product.subcategory && <div className="text-xs text-gray-400 mt-0.5 truncate">{product.subcategory}</div>}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-sm font-bold text-green-600">₪{price.toFixed(2)}</span>
                        {product.unit && product.unit !== "each" && <span className="text-xs text-gray-400">{product.unit}</span>}
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
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-gray-600" />
              <span className="font-semibold text-gray-800">{activeCart.label}</span>
            </div>
            {activeCart.items.length > 0 && (
              <button onClick={() => updateActiveCart(c => ({ ...c, items: [] }))} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Household selector */}
          <div className="px-3 py-2 border-b border-gray-100 relative">
            {activeCart.household ? (
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-purple-800 truncate">
                      {language === "Hebrew" && activeCart.household.name_hebrew ? activeCart.household.name_hebrew : activeCart.household.name}
                    </div>
                    <div className="text-xs text-purple-500">#{activeCart.household.household_code?.slice(0, 4)}</div>
                  </div>
                </div>
                <button onClick={() => updateActiveCart(c => ({ ...c, household: null }))} className="text-purple-400 hover:text-purple-600 ml-2">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowHouseholdPicker(v => !v)}
                className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-lg px-3 py-2 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Assign to Household (optional)</span>
              </button>
            )}
            {showHouseholdPicker && (
              <div className="absolute left-2 right-2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 mt-1">
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
                      onClick={() => setCartHousehold(h)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-sm font-medium text-gray-800">{language === "Hebrew" && h.name_hebrew ? h.name_hebrew : h.name}</div>
                      <div className="text-xs text-gray-400">#{h.household_code?.slice(0, 4)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {activeCart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                <ShoppingCart className="w-10 h-10 mb-2" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Tap a product to add</p>
              </div>
            ) : (
              activeCart.items.map(item => (
                <div key={item.product_id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 leading-tight truncate">
                      {language === "Hebrew" && item.product_name_hebrew ? item.product_name_hebrew : item.product_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ₪{item.price.toFixed(2)} × {item.quantity} = <span className="font-bold text-gray-700">₪{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
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

          {/* Checkout */}
          {activeCart.items.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Items ({cartCount})</span>
                  <span>₪{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Shipping</span>
                  <div className="flex items-center gap-1">
                    <span>₪</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cartDeliveryPrice}
                      onChange={e => setCartDeliveryPrice(e.target.value)}
                      className="w-16 text-right text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-1">
                  <span>Total</span>
                  <span className="text-green-600">₪{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {["cash", "card"].map(method => (
                    <button
                      key={method}
                      onClick={() => setCartPaymentMethod(method)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                        activeCart.paymentMethod === method
                          ? method === "cash" ? "border-green-500 bg-green-50 text-green-700" : "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {method === "cash" ? <><Banknote className="w-4 h-4" /> Cash</> : <><CreditCard className="w-4 h-4" /> Card</>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Order Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{value: "delivered", label: "Delivered"}, {value: "ready_for_shipping", label: "Ready to Ship"}].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setCartStatus(opt.value)}
                      className={`py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        (activeCart.orderStatus || "delivered") === opt.value
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={handlePlaceOrder}
                disabled={!activeCart.paymentMethod || isPlacingOrder}
                className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isPlacingOrder
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Receipt className="w-4 h-4" /> Charge ₪{cartTotal.toFixed(2)} <ChevronRight className="w-4 h-4" /></>}
              </Button>
            </div>
          )}
        </div>
      </div>
      <AddProductFromImageModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        vendorId={vendorId}
        vendorSubcategories={vendor?.subcategories || []}
        onProductCreated={(p) => { setProducts(prev => [...prev, p]); }}
      />
    </div>
  );
}