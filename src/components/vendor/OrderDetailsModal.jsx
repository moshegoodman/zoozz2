
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Order, Product, User, Vendor, Household } from '@/entities/all';
import { Package, MessageSquare, Download, PackageCheck, Truck, Loader2, X, XCircle, Search,Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDate } from '../i18n/dateUtils';
import OrderItemManager from './OrderItemManager';
import { generatePurchaseOrderPDF } from '@/functions/generatePurchaseOrderPDF';
import AddItemToOrderModal from "./AddItemToOrderModal";


export default function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  onOrderUpdate,
  onMarkAsReady,
  onMarkAsShipped,
  onChatOpen,
  onCancelOrder,
  userType
}) {
  const { t, language, isRTL } = useLanguage();
  const [localOrder, setLocalOrder] = useState(null);
  const [vendorProducts, setVendorProducts] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  // Removed isDownloading, replaced by downloadingPOId
  const [downloadingPOId, setDownloadingPOId] = useState(null); // Tracks which order's PO is being downloaded
  const [household, setHousehold] = useState(null);
  const [vendor, setVendor] = useState(null);

  // New state for Add Item Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // New state for search term
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRelatedData = useCallback(async (currentOrder) => {
    if (!currentOrder) return;
    setIsLoading(true);
    try {
      const [householdData, vendorData] = await Promise.all([
        currentOrder.household_id ? Household.get(currentOrder.household_id).catch(() => null) : Promise.resolve(null),
        currentOrder.vendor_id ? Vendor.get(currentOrder.vendor_id).catch(() => null) : Promise.resolve(null)
      ]);
      setHousehold(householdData);
      setVendor(vendorData);
    } catch (error) {
      console.error("Error fetching related data for order modal:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && order && (!localOrder || localOrder.id !== order.id)) {
      setLocalOrder(JSON.parse(JSON.stringify(order)));
      setPendingChanges(false);
      setSearchTerm(''); // Reset search term when order changes
      if (order?.vendor_id) {
        Product.filter({ vendor_id: order.vendor_id }).then(setVendorProducts);
      }
    }
    if (isOpen && order) {
      fetchRelatedData(order);
    }
  }, [isOpen, order, localOrder, fetchRelatedData]);

  useEffect(() => {
    if (!isOpen) {
      setLocalOrder(null);
      setPendingChanges(false);
      setIsSaving(false);
      setIsLoading(false);
      setSearchTerm(''); // Reset search term when modal closes
      // Clean up downloading state
      setDownloadingPOId(null);
      setHousehold(null);
      setVendor(null);
    }
  }, [isOpen]);

  const handleSave = useCallback(async () => {
    if (!pendingChanges || !localOrder || isSaving) return;

    setIsSaving(true);
    try {
      const newSubTotal = localOrder.items.reduce((total, item) => {
        const actualQuantity = item.actual_quantity ?? 0;
        return total + (item.price * actualQuantity);
      }, 0);

      const deliveryPrice = localOrder.delivery_price ?? 0;

      const newGrandTotal = newSubTotal + deliveryPrice;

      let updatedOrder = {
        ...localOrder,
        total_amount: newGrandTotal
      };

      if (!order.picker_id) {
        try {
          const currentUser = await User.me();
          if (currentUser) {
            updatedOrder.picker_id = currentUser.id;
            updatedOrder.picker_name = currentUser.full_name;
            console.log(`Assigned current user (${currentUser.full_name}) as picker for order ${order.order_number}.`);
          }
        } catch(userError) {
          console.error("Could not get current user to assign picker:", userError);
        }
      }

      const updatePayload = {
        items: updatedOrder.items,
        total_amount: updatedOrder.total_amount,
        delivery_notes: updatedOrder.delivery_notes,
        picker_name: updatedOrder.picker_name,
        status: updatedOrder.status
      };

      if (updatedOrder.picker_id) {
        updatePayload.picker_id = updatedOrder.picker_id;
      }

      const savedOrder = await Order.update(localOrder.id, updatePayload);

      setLocalOrder(savedOrder);

      if (onOrderUpdate) {
        onOrderUpdate(savedOrder);
      }
      setPendingChanges(false);
      console.log('Order changes saved successfully');
    } catch (error) {
      console.error('Error saving order changes:', error);
      alert(t('common.updateError') || 'Error updating order. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, localOrder, isSaving, order, onOrderUpdate, t]);

  const handleClose = async () => {
    if (pendingChanges && !isSaving) {
      await handleSave();
    }
    onClose();
  };

  const handleDownloadPO = useCallback(async (order, lang) => {
    setDownloadingPOId(order.id);
    try {
      if (order) {
        const response = await generatePurchaseOrderPDF({
          order,
          language: lang,
        });

        const blob = new Blob([response.data && response.data.pdfBase64 ? new Uint8Array(atob(response.data.pdfBase64).split('').map(c => c.charCodeAt(0))) : response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PO-${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading Purchase Order:", error);
      alert("Failed to download Purchase Order PDF.");
    } finally {
        setDownloadingPOId(null);
    }
  }, []); // Remove order dependency since order is passed as parameter

  const handleItemUpdate = useCallback((updatedItem, itemIndex) => {
    if (!localOrder) return;

    setLocalOrder(prevOrder => {
      const newItems = prevOrder.items.map((item, idx) => {
        if (item.product_id === updatedItem.product_id || idx === itemIndex) {
          return { ...item, ...updatedItem };
        }
        return item;
      });

      const newCalculatedSubTotal = newItems.reduce((total, item) => {
        if (item.available === false) return total;
        const actualQuantity = parseFloat(item.actual_quantity) || 0;
        return total + ((item.price || 0) * (actualQuantity || 0));
      }, 0);

      const currentDeliveryPrice = prevOrder.delivery_price ?? 0;

      const newCalculatedGrandTotal = newCalculatedSubTotal + currentDeliveryPrice;

      let updatedOrderData = { ...prevOrder, items: newItems, total_amount: newCalculatedGrandTotal };

      if (prevOrder.status === 'pending' || prevOrder.status === 'ready_for_shipping'|| prevOrder.status === 'follow_up') {
        updatedOrderData.status = 'shopping';
      }

      return updatedOrderData;
    });

    setPendingChanges(true);
  }, [localOrder]);

  const handleOrderFieldUpdate = useCallback((field, value) => {
    setLocalOrder(prevOrder => {
      let updatedOrderData = { ...prevOrder, [field]: value };
      if (prevOrder.status === 'ready_for_shipping') {
        updatedOrderData.status = 'shopping';
      }
      return updatedOrderData;
    });
    setPendingChanges(true);
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'shopping': return 'bg-yellow-100 text-yellow-800';
      case 'ready_for_shipping': return 'bg-purple-100 text-purple-800';
      case 'delivery': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStatusLabel = useCallback((status) => {
    switch (status) {
      case 'pending': return t('orderStatus.pending');
      case 'shopping': return t('orderStatus.shopping');
      case 'ready_for_shipping': return t('orderStatus.ready_for_shipping');
      case 'delivery': return t('orderStatus.delivery');
      case 'delivered': return t('orderStatus.delivered');
      case 'cancelled': return t('orderStatus.cancelled');
      default: return status;
    }
  }, [t]);
 const handleAddItem = useCallback((newItem) => {
    setLocalOrder(prev => {
      if (!prev) return prev;

      // Ensure the new item has necessary fields for order item logic
      const itemToAdd = {
        ...newItem,
        quantity: newItem.quantity || 1, // Default quantity if not provided
        actual_quantity: newItem.actual_quantity || newItem.quantity || 1, // Initially actual matches requested, or 1
        available: true, // New item is assumed available
        shopped: false, // Not yet shopped
      };

      const newItems = [...prev.items, itemToAdd];

      // Recalculate subtotal and total amount based on new items array
      const newCalculatedSubTotal = newItems.reduce((total, item) => {
        if (item.available === false) return total;
        const actualQuantity = parseFloat(item.actual_quantity) || 0;
        return total + ((item.price || 0) * actualQuantity);
      }, 0);

      const currentDeliveryPrice = prev.delivery_price ?? 0;
      const newCalculatedGrandTotal = newCalculatedSubTotal + currentDeliveryPrice;

      return {
        ...prev,
        items: newItems,
        total_amount: newCalculatedGrandTotal,
        // Also update status if needed, similar to handleItemUpdate
        status: (prev.status === 'pending' || prev.status === 'ready_for_shipping' || prev.status === 'follow_up') ? 'shopping' : prev.status
      };
    });
    setPendingChanges(true);
    setShowAddItemModal(false);
  }, []);

  const handleMarkAsReadyClick = useCallback(async () => {
    if (onMarkAsReady && localOrder) {
      const originalStatus = localOrder.status;
      setLocalOrder(prev => ({ ...prev, status: "ready_for_shipping" }));

      try {
        await onMarkAsReady();
      } catch (error) {
        console.error("Failed to mark as ready:", error);
        setLocalOrder(prev => ({ ...prev, status: originalStatus }));
        alert(t('common.updateError') || 'Failed to mark order as ready. Please try again.');
      }
    }
  }, [onMarkAsReady, localOrder, t]);

  const handleMarkAsShippedClick = useCallback(async () => {
    if (onMarkAsShipped && localOrder) {
      const originalStatus = localOrder.status;
      setLocalOrder(prev => ({ ...prev, status: "delivery" }));

      try {
        await onMarkAsShipped();
      } catch (error) {
        console.error("Failed to mark as shipped:", error);
        setLocalOrder(prev => ({ ...prev, status: originalStatus }));
        alert(t('common.updateError') || 'Failed to mark order as shipped. Please try again.');
      }
    }
  }, [onMarkAsShipped, localOrder, t]);

  const isEditable = localOrder && ['pending', 'shopping', 'ready_for_shipping','follow_up'].includes(localOrder.status);

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!localOrder?.items) return [];

    let items = [...localOrder.items];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      items = items.filter(item => {
        const searchFields = [
          item.product_name,
          item.product_name_hebrew,
          item.sku,
          item.subcategory,
          item.subcategory_hebrew
        ];

        return searchFields.some(field =>
          field && String(field).toLowerCase().includes(searchLower)
        );
      });
    }

    return items;
  }, [localOrder?.items, searchTerm]);


  if (!isOpen || !localOrder) return null;

  const totalItems = localOrder.items?.length || 0;
  const shoppedItems = localOrder.items?.filter(item => item.shopped).length || 0;

  const deliveryPriceForDisplay = localOrder.delivery_price ?? 0;
  const subTotalForDisplay = (localOrder.total_amount ?? 0);


  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <DialogTitle className="text-2xl">
                {t('vendor.orderDetails.title')} - {localOrder.order_number}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={`${getStatusColor(localOrder.status)} border text-xs`}>
                  {getStatusLabel(localOrder.status)}
                </Badge>
                <span>
                  {t('vendor.orderDetails.placedOn', { date: formatDate(new Date(localOrder.created_date), "EEEE, MMMM d, yyyy h:mm a") })}
                </span>
              </DialogDescription>
            </div>

            <div className={`flex flex-wrap items-center gap-2 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>

              {/* New: Download PO button */}
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadPO(order, language)} // Updated call site
                  disabled={downloadingPOId !== null || isLoading} // Use new state variable
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  title={t('vendor.orderManagement.downloadPO', 'Download PO')}
              >
                  {downloadingPOId === order.id ? <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} /> : <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                  {t('vendor.orderManagement.downloadPO', 'Download PO')}
              </Button>


              <Button variant="outline" size="sm" onClick={() => onChatOpen(localOrder)} className="text-green-600 border-green-300 hover:bg-green-50">
                <MessageSquare className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('vendor.orderManagement.chat')}
              </Button>

              {localOrder.status !== 'cancelled' && localOrder.status !== 'delivered' && (
                <Button variant="destructive" size="sm" onClick={onCancelOrder}>
                  <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {t('common.cancel', 'Cancel Order')}
                </Button>
              )}

              {localOrder.status === "shopping" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAsReadyClick}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  title={t('vendor.orderManagement.ready')}
                >
                  <PackageCheck className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                </Button>
              )}
              {localOrder.status === "ready_for_shipping" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAsShippedClick}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  title={t('vendor.orderManagement.ship')}
                >
                  <Truck className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                </Button>
              )}
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>

            </div>
          </div>

          <div className={`mt-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            {isSaving && (
              <Badge variant="outline" className="ml-2 text-blue-600 border-blue-300">
                {t('common.saving') || 'Saving...'}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 px-1">
          <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  {t('vendor.orderDetails.orderItems')} ({localOrder.items?.length || 0})
                </h3>
                <div className="flex items-center gap-4">
                    {/* Add Item Button */}
                    {(userType === 'vendor' || userType === 'admin' || userType === 'chief of staff') && isEditable && (
                      <Button
                        onClick={() => setShowAddItemModal(true)}
                        className="bg-green-600 hover:bg-green-700 h-8"
                        size="sm"
                        disabled={isSaving}
                      >
                        <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('vendor.orderManagement.addItem', 'Add Item')}
                      </Button>
                    )}
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className={`absolute top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
                    <Input
                      placeholder={t('vendor.orderDetails.searchItems', 'Search items by name, SKU, category...')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`${isRTL ? 'pr-10 text-right' : 'pl-10'} w-64`}
                      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
                    />
                  </div>

                  {/* Results count */}
                  {searchTerm && (
                    <span className="text-sm text-gray-600">
                      {t('vendor.orderDetails.searchResults', {
                        count: filteredItems.length,
                        total: localOrder.items?.length || 0,
                        defaultValue: `${filteredItems.length} of ${localOrder.items?.length || 0} items`
                      })}
                    </span>
                  )}
                </div>
            </div>
            {filteredItems.length > 0 ? (
                <OrderItemManager
                  key={localOrder.id + (searchTerm ? '-filtered' : '')} // Add searchTerm to key to force re-render if needed
                  order={{ ...localOrder, items: filteredItems }} // Pass a modified order object with filtered items
                  onItemUpdate={handleItemUpdate}
                  isEditable={isEditable}
                  vendorProducts={vendorProducts}
                  userType={userType}
                />
            ) : (
                <div className="text-center py-8 text-gray-500">
                    {searchTerm ? (
                      <div>
                        <p>{t('vendor.orderDetails.noSearchResults', 'No items found matching your search.')}</p>
                        <Button
                          variant="ghost"
                          onClick={() => setSearchTerm('')}
                          className="mt-2"
                        >
                          {t('vendor.orderDetails.clearSearch', 'Clear search')}
                        </Button>
                      </div>
                    ) : (
                      <p>{t('vendor.orderDetails.noItems', 'No items in this order.')}</p>
                    )}
                </div>
            )}
          </div>
        </div>

        <div  className={`mt-auto pt-4 border-t flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="text-lg font-semibold">
            {t('vendor.orderDetails.subTotal')}: ₪{(subTotalForDisplay-deliveryPriceForDisplay).toFixed(2) || '0.00'}
          </div>
           <div className="text-lg font-semibold">
            {t('vendor.orderDetails.delivery_fee')}: ₪{deliveryPriceForDisplay.toFixed(2) || '0.00'}
          </div>
           <div className="text-lg font-semibold">
            {t('vendor.orderDetails.total')}: ₪{localOrder.total_amount?.toFixed(2) || '0.00'}
          </div>
          <DialogFooter>
            <div className="flex justify-between items-center w-full">
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                {isSaving ? (t('common.saving') || 'Saving...') : (t('common.close') || 'Close')}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  {/* Add Item Modal */}
      <AddItemToOrderModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        vendorId={localOrder?.vendor_id} // Pass vendorId from localOrder
        onItemAdded={handleAddItem}
      />
    </>
   
   
    
  );
}
