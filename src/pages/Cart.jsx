
import React, { useState, useEffect, useMemo } from "react";
import { Vendor, User } from "@/entities/all";
import { useCart } from "../components/cart/CartContext";
import VendorCartSection from "../components/cart/VendorCartSection";
import EmptyCart from "../components/cart/EmptyCart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Building, Store, ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "../components/i18n/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
// Removed generateOrderNumber import as it's now handled by the backend
import { placeOrder } from "@/functions/placeOrder"; // Import the new backend function
import { triggerPostOrderActions } from "@/functions/triggerPostOrderActions";


// Helper function to dynamically load external scripts
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const generatePDFClientSide = async (htmlContent, filename) => {
  let tempDiv = null;
  try {
    // 1. Load html2pdf bundle if not already loaded
    if (!window.html2pdf) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    }

    // 2. Create a temporary container for the HTML content
    tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // 3. Define improved options for html2pdf with better page break handling
    const options = {
      margin: [10, 10, 10, 10], // [top, left, bottom, right] in mm
      filename: filename,
      image: { 
        type: 'jpeg', 
        quality: 0.98 
      },
      html2canvas: { 
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: 'white',
        allowTaint: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break',
        after: '.page-break', 
        avoid: ['.avoid-break']  // Only avoid breaking specific sections, not the entire table
      }
    };

    // 4. Generate the PDF
    const pdfBlob = await window.html2pdf().from(tempDiv).set(options).outputPdf('blob');
    
    // 5. Convert blob to base64
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // Remove data:application/pdf;base64,
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });
    
  } catch (error) {
    console.error('Client-side PDF generation error with html2pdf:', error);
    return null;
  } finally {
    // Clean up the temporary element
    if (tempDiv && tempDiv.parentNode) {
      tempDiv.parentNode.removeChild(tempDiv);
    }
  }
};


