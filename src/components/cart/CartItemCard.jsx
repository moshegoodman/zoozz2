
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
// Although outline removes Input, it's safer to keep for now if it's a common component. If not used, it will be removed.
import { Trash2, Plus, Minus } from "lucide-react";
import { useLanguage } from '../i18n/LanguageContext';
import { formatPrice } from '../i18n/priceUtils'; // New import

export default function CartItemCard({ item, onUpdateQuantity, onRemove, isUpdating, userType }) {
  const { t, language } = useLanguage();
  const [quantity, setQuantity] = useState(item.quantity); // Changed from localQuantity to quantity

  useEffect(() => {
    // Simplified useEffect for quantity synchronization
    setQuantity(item.quantity);
  }, [item.quantity]);

  // The stepValue, isLocalUpdating state, and related handlers (handleInputChange, handleInputBlur) are removed as per the outline's simpler quantity controls.
  // The outline implies integer quantity increments/decrements.

  const handleQuantityChange = (newQuantity) => {
    // Outline simplifies this logic significantly. No local updating state or complex rounding.
    if (newQuantity < 1) return; // Minimum quantity is 1 as per outline's button disable logic (quantity <= 1)
    setQuantity(newQuantity);
    onUpdateQuantity(item.id, newQuantity);
  };

  // Original handleRemove logic with isLocalUpdating is replaced by simpler call and reliance on isUpdating prop.
  // The outline does not include the isLocalUpdating state or complex error handling for remove.

  const displayName = language === 'Hebrew' ? (item.product_name_hebrew || item.product_name) : item.product_name;
  const itemTotal = item.product_price * quantity; // Calculation for item total

  return (
    <div className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
      {item.product_image && ( // Conditional rendering for image as per outline
        <img
          src={item.product_image}
          alt={displayName}
          className="w-20 h-20 object-cover rounded-md"
        />
      )}
      
      <div className="flex-1 min-w-0">
        {/* Product name display updated with displayName and no dir="rtl" attribute on h3 */}
        <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
        <div className="flex items-center gap-2 mt-1">
          {/* Price display now uses formatPrice and is no longer conditional on userType */}
          <span className="text-sm font-medium text-gray-900">
            {formatPrice(item.product_price, language)}
          </span>
          {/* Quantity in unit display simplified, without translated "per" text */}
          {item.quantity_in_unit && (
            <span className="text-xs text-gray-500">• {item.quantity_in_unit}</span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center border border-gray-300 rounded-md">
            <Button
              variant="ghost" // Changed from outline to ghost as per outline
              size="icon"
              className="h-8 w-8" // Adjusted size as per outline
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={isUpdating || quantity <= 1} // Disabled when updating or quantity is 1
            >
              <Minus className="w-4 h-4" />
            </Button>
            {/* Quantity display is now a span instead of an Input field */}
            <span className="w-12 text-center font-medium">{quantity}</span>
            <Button
              variant="ghost" // Changed from outline to ghost as per outline
              size="icon"
              className="h-8 w-8" // Adjusted size as per outline
              onClick={() => handleQuantityChange(quantity + 1)}
              disabled={isUpdating} // Disabled when updating
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Total price display uses formatPrice and is no longer conditional on userType */}
          <span className="text-sm font-semibold text-gray-900">
            {formatPrice(itemTotal, language)}
          </span>
        </div>
      </div>

      <Button
        variant="ghost" // Changed from ghost to ghost, but class/size adjusted
        size="icon"
        onClick={() => onRemove(item.id)} // Simplified onClick for remove
        disabled={isUpdating} // Disabled when updating
        className="text-red-600 hover:text-red-700 hover:bg-red-50" // Adjusted classes
      >
        <Trash2 className="w-5 h-5" /> {/* Adjusted size as per outline */}
        {/* sr-only span for remove button is removed as per outline */}
      </Button>
    </div>
  );
}
