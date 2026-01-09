
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { CartItem, User } from '@/entities/all';

const CartContext = createContext(null);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        // Return safe defaults if context is not available
        return {
            cartItems: [],
            isLoading: true,
            user: null,
            selectedHousehold: null,
            shoppingForHousehold: null,
            // Updated function names for safe defaults
            addToCart: () => Promise.resolve(),
            updateQuantity: () => Promise.resolve(),
            removeFromCart: () => Promise.resolve(),
            clearCart: () => Promise.resolve(),
            getProductQuantity: () => 0,
            getVendorCartCount: () => 0,
            getTotalItemCount: () => 0,
            reloadCart: () => Promise.resolve(),
        };
    }
    return context;
};

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [selectedHousehold, setSelectedHousehold] = useState(null); // For KCS customer
    const [shoppingForHousehold, setShoppingForHousehold] = useState(null); // For Vendor/Picker/Admin/Chief of Staff
    const [lastUpdateTime, setLastUpdateTime] = useState(0); // Add timestamp to prevent excessive updates
    const [userInitialized, setUserInitialized] = useState(false); // Add flag to prevent repeated User.me() calls

    // Initializes user and household contexts from session storage on mount
    const initializeSession = useCallback(async () => {
        if (userInitialized) return; // Prevent multiple initializations
        
        try {
            const currentUser = await User.me();
            setUser(currentUser);
            setUserInitialized(true);

            // Initialize selectedHousehold for KCS customers
            if (currentUser?.user_type === 'kcs staff'||currentUser?.user_type === 'household owner') {
                const householdData = sessionStorage.getItem('selectedHousehold');
                if (householdData) {
                    setSelectedHousehold(JSON.parse(householdData));
                } else {
                    setSelectedHousehold(null);
                }
            } else {
                setSelectedHousehold(null);
            }

            // Initialize shoppingForHousehold for vendor/picker/admin/chief of staff users
            if (['vendor', 'picker', 'admin', 'chief of staff'].includes(currentUser?.user_type)) {
                const shoppingData = sessionStorage.getItem('shoppingForHousehold');
                if (shoppingData) {
                    setShoppingForHousehold(JSON.parse(shoppingData));
                } else {
                    setShoppingForHousehold(null);
                }
            } else {
                setShoppingForHousehold(null);
            }
        } catch (error) {
            // Silently handle authentication errors during logout
            if (error?.response?.status === 401 || error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
                // User is logged out, this is expected
                console.log('User session ended, clearing cart context');
            } else {
                // Log other errors for debugging
                console.warn('Error initializing session:', error);
            }
            setUser(null);
            setSelectedHousehold(null);
            setShoppingForHousehold(null);
            setUserInitialized(true); // Set to true even on error to prevent infinite retries
        } finally {
            // isLoading is managed by loadCartItems, which is called after session initializes
        }
    }, [userInitialized]);

    // Effect to run session initialization once on mount
    useEffect(() => {
        initializeSession();
    }, [initializeSession]);
    
    // Effect to listen for session changes from other tabs/windows or custom events
    useEffect(() => {
        const handleSessionChange = () => {
            // Only update household data from session storage, don't re-fetch user
            if (user?.user_type === 'kcs staff'||user?.user_type === 'household owner') {
                const householdData = sessionStorage.getItem('selectedHousehold');
                setSelectedHousehold(householdData ? JSON.parse(householdData) : null);
            }
            
            if (['vendor', 'picker', 'admin', 'chief of staff'].includes(user?.user_type)) {
                const shoppingData = sessionStorage.getItem('shoppingForHousehold');
                setShoppingForHousehold(shoppingData ? JSON.parse(shoppingData) : null);
            }
        };

        window.addEventListener('storage', handleSessionChange);
        window.addEventListener('shoppingModeChanged', handleSessionChange); // Listen for custom event
        return () => {
            window.removeEventListener('storage', handleSessionChange);
            window.removeEventListener('shoppingModeChanged', handleSessionChange);
        };
    }, [user]);

    // Helper function to determine the correct product price based on the current context (user type/household)
    const getProductPrice = useCallback((product) => {
        let price = product.price_customer_app; // Default price
        if(['vendor', 'picker', 'admin', 'chief of staff','kcs staff','household owner'].includes(user?.user_type)){
            price = product.price_customer_kcs;
        }
        // If shopping for any household (KCS or Vendor/Picker/Admin/Chief of Staff), use KCS price
        if (selectedHousehold || shoppingForHousehold) {
            price = product.price_customer_kcs;
        }
        return price ?? product.price_base ?? 0;
    }, [selectedHousehold, shoppingForHousehold, user?.user_type]);

    // Helper function to get the current cart identifier (user email or household ID)
    const getUserKey = useCallback(() => {
        if (!user) return null; // If user not loaded or logged out

        let cartIdentifier = user.email; // Default cart identifier
        if ((user.user_type === 'kcs staff'||user.user_type === 'household owner') && selectedHousehold) {
            cartIdentifier = `household_${selectedHousehold.id}`;
        } else if (['vendor', 'picker', 'admin', 'chief of staff'].includes(user.user_type) && shoppingForHousehold) {
            cartIdentifier = `household_${shoppingForHousehold.id}`;
        }
        return cartIdentifier;
    }, [user, selectedHousehold, shoppingForHousehold]);

    // Centralized function to fetch cart data with rate limiting.
    const loadCartItems = useCallback(async (forceReload = false) => {
        const now = Date.now();
        // Prevent too frequent reloads (max once per 2 seconds unless forced)
        if (!forceReload && now - lastUpdateTime < 2000) {
            return;
        }

        setIsLoading(true);
        try {
            const currentCartIdentifier = getUserKey(); // Get cart identifier from current state
            if (!currentCartIdentifier) {
                // If no user or household context, clear cart and mark as loaded
                setCartItems([]);
                return;
            }
            
            const items = await CartItem.filter({ user_email: currentCartIdentifier });
            setCartItems(items);
            setLastUpdateTime(now); // Update timestamp only on successful fetch
        } catch (error) {
            // Silently handle authentication errors during logout
            if (error?.response?.status === 401 || error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
                console.log('Cart access denied - user logged out');
            } else {
                console.error("Error loading cart:", error);
            }
            setCartItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [getUserKey, lastUpdateTime]);

    // Effect to trigger cart load whenever user, selectedHousehold, or shoppingForHousehold changes
    useEffect(() => {
        // Only load cart if user state has been initialized
        if (userInitialized) { // user !== undefined is now implicitly covered if userInitialized is true
             loadCartItems();
        }
    }, [userInitialized, user, selectedHousehold, shoppingForHousehold, loadCartItems]); // loadCartItems is memoized, so this is safe.

    const removeFromCart = useCallback(async (cartItemId) => {
        // Store the original cart in case we need to revert
        const originalCart = [...cartItems];
        
        // Optimistically update the UI by removing the item immediately
        setCartItems(prev => prev.filter(item => item.id !== cartItemId));
        
        try {
            // Send the delete request to the server
            await CartItem.delete(cartItemId);
        } catch (error) {
            console.error("Error removing from cart:", error);
            // If the delete request fails, revert the UI to the original state
            setCartItems(originalCart);

            // Don't show an error if the item was already gone (404)
            if (!(error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('Entity not found'))) {
                alert("Failed to remove item from cart. Please try again.");
            }
        }
    }, [cartItems]);

    const updateQuantity = useCallback(async (cartItemId, newQuantity) => {
        if (newQuantity <= 0) {
            return removeFromCart(cartItemId);
        }

        const originalCart = [...cartItems];
        
        // Optimistically update the UI with the new quantity
        setCartItems(prev =>
            prev.map(item =>
                item.id === cartItemId ? { ...item, quantity: newQuantity } : item
            )
        );

        try {
            // Send the update request to the server
            await CartItem.update(cartItemId, { quantity: newQuantity });
        } catch (error) {
            console.error("Error updating quantity:", error);
            // If the update fails, revert the UI to the original state
            setCartItems(originalCart);
            
            // If the item wasn't found (404), it means our cart is out of sync.
            // In this specific case, we should reload the cart to fix the inconsistency.
            if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('Entity not found')) {
                // Bilingual sync error message
                alert(
                    "This item appears to be out of sync. The cart will now refresh.\n\n" +
                    "נראה שפריט זה לא מסונכרן. העגלה תתחדש כעת."
                );
                await loadCartItems(true); 
            } else {
                // Bilingual general error message
                alert(
                    "Failed to update quantity. Please try again.\n\n" +
                    "עדכון הכמות נכשל. אנא נסה שוב."
                );
            }
        }
    }, [cartItems, removeFromCart, loadCartItems]);

    const addToCart = useCallback(async (product, quantity = 1, forHousehold = null) => {
        try {
            // Use the already loaded user instead of calling User.me() again
            const currentUser = user;
            if (!currentUser) {
                // Bilingual login prompt
                const shouldLogin = window.confirm(
                    "Please log in to add items to your cart. Would you like to sign in now?\n\n" +
                    "אנא התחבר כדי להוסיף פריטים לעגלה. האם תרצה להיכנס עכשיו?"
                );
                if (shouldLogin) await User.login();
                return;
            }
            
            let effectiveHouseholdContext = forHousehold; // Start with the explicitly passed household
            let cartIdentifier = currentUser.email;
            let householdIdToStore = null;

            if (currentUser.user_type === 'kcs staff'||currentUser.user_type === 'household owner') {
                effectiveHouseholdContext = selectedHousehold; // KCS staff always uses selectedHousehold
                if (!effectiveHouseholdContext) {
                    // Bilingual household selection message
                    alert(
                        "Please select a household first before adding items to cart.\n\n" +
                        "אנא בחר משק בית לפני הוספת פריטים לעגלה."
                    );
                    return;
                }
                if (!effectiveHouseholdContext.canOrder) {
                    // Bilingual permission message
                    alert(
                        "You don't have permission to place orders for this household.\n\n" +
                        "אין לך הרשאה לבצע הזמנות עבור משק בית זה."
                    );
                    return;
                }
                cartIdentifier = `household_${effectiveHouseholdContext.id}`;
                householdIdToStore = effectiveHouseholdContext.id;
            } else if (['vendor', 'picker', 'admin', 'chief of staff'].includes(currentUser.user_type)) {
                // For vendors, pickers, admins, and chief of staff
                // Use `forHousehold` if provided, otherwise default to `shoppingForHousehold`
                effectiveHouseholdContext = effectiveHouseholdContext || shoppingForHousehold; 

                if (!effectiveHouseholdContext) {
                    // Bilingual household selection message
                    alert(
                        "Please select a household to shop for before adding items to cart.\n\n" +
                        "אנא בחר משק בית לקנות עבורו לפני הוספת פריטים לעגלה."
                    );
                    return;
                }
                cartIdentifier = `household_${effectiveHouseholdContext.id}`;
                householdIdToStore = effectiveHouseholdContext.id;
            }
            // If no effectiveHouseholdContext (e.g., regular customer), cartIdentifier remains currentUser.email
            // and householdIdToStore remains null, which is the desired default.

            const itemPrice = getProductPrice(product);
            
            const itemsForCurrentCart = await CartItem.filter({
                user_email: cartIdentifier,
                product_id: product.id,
                household_id: householdIdToStore
            });
            const existingDbItem = itemsForCurrentCart.length > 0 ? itemsForCurrentCart[0] : null;
            
            if (existingDbItem) {
                const newQuantity = existingDbItem.quantity + quantity;
                await CartItem.update(existingDbItem.id, { 
                  quantity: newQuantity, 
                  product_price: itemPrice,
                  quantity_in_unit: product.quantity_in_unit ? String(product.quantity_in_unit) : null
                });
            } else {
                await CartItem.create({
                    product_id: product.id,
                    vendor_id: product.vendor_id,
                    product_name: product.name,
                    product_name_hebrew: product.name_hebrew,
                    product_price: itemPrice,
                    product_image: product.image_url,
                    quantity: quantity,
                    unit: product.unit,
                    quantity_in_unit: product.quantity_in_unit ? String(product.quantity_in_unit) : null,
                    user_email: cartIdentifier,
                    household_id: householdIdToStore, // This ensures household_id is always stored when vendors shop for households
                    sku: product.sku, // Include SKU
                    subcategory: product.subcategory, // Include subcategory
                    subcategory_hebrew: product.subcategory_hebrew, // Include Hebrew subcategory
                });
            }
            
            // For add/create, a reload is the safest way to ensure the new item ID is fetched correctly.
            await loadCartItems(true);

        } catch (error) {
            console.error("Error adding item to cart:", error);
            if (error.message && error.message.includes('auth')) {
                // Bilingual login prompt
                const shouldLogin = window.confirm(
                    "Please log in to add items to your cart. Would you like to sign in now?\n\n" +
                    "אנא התחבר כדי להוסיף פריטים לעגלה. האם תרצה להיכנס עכשיו?"
                );
                if (shouldLogin) await User.login();
            } else {
                // Bilingual error message
                alert(
                    "Failed to add item to cart. Please try again.\n\n" +
                    "הוספת הפריט לעגלה נכשלה. אנא נסה שוב."
                );
            }
        }
    }, [selectedHousehold, shoppingForHousehold, getProductPrice, loadCartItems, user]);
    
    const clearCart = useCallback(async (vendorId = null) => {
        try {
            if (!user) return;

            // Get the correct cart identifier (e.g., `household_123` or `user@email.com`)
            const currentCartIdentifier = getUserKey();
            if (!currentCartIdentifier) return;

            const itemsToClearFilter = { user_email: currentCartIdentifier };
            if (vendorId) {
                itemsToClearFilter.vendor_id = vendorId;
            }
            
            // Get the specific items to delete from the database
            const itemsToDelete = await CartItem.filter(itemsToClearFilter);

            if (itemsToDelete.length > 0) {
                // Delete all matching items from the database
                await Promise.all(itemsToDelete.map(item => CartItem.delete(item.id)));
            }

            // Update the local UI state by filtering out the deleted items
            setCartItems(prevItems => {
                if (vendorId) {
                    return prevItems.filter(item => item.vendor_id !== vendorId);
                } else {
                    return [];
                }
            });

            console.log(`Cart cleared for ${vendorId ? `vendor ${vendorId}` : 'all vendors'} in context of ${currentCartIdentifier}`);
            
        } catch (error) {
            console.error("Error clearing cart:", error);
            // If there's an error (e.g., network issue), don't stop the entire order process.
            // Instead, reload the cart from the server to ensure the UI reflects the true state.
            await loadCartItems(true);
            // We removed `throw error;` here to make the process more resilient.
        }
    }, [user, getUserKey, loadCartItems]);

    const getProductQuantity = useCallback((productId) => {
        const item = cartItems.find(item => item.product_id === productId);
        return item ? item.quantity : 0;
    }, [cartItems]);

    const getVendorCartCount = useCallback((vendorId) => {
        if (!vendorId) return 0;
        return cartItems
            .filter(item => item.vendor_id === vendorId)
            .reduce((sum, item) => sum + item.quantity, 0);
    }, [cartItems]);

    const getTotalItemCount = useCallback(() => {
        return cartItems.reduce((sum, item) => {
            if (item.unit === 'kg' || item.unit === 'lb' || item.unit === 'oz') {
                return sum + 1; // Count weighted items as 1 unit for total item count
            } else {
                return sum + item.quantity;
            }
        }, 0);
    }, [cartItems]);

    const value = useMemo(() => ({
        cartItems,
        isLoading,
        user,
        selectedHousehold, // Expose selectedHousehold in the context
        shoppingForHousehold, // Expose shoppingForHousehold in the context
        // Expose updated function names
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        getProductQuantity,
        getVendorCartCount,
        getTotalItemCount,
        reloadCart: loadCartItems, // Expose loadCartItems as reloadCart
    }), [
        cartItems, isLoading, user, selectedHousehold, shoppingForHousehold,
        addToCart, updateQuantity, removeFromCart, clearCart,
        getProductQuantity, getVendorCartCount, getTotalItemCount, loadCartItems
    ]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
