import React, { useState, useCallback } from "react";
// import { Link } from 'react-router-dom'; // Not used in this component after changes
// import { Card } from "@/components/ui/card"; // Card component is not used in the final JSX structure
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, ShieldCheck, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// The useCart hook is removed as per the outline's prop-based cart management
import { useLanguage } from "../i18n/LanguageContext";
import { formatPrice } from '../i18n/priceUtils'; // Added import for formatPrice

// Placeholder for createPageUrl - replace with actual implementation if available in your project
const createPageUrl = (path) => {
  // This is a common pattern for generating internal application URLs.
  // Adjust based on your actual routing setup (e.g., using a base path or specific route names).
  return `/app/${path}`;
};

export default function ProductCard({
  product,
  onAddToCart,
  isInCart = false, // Added default from outline
  cartQuantity = 0, // Added default from outline
  onUpdateQuantity,
  userType = null,
  selectedHousehold,
  forHousehold,
  shoppingForHousehold, // Added this prop to maintain existing price logic after removing useCart
  vendor, // Added vendor prop
  hideVendorInfoInProductCard = false // Added new prop from outline
}) {
  const { t, language } = useLanguage();

  const [isLoading, setIsLoading] = useState(false); // Renamed from isAdding to isLoading as per outline

  const getUnitLabel = (unit) => {
    const unitLabels = {
      'each': language === 'Hebrew' ? 'כל אחד' : 'Each',
      'unit': language === 'Hebrew' ? 'יחידה' : 'Unit', // Added 'unit' as a unit of measure
      'lb': language === 'Hebrew' ? 'פאונד' : 'lb',
      'oz': language === 'Hebrew' ? 'אונקייה' : 'oz',
      'kg': language === 'Hebrew' ? 'קילוגרם' : 'kg',
      'pack': language === 'Hebrew' ? 'חבילה' : 'Pack',
      'bottle': language === 'Hebrew' ? 'בקבוק' : 'Bottle',
      'box': language === 'Hebrew' ? 'קופסה' : 'Box',
      'bag': language === 'Hebrew' ? 'שקית' : 'Bag',
      'case': language === 'Hebrew' ? 'ארגז' : 'Case',
      'container': language === 'Hebrew' ? 'קופסא' : 'Container'
    };
    return unitLabels[unit] || unit;
  };

  // Vendor name state and related useEffect are removed as per requirement "remove vendor info"

  // Helper function to determine the correct product price based on the current context (user type/household)
  // Move useCallback to the top, before any early returns
  const getProductPrice = useCallback((productItem) => {
    const activeHousehold = selectedHousehold || shoppingForHousehold;

    if (activeHousehold) {
      if (activeHousehold.household_type === 'private') {
        return productItem.price_customer_app ?? productItem.price_base ?? 0;
      }
      return productItem.price_customer_kcs ?? productItem.price_base ?? 0;
    }

    if (['vendor', 'picker', 'admin', 'chief of staff', 'kcs staff', 'household owner'].includes(userType)) {
      return productItem.price_customer_kcs ?? productItem.price_base ?? 0;
    }

    return productItem.price_customer_app ?? productItem.price_base ?? 0;
  }, [selectedHousehold, shoppingForHousehold, userType]);

  const handleAddToCart = async () => {
    // Quantity check (e.g., quantity <= 0) is assumed to be handled by the parent component or
    // the onAddToCart function passed as a prop. For initial add, quantity is 1.
    setIsLoading(true);
    try {
      // Assuming onAddToCart takes product_id, quantity, and selectedHousehold
      await onAddToCart(product.id, 1, selectedHousehold);
    } catch (error) {
      console.error("Failed to add item to cart:", error);
      alert(t('products.alertAddToCartFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // handleIncreaseQuantity, handleDecreaseQuantity, incrementQuantity, and decrementQuantity
  // are replaced by direct calls to the onUpdateQuantity prop in the JSX.

  // Early return AFTER all hooks
  if (!product) {
    return null;
  }

  const isRTL = language === 'Hebrew';
  const productName = isRTL ? product.name_hebrew : product.name;
  const productNameOpposite = isRTL ? product.name : product.name_hebrew;
  // productNameOpLanguage is removed to make the card smaller
  // productDescription is not used in the JSX, so it can be omitted
  const brandName = isRTL ? product.brand_hebrew : product.brand;
  // const subcategory = isRTL ? product.subcategory_hebrew : product.subcategory; // Not used

  // Price calculation now uses the useCallback version consistently
  const currentProductPrice = getProductPrice(product);

  const householdContextForKosher = selectedHousehold;
  const isKosherForHousehold =
  householdContextForKosher?.kashrut_preferences?.length > 0 &&
  product.kashrut &&
  householdContextForKosher.kashrut_preferences.includes(product.kashrut);

  const shouldShowQuantityInUnit = () => {
    return !!product.quantity_in_unit;
  };

  const perUnitText = isRTL ?
  `${product.quantity_in_unit} ${t('products.per')}${getUnitLabel(product.unit?.toLowerCase())}` :
  `${product.quantity_in_unit} ${t('products.per')} ${getUnitLabel(product.unit?.toLowerCase())}`;

  const canAdd = currentProductPrice != null && !isLoading;

  return (
    <div
      className={`relative bg-white rounded-xl border-2 p-3 text-left transition-all hover:shadow-md flex flex-col h-full ${
      isInCart ? "border-green-500 shadow-green-100 shadow-md" : "border-gray-100 hover:border-gray-300"}`
      }>
      
      {product.is_draft &&
      <Badge
        variant="outline"
        className="absolute top-1 left-1 bg-orange-500 text-white border-none text-xs px-2 py-0.5 z-10">
        
          {t('vendor.productManagement.draft', 'Draft')}
        </Badge>
      }

      {/* Tappable area: image + info adds to cart */}
      <div
        className={`flex-1 ${canAdd && !isInCart ? "cursor-pointer active:scale-95 transition-transform" : ""}`}
        onClick={() => {if (canAdd && !isInCart) handleAddToCart();}}>
        
        <div className="relative aspect-square w-full mb-2 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
          {product.image_url ?
          <img
            loading="lazy"
            src={product.image_url}
            alt={productName}
            className="w-full h-full object-cover"
            onError={(e) => {
              if (vendor?.banner_url && e.target.src !== vendor.banner_url) {
                e.target.src = vendor.banner_url;
              } else if (vendor?.image_url && e.target.src !== vendor.image_url) {
                e.target.src = vendor.image_url;
              } else {
                e.target.src = 'https://placehold.co/400x300/f0f0f0/cccccc?text=';
              }
            }} /> :

          vendor?.banner_url ?
          <img
            src={vendor.banner_url}
            alt={productName}
            className="w-full h-full object-cover"
            onError={(e) => {
              if (vendor?.image_url && e.target.src !== vendor.image_url) {
                e.target.src = vendor.image_url;
              } else {
                e.target.src = 'https://placehold.co/400x300/f0f0f0/cccccc?text=';
              }
            }} /> :

          vendor?.image_url ?
          <img
            src={vendor.image_url}
            alt={productName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = 'https://placehold.co/400x300/f0f0f0/cccccc?text=';
            }} /> :


          <Package className="w-8 h-8 text-gray-300" />
          }
          {brandName &&
          <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
              {brandName}
            </div>
          }
          {isLoading &&
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            </div>
          }
        </div>

        <div className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2 min-h-[2rem]" style={isRTL ? { direction: 'rtl' } : {}}>
          {productName}
        </div>
        {productNameOpposite &&
        <div className="text-xs text-gray-400 mt-0.5 line-clamp-1" style={!isRTL ? { direction: 'rtl' } : {}}>
            {productNameOpposite}
          </div>
        }

        {shouldShowQuantityInUnit() &&
        <p className="text-xs text-gray-400 mt-0.5 truncate">{perUnitText}</p>
        }

        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-sm font-bold text-green-600">
            {formatPrice(currentProductPrice, language, vendor?.country)}
          </span>
          {product.unit && product.unit !== "each" &&
          <span className="text-xs text-gray-400">{getUnitLabel(product.unit?.toLowerCase())}</span>
          }
        </div>

        {isKosherForHousehold &&
        <div className="mt-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-blue-700 bg-blue-100 text-xs px-1 py-0">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Kosher
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Matches household kashrut preferences</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        }
      </div>

      {/* +/- stepper when in cart */}
      {isInCart &&
      <div className="mt-2 flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
          <button
          type="button"
          onClick={() => onUpdateQuantity(product.id, Math.max(0, cartQuantity - 1))}
          className="w-5 h-5 rounded-full bg-red-50 border border-red-200 flex items-center justify-center hover:bg-red-100 transition-colors flex-shrink-0 opacity-100 text-sm">
          
            <Minus className="w-3 h-3 text-red-600" />
          </button>
          <span className="flex-1 min-w-0 text-center text-sm font-bold text-gray-800">
            {cartQuantity}
          </span>
          <button
          type="button"
          onClick={() => onUpdateQuantity(product.id, cartQuantity + 1)}
          className="w-5 h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors flex-shrink-0 opacity-65 text-sm">
          
            <Plus className="w-3 h-3 text-green-600" />
          </button>
        </div>
      }
    </div>);

}