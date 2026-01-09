
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Ban, Plus, Minus, Package } from 'lucide-react';
import OrderItemEditDialog from './OrderItemEditDialog';
import { useLanguage } from '../i18n/LanguageContext';

export default function OrderItemRow({ item, onItemUpdate, vendorId, order, vendorProducts = [], isExpanded, onToggleExpand, onSave, readOnly }) {
  const { t, language, isRTL } = useLanguage();
  const [productInfo, setProductInfo] = useState(null);
  
  // Changed state variable name from 'weight' to 'currentQuantity'
  // and updated default value for actual_quantity to be blank for 0, null, or undefined
const [currentQuantity, setCurrentQuantity] = useState(() => {
  const qty = item.actual_quantity;
  return (qty === 0 || qty === null || qty === undefined) ? '' : qty.toString();
});
  // Added new state variable for availability
  const [isAvailable, setIsAvailable] = useState(item.available);

  const [isWeightEditorOpen, setIsWeightEditorOpen] = useState(false);
  const [showSubstituteDialog, setShowSubstituteDialog] = useState(false);

  // Effect to update currentQuantity when item.actual_quantity or item.quantity changes
  useEffect(() => {
    const qty = item.actual_quantity;
    setCurrentQuantity((qty === 0 || qty === null || qty === undefined) ? '' : qty);
  }, [item.actual_quantity, item.quantity]);

  // Effect to update isAvailable when item.available prop changes
  useEffect(() => {
    setIsAvailable(item.available);
  }, [item.available]);

  useEffect(() => {
    const p = vendorProducts.find(p => p.id === item.product_id);
    if (p) {
      setProductInfo(p);
    } else {
      setProductInfo({
        image_url: "https://via.placeholder.com/40?text=?",
        name: item.product_name,
        name_hebrew: item.product_name_hebrew,
      });
    }
  }, [item.product_id, vendorProducts, item.product_name, item.product_name_hebrew]);

  const handleWeightChange = (newWeight) => {
    if (readOnly || newWeight === null || isNaN(newWeight)) {
      // If it's NaN or null, or readOnly, we don't want to proceed with the update.
      // But we still might want to reset the input display if it's invalid.
      // For simplicity, if invalid, we can just return or set to the last valid state if needed.
      // Current behavior: if readOnly or invalid, it just stops.
      return;
    }
    if (typeof onItemUpdate !== 'function') {
      console.error("onItemUpdate is not a function in OrderItemRow (handleWeightChange)");
      return;
    }
    
    // If newWeight is 0, set currentQuantity as empty string for display, otherwise use the number
    const displayValue = newWeight === 0 ? '' : newWeight;
    setCurrentQuantity(displayValue); // Set local state for input display

    const updatedItem = {
      ...item,
      actual_quantity: newWeight // actual_quantity itself should be the number 0, not ''
    };
    onItemUpdate(updatedItem);
    if (onSave) {
      onSave(updatedItem);
    }
  };

  const handleAvailabilityToggle = () => {
    // This function is not currently used in the component's JSX.
    // Preserving it as is, but primary availability toggle uses handleUnavailableToggle.
    if (typeof onItemUpdate !== 'function') {
      console.error("onItemUpdate is not a function in OrderItemRow (handleAvailabilityToggle)");
      return;
    }
    const updatedItem = {
      ...item,
      available: !item.available,
      actual_quantity: item.actual_quantity !== null && item.actual_quantity !== undefined
        ? item.actual_quantity
        : item.available ? 0 : item.quantity
    };
    onItemUpdate(updatedItem);
    if (onSave) {
      onSave(updatedItem);
    }
  };

  const handleUnavailableToggle = () => {
    const updatedAvailableStatus = !isAvailable; // Use local state for immediate feedback
    setIsAvailable(updatedAvailableStatus); // Optimistic update

    const updatedItem = {
      ...item,
      available: updatedAvailableStatus, // Update the item object with new status
      shopped: updatedAvailableStatus ? item.shopped : false // If becoming unavailable, set shopped to false
    };
    
    if (onItemUpdate) {
      onItemUpdate(updatedItem);
    }
    if (onSave) {
      onSave(updatedItem);
    }
  };

  const handleSubstituteClick = () => {
    setShowSubstituteDialog(true);
  };

  const handleSubstituteSave = (substituteData) => {
    const updatedItem = {
      ...item,
      substitute_product_id: substituteData.product_id,
      substitute_product_name: substituteData.product_name,
      price: substituteData.price || item.price,
      modified: true,
      shopped: true,
      available: true
    };
    if (onItemUpdate) {
      onItemUpdate(updatedItem);
    }
    if (onSave) {
      onSave(updatedItem);
    }
    setShowSubstituteDialog(false);
  };

  const openWeightEditor = (itemToEdit) => {
    setIsWeightEditorOpen(true);
  };

  const closeWeightEditor = () => {
    setIsWeightEditorOpen(false);
  };

  const handleSaveFromDialog = (updatedItemData) => {
    if (typeof onItemUpdate === 'function') {
      onItemUpdate(updatedItemData);
    } else {
      console.error("onItemUpdate is not a function in OrderItemRow (handleSaveFromDialog)");
    }
    if (onSave) {
      onSave(updatedItemData);
    }
    setIsWeightEditorOpen(false);
  };

  const stepValue = (item.unit === 'kg' || item.unit === 'lb') ? 0.1 : 1;

  return (
    <>
      <tr className={`border-b ${!isAvailable ? 'bg-red-50 opacity-60' : ''}`}> {/* Use isAvailable */}
        <td className="py-3 px-3">
          <div className="block">
            <div className="flex items-center gap-4">
              {productInfo?.image_url ? (
                <img
                  src={productInfo.image_url}
                  alt={item.product_name}
                  className="w-8 h-8 object-cover rounded"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-grow">
                {item.substitute_product_name ? (
                  <div>
                    <p className="font-medium text-gray-900 line-through">
                      {(language === 'Hebrew' && productInfo?.name_hebrew) ? productInfo.name_hebrew : productInfo?.name}
                    </p>
                    <p className="font-medium text-blue-600">
                      {t('vendor.orderManagement.substitutedWith')}: {item.substitute_product_name}
                    </p>
                  </div>
                ) : (
                  <p className="font-medium text-gray-900">
                    {(language === 'Hebrew' && productInfo?.name_hebrew) ? productInfo.name_hebrew : productInfo?.name}
                  </p>
                )}
                
                <div className="block md:hidden">
                  <p className="text-sm text-gray-600 mt-1">
                    ₪{item.price?.toFixed(2)} / {t(`uom.${item.unit}`) || item.unit}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </td>

        <td className="py-3 px-3 text-sm bg-red text-gray-600 hidden md:table-cell">
          ₪{item.price?.toFixed(2)} / {t(`uom.${item.unit}`) || item.unit}
        </td>

        <td className="py-3 px-3">
          <div className="block">
            <div className="text-sm text-gray-600 text-center">
              {t('vendor.orderManagement.ordered')}: {item.quantity} {item.unit}
            </div>

            {/* The actual quantity display section, already handles blank for 0, null, undefined via currentQuantity state */}
            <div className="flex items-center justify-center gap-1 group">
       
         <Input
  type="text"
  value={currentQuantity}
  onChange={(e) => setCurrentQuantity(e.target.value)}
  onBlur={() => {
    const num = parseFloat(currentQuantity);
    handleWeightChange(isNaN(num) ? 0 : num); // fallback to 0 if input is empty or invalid
  }}
  inputMode="decimal" // opens numeric keyboard on mobile
  className="w-24 h-9 text-center"
  placeholder={item.quantity}
  disabled={readOnly}
/>



              <div className="flex flex-col md:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="sm" className="h-4 p-0 hover:bg-gray-100"
                  onClick={() => {
                    const newWeight = (parseFloat(currentQuantity) || 0) + stepValue; // Uses currentQuantity
                    handleWeightChange(newWeight); // This will now handle setCurrentQuantity as well
                  }} disabled={readOnly}>
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-4 p-0 hover:bg-gray-100"
                  onClick={() => {
                    const newWeight = Math.max(0, (parseFloat(currentQuantity) || 0) - stepValue); // Uses currentQuantity
                    handleWeightChange(newWeight); // This will now handle setCurrentQuantity as well
                  }} disabled={readOnly}>
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="font-semibold text-center">
              {t('common.total')}: ₪{((item.price || 0) * (parseFloat(currentQuantity) || 0)).toFixed(2)} {/* Uses currentQuantity */}
            </div>

            {!readOnly && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <Button
                  variant={isAvailable ? "outline" : "destructive"} // Use isAvailable
                  size="sm"
                  onClick={handleUnavailableToggle}
                  title={isAvailable ? t('common.unavailable') : t('common.available')} // Use isAvailable
                  className="px-2 h-8"
                >
                  <Ban className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {isAvailable ? t('common.unavailable') : t('common.available')} {/* Use isAvailable */}
                </Button>
              </div>
            )}
            {!readOnly && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openWeightEditor(item)}
                  title={t('common.subNotes')}
                  className="px-2 h-8"
                >
                  <Edit className={`w-4 h-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {t('common.subNotes')}
                </Button>
              </div>
            )}
          </div>
        </td>
      </tr>
      {isWeightEditorOpen && (
        <OrderItemEditDialog
          isOpen={isWeightEditorOpen}
          onCancel={closeWeightEditor}
          item={item}
          onSave={handleSaveFromDialog}
          order={order}
          vendorId={vendorId}
        />
      )}
    </>
  );
}
