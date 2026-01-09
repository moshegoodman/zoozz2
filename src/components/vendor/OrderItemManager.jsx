import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Ban, Plus, Minus, Package } from 'lucide-react';
import { Order } from '@/entities/all';
import OrderItemEditDialog from './OrderItemEditDialog';
import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '@/lib/utils';

// Main component to manage and display order items
export default function OrderItemManager({ order, onOrderUpdate, onItemUpdate, isEditable, vendorProducts }) {
  const { t } = useLanguage();

  // Async function to handle item updates and persist changes to the database
  const handleItemUpdate = async (updatedItem, itemIndex) => {
    try {
      const updatedItems = order.items.map(item =>
        item.product_id === updatedItem.product_id ? updatedItem : item
      );

      // Recalculate total amount based on the updated items
      const updatedOrder = {
        ...order,
        items: updatedItems,
        total_amount: updatedItems.reduce((total, item) => {
          if (!item.shopped || !item.available) {
            return total;
          }
          const quantity = (item.actual_quantity !== null && item.actual_quantity !== undefined)
            ? item.actual_quantity
            : 0; 
          const effectiveQuantity = parseFloat(quantity) || 0;
          const price = item.price || 0;
          return total + (price * effectiveQuantity);
        }, 0)
      };

      // Save changes to the database
      await Order.update(order.id, {
        items: updatedItems,
        total_amount: updatedOrder.total_amount
      });

      // Update parent component state
      if (onOrderUpdate) {
        onOrderUpdate(updatedOrder);
      }
      if (onItemUpdate) {
        onItemUpdate(updatedItem);
      }
    } catch (error) {
      console.error("Error saving item changes:", error);
      alert("Failed to save changes. Please try again.");
    }
  };

  if (!order || !order.items || order.items.length === 0) {
    return (
      <div className="py-4 text-center text-gray-500">
        No items in this order.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {order.items.map((item, index) => (
        <OrderItemRow
          key={`${item.product_id}-${index}`}
          item={item}
          itemIndex={index}
          onItemUpdate={handleItemUpdate}
          isEditable={isEditable}
          vendorProducts={vendorProducts}
          vendorId={order.vendor_id}
          order={order}
        />
      ))}
    </div>
  );
}

// Component for a single order item row, now with a fully responsive flexbox layout
function OrderItemRow({ item, itemIndex, onItemUpdate, isEditable, vendorId, order, vendorProducts = [] }) {
  const { t, language, isRTL } = useLanguage();
  const [productInfo, setProductInfo] = useState(null);
  const [weight, setWeight] = useState(item.actual_quantity !== null && item.actual_quantity !== undefined ? String(item.actual_quantity) : '0');
  const [isWeightEditorOpen, setIsWeightEditorOpen] = useState(false);
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
  const perUnitText = isRTL
    ? `${item.quantity_in_unit} ${t('products.per')}${getUnitLabel(item.unit?.toLowerCase())}`
    : `${item.quantity_in_unit} ${t('products.per')} ${getUnitLabel(item.unit?.toLowerCase())}`;
 const shouldShowQuantityInUnit = () => {
    // The previous condition included `!hideVendorInfo`. Since vendor info is removed,
    // and to preserve existing functionality, the condition is now only based on product data.
    if (!item.quantity_in_unit) return false;

    const packUnits = ['pack', 'unit', 'box', 'bag', 'each', 'case', 'container']; // Added 'case' and 'container' here, and 'unit'
    return packUnits.includes(item.unit?.toLowerCase());
  };
  useEffect(() => {
    setWeight(item.actual_quantity !== null && item.actual_quantity !== undefined ? String(item.actual_quantity) : '0');
  }, [item.actual_quantity]);

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
    if (!isEditable || newWeight === null || isNaN(newWeight)) {
      return;
    }
    if (typeof onItemUpdate !== 'function') {
      console.error("onItemUpdate is not a function in OrderItemRow (handleWeightChange)");
      return;
    }
    const updatedItem = {
      ...item,
      actual_quantity: newWeight
    };
    onItemUpdate(updatedItem, itemIndex);
  };

  const handleAvailabilityToggle = () => {
    if (typeof onItemUpdate !== 'function') {
      console.error("onItemUpdate is not a function in OrderItemRow (handleAvailabilityToggle)");
      return;
    }
    onItemUpdate({
      ...item,
      available: !item.available,
      actual_quantity: item.actual_quantity !== null && item.actual_quantity !== undefined
        ? item.actual_quantity
        : item.available ? 0 : item.quantity
    }, itemIndex);
  };

  const openWeightEditor = () => {
    setIsWeightEditorOpen(true);
  };

  const closeWeightEditor = () => {
    setIsWeightEditorOpen(false);
  };

  const handleSaveFromDialog = (updatedItemData) => {
    if (typeof onItemUpdate === 'function') {
      onItemUpdate(updatedItemData, itemIndex);
    } else {
      console.error("onItemUpdate is not a function in OrderItemRow (handleSaveFromDialog)");
    }
    setIsWeightEditorOpen(false);
  };

  const stepValue = (item.unit === 'kg' || item.unit === 'lb') ? 0.1 : 1;
  const itemTotal = ((item.price || 0) * (parseFloat(weight) || 0)).toFixed(2);

  return (
    <>
      <div className={cn(
        "bg-white rounded-lg p-4 shadow-sm transition-all duration-200 ease-in-out flex flex-col sm:flex-row sm:items-center sm:justify-between",
        !item.available && "bg-red-50 opacity-60"
      )}>
        {/* Product Info, Price & Ordered Quantity Section */}
        <div className="flex items-center gap-4 flex-grow-0 sm:flex-grow">
          {productInfo?.image_url ? (
            <img
              src={productInfo.image_url}
              alt={item.product_name}
              className="w-12 h-12 object-cover rounded-lg border"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center border">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="flex-grow">
            {item.substitute_product_name ? (
              <div>
                <p className="font-medium text-gray-900 line-through">
                  {(language === 'Hebrew' && productInfo?.name_hebrew) ? productInfo.name_hebrew : productInfo?.name}
                </p>
                <p className="font-medium text-blue-600 text-sm">
                  {t('vendor.orderManagement.substitutedWith')}: {item.substitute_product_name}
                </p>
              </div>
            ) : (
              <p className="font-medium text-gray-900">
                {(language === 'Hebrew' && productInfo?.name_hebrew) ? productInfo.name_hebrew : productInfo?.name}
              </p>
            )}
            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
              <span>
                <span className="font-medium">₪{item.price?.toFixed(2)}</span> / {t(`uom.${item.unit}`) || item.unit}
              </span>
            </div>
             <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
              <span>
                <span className="font-medium"> {perUnitText}</span>
              </span>
            </div>
         <div className="text-sm text-gray-500 mt-1">
              {t('vendor.orderManagement.ordered')}: <span className="font-medium text-gray-700">{item.quantity} {t(`uom.${item.unit}`) || item.unit}</span>
            </div>
          </div>
           {/* Show quantity in unit only for pack-like units */}
        {shouldShowQuantityInUnit() && (
            <p className={`text-gray-600 text-xs`}>
              {perUnitText}
            </p>
          )}
        </div>
        
        {/* Actual Quantity, Total Price & Actions Section */}
        <div className="flex items-center justify-between mt-4 sm:mt-0 sm:w-auto w-full">
            {/* Quantity Input */}
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    onBlur={() => handleWeightChange(parseFloat(weight) || 0)}
                    className="w-16 h-9 text-center outline-none"
                    placeholder={item.quantity}
                    step={stepValue}
                    min="0"
                    disabled={!isEditable}
                />
                <div className="flex flex-col gap-0.5">
                    <Button
                        variant="ghost" size="sm" className="h-4 p-0 hover:bg-gray-100"
                        onClick={() => {
                            const newWeight = (parseFloat(weight) || 0) + stepValue;
                            setWeight(newWeight.toString());
                            handleWeightChange(newWeight);
                        }} disabled={!isEditable}>
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost" size="sm" className="h-4 p-0 hover:bg-gray-100"
                        onClick={() => {
                            const newWeight = Math.max(0, (parseFloat(weight) || 0) - stepValue);
                            setWeight(newWeight.toString());
                            handleWeightChange(newWeight);
                        }} disabled={!isEditable}>
                        <Minus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            {/* Item Total Price */}
            <div className="text-sm md:text-base font-semibold text-gray-900 mx-4">
                ₪{itemTotal}
            </div>
            
            {/* Actions Section */}
            {isEditable && (
                <div className="flex items-center gap-2">
                    <Button
                        variant={item.available ? "outline" : "destructive"}
                        size="sm"
                        onClick={handleAvailabilityToggle}
                        title={item.available ? t('common.unavailable') : t('common.available')}
                        className="px-2 h-8 text-red-400"
                    >
                        <Ban className={cn("w-4 h-4", isRTL ? 'ml-1' : 'mr-1')} />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={openWeightEditor}
                        title={t('common.subNotes')}
                        className="px-2 h-8 text-amber-400"
                    >
                        <Edit className={cn("w-4 h-4", isRTL ? 'ml-1' : 'mr-1')} />
                    </Button>
                </div>
            )}
        </div>
      </div>
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
