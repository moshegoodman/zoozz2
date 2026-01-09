
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "../cart/CartContext";
import { ShoppingCart, Plus, Minus, ShieldCheck, ImageIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "../components/i18n/LanguageContext";


export default function ProductListItem({ product, userType, selectedHousehold, showVendor = false }) {
  const { getProductQuantity, addItemToCart, updateItemQuantity, cartItems, shoppingForHousehold } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);
  const quantity = getProductQuantity(product.id);
  const {language} = useLanguage();
  
  const getUnitLabel = (unit) => {
    const unitLabels = {
      'each': language === 'Hebrew' ? 'יחידה' : 'Each',
      'unit': language === 'Hebrew' ? 'יחידה' : 'Unit', // Added 'unit'
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

  const getDisplayPrice = () => {
    // If a KCS staff is shopping, or an admin/vendor/picker is shopping for a household, use KCS price.
    if ((userType === 'kcs staff' && selectedHousehold) || shoppingForHousehold) {
      return product.price_customer_kcs ?? product.price_base;
    }
    return product.price_customer_app ?? product.price_base;
  };

  const handleUpdate = async (targetQuantity) => {
    setIsAdding(true);
    try {
      const existingCartItem = cartItems.find(item => item.product_id === product.id);

      if (existingCartItem) {
        await updateItemQuantity(existingCartItem.id, targetQuantity);
      } else if (targetQuantity > 0) {
        await addItemToCart(product, targetQuantity);
      }
    } catch (error) {
      console.error("Error updating cart:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const incrementQuantity = () => handleUpdate(quantity + 1);
  const decrementQuantity = () => handleUpdate(quantity - 1);

  // Check if product's kashrut matches the household's preferences
  const householdContextForKosher = shoppingForHousehold || selectedHousehold;
  const isKosherForHousehold =
    householdContextForKosher?.kashrut_preferences?.length > 0 &&
    product.kashrut &&
    householdContextForKosher.kashrut_preferences.includes(product.kashrut);

  // Helper function to determine if we should show quantity in unit
  const shouldShowQuantityInUnit = () => {
    if (showVendor) return false; // Don't show if we're showing vendor instead
    if (!product.quantity_in_unit) return false;
    
    const packUnits = ['pack', 'unit', 'box', 'bag', 'each', 'case', 'container']; // Added 'container' here
    return packUnits.includes(product.unit?.toLowerCase());
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        <div className="w-20 h-20 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
          {!imageError && product.image_url ? (
            <img
              src={product.image_url}
             alt={language === 'Hebrew' ? product.name_hebrew : product.name}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <div className="text-center">
                <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                <p className="text-gray-500 font-medium text-xs leading-tight">
                  {product.name.length > 10 ? product.name.substring(0, 10) + '...' : product.name}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div className="min-w-0 flex-1">
            {language === 'Hebrew' ? product.name_hebrew && (
                <h3 className="font-semibold text-gray-700 truncate mt-1" style={{ direction: 'rtl' }}>
                  {product.name_hebrew}
                </h3>
              ):  <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>}
             
            { language === 'Hebrew' ? product.brand_hebrew && (
                <p className="text-sm text-gray-500" style={{ direction: 'rtl' }}>
                  {product.brand_hebrew}
                </p>
              ) :product.brand && (
                <p className="text-sm text-gray-500">{product.brand}</p>
              ) }
             
              
              {/* Show quantity in unit only for pack-like units */}
              {shouldShowQuantityInUnit() && (
                <p className="text-sm text-gray-600">
                  {product.quantity_in_unit} per {getUnitLabel(product.unit?.toLowerCase())}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xl font-bold text-green-600">
                ₪{getDisplayPrice()?.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">
                /{getUnitLabel(product.unit?.toLowerCase())}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isKosherForHousehold && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 cursor-default">
                         <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                         Kosher For Household
                       </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Matches household kashrut preferences.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {product.stock_quantity < 10 && (
                <Badge variant="destructive" className="text-xs">
                  Low Stock
                </Badge>
              )}
            </div>

            {quantity === 0 ? (
              <Button
                onClick={incrementQuantity}
                disabled={isAdding || product.stock_quantity === 0}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={decrementQuantity}
                  disabled={isAdding}
                  className="w-8 h-8"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="font-semibold px-2">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={incrementQuantity}
                  disabled={isAdding}
                  className="w-8 h-8"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
