import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { CartItem, User } from '@/entities/all';

// Delay before flushing batched quantity updates to the DB (ms).
// Rapid +/- clicks within this window coalesce into a single update with the final quantity.
const QUANTITY_FLUSH_DELAY_MS = 1200;

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

            // Initialize selectedHousehold for KCS customers (check localStorage first, fallback to sessionStorage)
            if (currentUser?.user_type === 'kcs staff'||currentUser?.user_type === 'household owner') {
                const householdData = localStorage.getItem('selectedHousehold') || sessionStorage.getItem('selectedHousehold');
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
                const householdData = localStorage.getItem('selectedHousehold') || sessionStorage.getItem('selectedHousehold');
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

    // Helper function to determine the correct product price based on the current context.
    // - 'kcs' type households → KCS price (price_customer_kcs)
    // - 'private' type households → standard app price (price_customer_app)
    // - KCS staff / admin without a household context → KCS price (they are internal users)
    const getProductPrice = useCallback((product) => {
        const activeHousehold = selectedHousehold || shoppingForHousehold;

        if (activeHousehold) {
            // Price is determined by the household type
            if (activeHousehold.household_type === 'private') {
                return product.price_customer_app ?? product.price_base ?? 0;
            }
            // Default for 'kcs' type or any household without a type set
            return product.price_customer_kcs ?? product.price_base ?? 0;
        }

        // No household context: internal staff users get KCS price, others get app price
        if (['vendor', 'picker', 'admin', 'chief of staff', 'kcs staff', 'household owner'].includes(user?.user_type)) {
            return product.price_customer_kcs ?? product.price_base ?? 0;
        }

        return product.price_customer_app ?? product.price_base ?? 0;
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

    // Tracks (user_email + product_id + household_id) keys of items currently being deleted on the server
    // so a concurrent loadCartItems doesn't resurrect them in the UI.
    const pendingDeletionKeys = useRef(new Set());
    const itemDeletionKey = (item) => `${item.user_email || ''}::${item.product_id || ''}::${item.household_id || ''}`;

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
            // Filter out items currently mid-deletion to avoid them flashing back into the UI
            const filtered = items.filter(item => {
                const key = `${item.user_email || ''}::${item.product_id || ''}::${item.household_id || ''}`;
                return !pendingDeletionKeys.current.has(key);
            });
            setCartItems(filtered);
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

    // Per-cart-item map of pending quantity flushes.
    // Key: cartItemId, Value: { timer, targetQuantity }
    const pendingQuantityFlushes = useRef(new Map());

    // Live, always-current ref to cartItems — avoids stale closures in burst operations.
    const cartItemsRef = useRef(cartItems);
    useEffect(() => { cartItemsRef.current = cartItems; }, [cartItems]);

    // Resolves an optimistic temp_ id to a real DB id by waiting briefly for the
    // background reconciliation to finish. Returns the real id, or null if not found.
    const resolveRealCartItemId = useCallback(async (cartItemId) => {
        if (!cartItemId) return null;
        if (!String(cartItemId).startsWith('temp_')) return cartItemId;

        // Find the optimistic item to know which product it represents — from the LIVE ref
        const optimisticItem = cartItemsRef.current.find(i => i.id === cartItemId);
        if (!optimisticItem) return null;

        // Poll the DB for up to ~3s waiting for the create to complete
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                const matches = await CartItem.filter({
                    user_email: optimisticItem.user_email,
                    product_id: optimisticItem.product_id,
                    household_id: optimisticItem.household_id ?? null,
                });
                if (matches && matches.length > 0) {
                    return matches[0].id;
                }
            } catch (e) {
                // ignore and retry
            }
            await new Promise(r => setTimeout(r, 300));
        }
        return null;
    }, []);

    // Performs the actual DB write for a queued quantity change.
    const flushQuantityUpdate = useCallback(async (cartItemId) => {
        const pending = pendingQuantityFlushes.current.get(cartItemId);
        if (!pending) return;
        pendingQuantityFlushes.current.delete(cartItemId);

        const { targetQuantity } = pending;

        // If the item no longer exists in the live cart, skip silently — it was removed.
        const stillExists = cartItemsRef.current.some(i => i.id === cartItemId);
        if (!stillExists) return;

        try {
            const realId = await resolveRealCartItemId(cartItemId);
            if (!realId) return; // silent skip; nothing to update
            await CartItem.update(realId, { quantity: targetQuantity });
        } catch (error) {
            console.error("Error flushing quantity update:", error);
            // For any error (404 or otherwise), reload silently — never alert during background sync
            await loadCartItems(true);
        }
    }, [resolveRealCartItemId, loadCartItems]);

    const removeFromCart = useCallback(async (cartItemId) => {
        // Cancel any pending quantity flush for this item — it's being removed instead
        const pending = pendingQuantityFlushes.current.get(cartItemId);
        if (pending) {
            clearTimeout(pending.timer);
            pendingQuantityFlushes.current.delete(cartItemId);
        }

        // Read from the live ref so burst removes don't operate on stale state
        const itemToRemove = cartItemsRef.current.find(i => i.id === cartItemId);
        if (!itemToRemove) return; // already gone

        const deletionKey = itemDeletionKey(itemToRemove);
        pendingDeletionKeys.current.add(deletionKey);

        // Optimistically update UI immediately
        setCartItems(prev => prev.filter(item => item.id !== cartItemId));

        try {
            const realId = await resolveRealCartItemId(cartItemId);
            if (!realId) {
                // Couldn't find a server record — nothing to delete. Treat as success.
                return;
            }
            await CartItem.delete(realId);
        } catch (error) {
            // Already gone on the server — that's still a success for the user
            if (error?.response?.status === 404 || error?.message?.includes('404') || error?.message?.includes('Entity not found')) {
                return;
            }
            console.error("Error removing from cart:", error);
            // Recover by reloading from the server instead of restoring a possibly stale snapshot
            await loadCartItems(true);
        } finally {
            pendingDeletionKeys.current.delete(deletionKey);
        }
    }, [resolveRealCartItemId, loadCartItems]);

    const updateQuantity = useCallback((cartItemId, newQuantity) => {
        if (newQuantity <= 0) {
            return removeFromCart(cartItemId);
        }

        // Optimistically update the UI immediately — no DB call yet
        setCartItems(prev =>
            prev.map(item =>
                item.id === cartItemId ? { ...item, quantity: newQuantity } : item
            )
        );

        // Reset / schedule the debounced flush for this specific cart item
        const existing = pendingQuantityFlushes.current.get(cartItemId);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(() => {
            flushQuantityUpdate(cartItemId);
        }, QUANTITY_FLUSH_DELAY_MS);

        pendingQuantityFlushes.current.set(cartItemId, { timer, targetQuantity: newQuantity });
    }, [removeFromCart, flushQuantityUpdate]);

    // On unmount, flush any pending updates so we don't lose them
    useEffect(() => {
        return () => {
            const pending = pendingQuantityFlushes.current;
            pending.forEach(({ timer }, id) => {
                clearTimeout(timer);
                // Best-effort fire-and-forget flush
                flushQuantityUpdate(id);
            });
            pending.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Per-product serialization queue to prevent race conditions on rapid clicks.
    // Each product gets its own promise chain so DB reads/writes are sequential.
    const addToCartQueues = useRef(new Map());

    const addToCart = useCallback(async (product, quantity = 1, forHousehold = null, options = {}) => {
        // options: { selectedUnit: 'primary'|'secondary', unitLabel, unitLabelHebrew, priceOverride }
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
                alert(
                    "Please select a household first before adding items to cart.\n\n" +
                    "אנא בחר משק בית לפני הוספת פריטים לעגלה."
                );
                return;
            }
            if (!effectiveHouseholdContext.canOrder) {
                alert(
                    "You don't have permission to place orders for this household.\n\n" +
                    "אין לך הרשאה לבצע הזמנות עבור משק בית זה."
                );
                return;
            }
            cartIdentifier = `household_${effectiveHouseholdContext.id}`;
            householdIdToStore = effectiveHouseholdContext.id;
        } else if (['vendor', 'picker', 'admin', 'chief of staff'].includes(currentUser.user_type)) {
            effectiveHouseholdContext = effectiveHouseholdContext || shoppingForHousehold;

            if (!effectiveHouseholdContext) {
                alert(
                    "Please select a household to shop for before adding items to cart.\n\n" +
                    "אנא בחר משק בית לקנות עבורו לפני הוספת פריטים לעגלה."
                );
                return;
            }
            cartIdentifier = `household_${effectiveHouseholdContext.id}`;
            householdIdToStore = effectiveHouseholdContext.id;
        }

        const selectedUnit = options.selectedUnit === 'secondary' ? 'secondary' : 'primary';
        const itemPrice = (selectedUnit === 'secondary' && typeof options.priceOverride === 'number')
            ? options.priceOverride
            : getProductPrice(product);
        const unitLabel = options.unitLabel || null;
        const unitLabelHebrew = options.unitLabelHebrew || null;

        // Optimistically update UI immediately using functional state update
        // to avoid stale closure reads on rapid clicks.
        setCartItems(prev => {
            const existingLocal = prev.find(
                (item) => item.product_id === product.id
                    && item.user_email === cartIdentifier
                    && (item.selected_unit || 'primary') === selectedUnit
            );
            if (existingLocal) {
                return prev.map(item =>
                    item.id === existingLocal.id
                        ? { ...item, quantity: item.quantity + quantity, product_price: itemPrice }
                        : item
                );
            }
            const tempItem = {
                id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                _optimistic: true,
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
                household_id: householdIdToStore,
                sku: product.sku,
                subcategory: product.subcategory,
                subcategory_hebrew: product.subcategory_hebrew,
                selected_unit: selectedUnit,
                unit_label: unitLabel,
                unit_label_hebrew: unitLabelHebrew,
            };
            return [...prev, tempItem];
        });

        // Serialize DB writes per product so concurrent clicks don't read stale quantity.
        // Each click is chained onto the previous one's promise for the same product.
        const queueKey = `${cartIdentifier}::${product.id}`;
        const prevPromise = addToCartQueues.current.get(queueKey) || Promise.resolve();

        const nextPromise = prevPromise.then(async () => {
            try {
                const itemsForCurrentCart = await CartItem.filter({
                    user_email: cartIdentifier,
                    product_id: product.id,
                    household_id: householdIdToStore
                });
                // Match on selected_unit so primary+secondary are separate cart lines
                const existingDbItem = itemsForCurrentCart.find(i => (i.selected_unit || 'primary') === selectedUnit) || null;

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
                        household_id: householdIdToStore,
                        sku: product.sku,
                        subcategory: product.subcategory,
                        subcategory_hebrew: product.subcategory_hebrew,
                        selected_unit: selectedUnit,
                        unit_label: unitLabel,
                        unit_label_hebrew: unitLabelHebrew,
                    });
                }
            } catch (error) {
                console.error("Error adding item to cart:", error);
                if (error.message && error.message.includes('auth')) {
                    const shouldLogin = window.confirm(
                        "Please log in to add items to your cart. Would you like to sign in now?\n\n" +
                        "אנא התחבר כדי להוסיף פריטים לעגלה. האם תרצה להיכנס עכשיו?"
                    );
                    if (shouldLogin) await User.login();
                }
                // Reload to recover real state instead of rolling back to a stale snapshot
                await loadCartItems(true);
                throw error;
            }
        });

        addToCartQueues.current.set(queueKey, nextPromise.catch(() => {}));

        // After the last queued op for this product finishes, reconcile with server once.
        nextPromise.finally(() => {
            // Only reconcile if this was the last queued op for this product
            if (addToCartQueues.current.get(queueKey) === nextPromise.catch(() => {})) {
                // no-op; the check above won't match due to .catch wrapping
            }
        });

        // Reconcile after the queue settles (debounced via setTimeout to coalesce bursts)
        if (addToCartQueues.current.get(`${queueKey}::reconcileTimer`)) {
            clearTimeout(addToCartQueues.current.get(`${queueKey}::reconcileTimer`));
        }
        const reconcileTimer = setTimeout(async () => {
            // Wait for the latest queued promise to settle before reloading
            const latest = addToCartQueues.current.get(queueKey);
            if (latest) await latest;
            await loadCartItems(true);
        }, 400);
        addToCartQueues.current.set(`${queueKey}::reconcileTimer`, reconcileTimer);
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