export default function CartPage() {
  const { cartItems, isLoading: isCartLoading, user, selectedHousehold, shoppingForHousehold, clearCart } = useCart();
  const [vendors, setVendors] = useState([]);
  const [isVendorsLoading, setIsVendorsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false); // Changed to boolean
  const [orderStatus, setOrderStatus] = useState(''); // New state for order status
  const [householdVendors, setHouseholdVendors] = useState([]); // New state, not explicitly used in outline
  const [userType, setUserType] = useState('customerApp'); // New state, not explicitly used in outline
  const navigate = useNavigate();

  const { t, language, isRTL } = useLanguage();

  const filteredCartItems = useMemo(() => {
    if ((user?.user_type === 'vendor' || user?.user_type === 'picker') && user?.vendor_id) {
      return cartItems.filter(item => item.vendor_id === user.vendor_id);
    }
    return cartItems;
  }, [cartItems, user]);

  const groupedCarts = useMemo(() => {
    return filteredCartItems.reduce((acc, item) => {
        const vendorId = item.vendor_id;
        if (vendorId) {
          if (!acc[vendorId]) {
              acc[vendorId] = [];
          }
          acc[vendorId].push(item);
        }
        return acc;
    }, {});
  }, [filteredCartItems]);

  useEffect(() => {
    async function fetchVendors() {
        const vendorIds = Object.keys(groupedCarts);
        if (vendorIds.length > 0) {
            const allVendors = await Vendor.list();
            const fetchedVendors = allVendors.filter(v => vendorIds.includes(v.id));
            setVendors(fetchedVendors);
        } else {
            setVendors([]);
        }
        setIsVendorsLoading(false);
    }
    if(!isCartLoading) {
      fetchVendors();
    }
  }, [groupedCarts, isCartLoading]);

  const handlePlaceOrder = async (vendorId, itemsForVendor, deliveryDetails) => {
    if (!user) {
      navigate('/login');
      return false; // Stop the function
    }

    // CRITICAL: Re-check KCS staff permission before placing the order.
    if (user.user_type === 'kcs staff' || user.user_type === 'household owner') {
      if (!selectedHousehold) {
        alert(
          language === 'Hebrew'
            ? 'שגיאה: לא נבחר משק בית. אנא חזור ובחר משק בית.'
            : 'Error: No household is selected. Please go back and select a household.'
        );
        return false; // Stop the function
      }
      if (!selectedHousehold.canOrder) {
        alert(
          language === 'Hebrew'
            ? 'שגיאה: אין לך הרשאה לבצע הזמנות עבור משק בית זה.'
            : "Error: You don't have permission to place orders for this household."
        );
        return false; // Stop the function
      }
    }

    setIsPlacingOrder(true); // Global loading state
    setOrderStatus(t('cart.status.creatingOrder'));

    try {
      if (typeof console.clear === 'function') {
        console.clear();
      }
      console.log('--- STARTING NEW BACKEND ORDER PLACEMENT ---');
      
      const shoppingForHouseholdFromStorage = JSON.parse(sessionStorage.getItem('shoppingForHousehold'));

      // Step 1: Call the new backend function to create the order record.
      // This is now the single, primary transaction for order creation.
      const placeOrderResponse = await placeOrder({
        vendorId,
        itemsForVendor,
        deliveryDetails,
        shoppingForHousehold: shoppingForHouseholdFromStorage, // Using from sessionStorage as per existing code
        selectedHousehold: selectedHousehold, // Using from useCart as per existing code
        user
      });

      if (!placeOrderResponse.data.success || !placeOrderResponse.data.order) {
        const errorMessage = placeOrderResponse.data.error || 'Failed to create order on the backend.';
        console.error('CRITICAL ERROR: Order creation via backend function failed.', { error: placeOrderResponse.data.error, createdOrder: placeOrderResponse.data.order });
        throw new Error(errorMessage);
      }

      const newOrder = placeOrderResponse.data.order;
      console.log('SUCCESS: Backend created order successfully:', newOrder);

      // Step 2: Clear the cart on the frontend. This is quick and provides immediate feedback.
      await clearCart(vendorId);
      
      // Step 3: Trigger post-order actions with better error handling
      setOrderStatus(t('cart.status.sendingNotifications'));
      
      try {
        const postOrderResponse = await triggerPostOrderActions({ orderId: newOrder.id, language });
        console.log("Post-order actions response:", postOrderResponse);
        
        if (postOrderResponse.data && !postOrderResponse.data.success) {
          console.error("Post-order actions failed:", postOrderResponse.data.error);
          // Don't fail the entire order process, just log the error
        } else {
          console.log("Post-order actions triggered successfully.");
        }
      } catch (postOrderError) {
        console.error("Failed to trigger post-order actions:", postOrderError);
        // Don't fail the entire order process, just log the error
      }

      setOrderStatus(t('cart.status.orderPlaced'));
      alert(t('cart.alerts.orderSuccess'));
      
      return true;
    } catch (error) {
      console.error('Error placing order:', error);
      
      alert(
        language === 'Hebrew'
          ? `שגיאה בביצוע ההזמנה: ${error.message}`
          : `Error placing order: ${error.message}`
      );
      setOrderStatus(t('cart.status.orderFailed'));
      return false;
    } finally {
      setIsPlacingOrder(false);
      // Automatically clear status message after a few seconds
      setTimeout(() => setOrderStatus(''), 5000);
    }
  };

  if (isCartLoading || isVendorsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('cart.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 4 0 00-7 7h14a7 4 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.signInTitle')}</h2>
          <p className="text-gray-600 mb-8">
            {t('cart.signInDescription')}
          </p>
          <Button onClick={() => User.login()} size="lg" className="bg-green-600 hover:bg-green-700">
            {t('cart.signInButton')}
          </Button>
        </div>
      </div>
    );
  }

  if (filteredCartItems.length === 0) {
    return <EmptyCart />;
  }

  const isVendorShopping = user && (user.user_type === 'vendor' || user.user_type === 'picker') && shoppingForHousehold;

  const getCartTitle = () => {
    if ((user.user_type === 'kcs staff' || user.user_type === 'household owner') && selectedHousehold) {
      return (
        <div className="flex items-center gap-2">
          <Home className="w-6 h-6 text-purple-600" />
          <span>{t('cart.titleForHousehold', { householdName: selectedHousehold.name })}</span>
        </div>
      );
    }
    
    if ((user.user_type === 'vendor' || user.user_type === 'picker') && shoppingForHousehold) {
      return (
        <div className="flex items-center gap-2">
          <Building className="w-6 h-6 text-purple-600" />
          <span>{t('cart.titleVendorMode', { householdName: shoppingForHousehold.name })}</span>
          <Badge className="bg-purple-100 text-purple-800">{t('cart.vendorModeBadge')}</Badge>
        </div>
      );
    }

    if ((user.user_type === 'admin' || user.user_type === 'chief of staff') && shoppingForHousehold) {
      return (
        <div className="flex items-center gap-2">
          <Building className="w-6 h-6 text-purple-600" />
          <span>{t('cart.titleVendorMode', { householdName: shoppingForHousehold.name })}</span>
          <Badge className="bg-blue-100 text-blue-800">{t('cart.adminModeBadge')}</Badge>
        </div>
      );
    }
    
    return t('cart.title');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back to Home Button, dynamic title, and optional Back to Store button */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
          {/* Left side: Back to Home and the main dynamic title */}
          <div className="flex items-center gap-4">
            <Link 
              to={createPageUrl("Home")} 
              className="flex items-center gap-2 text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors rounded-lg px-3 py-2 -ml-3"
            >
              {language === 'Hebrew' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              <Home className="w-5 h-5" />
              <span className="font-medium">{t('cart.backToHome')}</span>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              {getCartTitle()}
            </h1>
          </div>
          {/* Right side: Existing conditional "Back to Store" button */}
          {isVendorShopping && (
            <Link to={createPageUrl(`Vendor?id=${user.vendor_id}`)}>
              <Button variant="outline">
                <Store className="w-4 h-4 mr-2" />
                {t('cart.backToStore')}
              </Button>
            </Link>
          )}
        </div>
        {orderStatus && (
          <div className="mb-4 text-center text-lg font-medium text-green-700">
            {orderStatus}
          </div>
        )}
        <div className="space-y-8">
            {Object.keys(groupedCarts).map(vendorId => {
                const vendorInfo = vendors.find(v => v.id === vendorId);
                const vendorItems = groupedCarts[vendorId];
                if (!vendorInfo) return null;
                
                return (
                    <VendorCartSection 
                        key={vendorId}
                        vendor={vendorInfo}
                        items={vendorItems}
                        onPlaceOrder={(deliveryDetails) => handlePlaceOrder(vendorId, vendorItems, deliveryDetails)}
                        isPlacingOrder={isPlacingOrder} // Now a global state
                    />
                )
            })}
        </div>
      </div>
    </div>
  );
}
