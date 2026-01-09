
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
  const getProductPrice = useCallback((productItem) => { // Renamed product to productItem to avoid shadowing
      let priceValue = productItem.price_customer_app; // Default price
      if(['vendor', 'picker', 'admin', 'chief of staff','kcs staff','household owner'].includes(userType)){
          priceValue = productItem.price_customer_kcs;
      }
      // If shopping for any household (KCS or Vendor/Picker/Admin/Chief of Staff), use KCS price
      if (selectedHousehold || shoppingForHousehold) {
          priceValue = productItem.price_customer_kcs;
      }
      return priceValue ?? productItem.price_base ?? 0;
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
    // The previous condition included `!hideVendorInfo`. Since vendor info is removed,
    // and to preserve existing functionality, the condition is now only based on product data.
    if (!product.quantity_in_unit) return false;

    const packUnits = ['pack', 'unit', 'box', 'bag', 'each', 'case', 'container']; // Added 'case' and 'container' here, and 'unit'
    return packUnits.includes(product.unit?.toLowerCase());
  };

  const perUnitText = isRTL
    ? `${product.quantity_in_unit} ${t('products.per')}${getUnitLabel(product.unit?.toLowerCase())}`
    : `${product.quantity_in_unit} ${t('products.per')} ${getUnitLabel(product.unit?.toLowerCase())}`;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200 flex flex-col h-full relative">
      {product.is_draft && (
        <Badge
          variant="outline"
          className="absolute top-1 left-1 bg-orange-500 text-white border-none text-xs px-2 py-0.5 z-10"
        >
          {t('vendor.productManagement.draft', 'Draft')}
        </Badge>
      )}
      {/* Product Image - Much smaller */}
      <div className="relative w-full h-20 overflow-hidden rounded-t-lg bg-gray-100">
        {product.image_url ? (
          <img
          loading="lazy"
            src={product.image_url}
            alt={productName}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              // If product image fails, try vendor images
              if (vendor?.banner_url && e.target.src !== vendor.banner_url) {
                e.target.src = vendor.banner_url;
              } else if (vendor?.image_url && e.target.src !== vendor.image_url) {
                e.target.src = vendor.image_url;
              } else {
                e.target.src = 'https://placehold.co/400x300/f0f0f0/cccccc?text=';
              }
            }}
          />
        ) : vendor?.banner_url ? (
          <img
            src={vendor.banner_url}
            alt={productName}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              if (vendor?.image_url && e.target.src !== vendor.image_url) {
                e.target.src = vendor.image_url;
              } else {
                e.target.src = 'https://placehold.co/400x300/f0f0f0/cccccc?text=';
              }
            }}
          />
        ) : vendor?.image_url ? (
          <img
            src={vendor.image_url}
            alt={productName}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              e.target.src = 'https://placehold.co/400x300/f0f0f0/cccccc?text=';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package className="w-5 h-5" />
          </div>
        )}
        {brandName && (
          <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
            {brandName}
          </div>
        )}
      </div>

      {/* Product Info - Very compact */}
      <div className="p-2 flex-1 flex flex-col">
        {/* Vendor Name section removed as per requirements */}

        {/* Product Name */}
        <h3 className={`font-medium text-gray-900 text-xs line-clamp-2 mb-1 leading-tight`} style={isRTL ? {direction: 'rtl'} : {}}>
          {productName}
        </h3>
        {/*product name of opposite language so people know what the product is called in both languages */}
         <h3 className={`font-medium text-gray-900 text-xs line-clamp-2 mb-1 leading-tight`} style={isRTL ? {direction: 'rtl'} : {}}>
          {productNameOpposite}
        </h3>
        {/**no reason to show subcategory*/}

        {/* Show quantity in unit only for pack-like units */}
        {shouldShowQuantityInUnit() && (
            <p className={`text-gray-600 text-xs`}>
              {perUnitText}
            </p>
          )}

        <div className="mt-auto">
          {/* Price display - unified using formatPrice */}
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm font-bold text-gray-900">
              {formatPrice(currentProductPrice, language)}
            </span>
            {product.quantity_in_unit && (
              <span className="text-xs text-gray-500 ml-1">
                / {product.quantity_in_unit} {getUnitLabel(product.unit?.toLowerCase())}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-1">
            {isKosherForHousehold && (
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
            )}
          </div>

          {/* Conditional rendering based on isInCart prop */}
          {!isInCart ? (
            <Button type="button"
              className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1 h-6"
              onClick={handleAddToCart}
              disabled={currentProductPrice == null || isLoading} // Uses currentProductPrice for disabled state
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              ) : (
                <>
                  <Plus className="w-3 h-3 mr-1" />
                  {t('products.addToCart')}
                </>
              )}
            </Button >
          ) : (
            <div className="flex items-center justify-between bg-green-50 rounded-md p-0.5">
              <Button type="button"
                variant="outline"
                size="sm"
                onClick={() => onUpdateQuantity(product.id, Math.max(0, cartQuantity - 1))}
                className="h-5 w-5 p-0"
              >
                <Minus className="w-2 h-2" />
              </Button>
              <span className="mx-1 font-medium text-xs text-center">
                {cartQuantity} {getUnitLabel(product.unit?.toLowerCase())}
              </span>
              <Button type="button"
                variant="outline"
                size="sm"
                onClick={() => onUpdateQuantity(product.id, cartQuantity + 1)}
                className="h-5 w-5 p-0"
              >
                <Plus className="w-2 h-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
