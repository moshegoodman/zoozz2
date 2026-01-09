
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Vendor } from "@/entities/Vendor";
import { Product } from "@/entities/Product";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLanguage } from "../components/i18n/LanguageContext";
import { useCart } from "../components/cart/CartContext";

import GroupedProductView from "../components/vendor/GroupedProductView";

// Function to detect if text contains Hebrew characters
const containsHebrew = (text) => {
  if (!text) return false;
  const hebrewRegex = /[\u0590-\u05FF]/; // Unicode range for Hebrew characters
  return hebrewRegex.test(text);
};

export default function VendorPage() {
  const { t, language } = useLanguage();
  const { cartItems, addToCart, updateQuantity } = useCart();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState(""); // For direct input control
  const [searchQuery, setSearchQuery] = useState(""); // Debounced value for filtering
  const [sortBy, setSortBy] = useState("name");
  const [user, setUser] = useState(null);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [activeSubcategory, setActiveSubcategory] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  // Refs for scroll-spy functionality
  const isClickScrolling = useRef(false);
  const scrollTimeout = useRef(null);
  const debounceTimer = useRef(null);

  // Custom debounce effect for search input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [inputValue]);

  // Original useEffect for initial data fetching
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const vendorId = urlParams.get("id");

    async function fetchPageData() {
      setIsLoading(true);
      if (!vendorId) {
        console.warn("No vendor ID provided in URL");
        setVendor(null);
        setProducts([]);
        setUser(null);
        setSelectedHousehold(null);
        setIsLoading(false);
        return;
      }
      try {
        let currentUser = null;
        try {
            currentUser = await User.me();
        } catch (error) {
            // User not logged in, proceed as a guest
            currentUser = null;
        }

        const [vendorData, userData] = await Promise.all([
          Vendor.filter({ id: vendorId }).then(res => res[0]),
          Promise.resolve(currentUser) // Use the already fetched user
        ]);
        
        const isPrivilegedUser = userData && ['vendor', 'admin', 'picker', 'chief of staff'].includes(userData.user_type);

        const productFilter = { vendor_id: vendorId };
        if (!isPrivilegedUser) {
            productFilter.is_draft = false;
        }

        const productsData = await Product.filter(productFilter, "-created_date");

        setVendor(vendorData);
        setProducts(productsData);
        setUser(userData);

        if (userData?.user_type === 'kcs staff' || userData?.user_type === 'chief of staff') {
          const householdData = sessionStorage.getItem('selectedHousehold');
          if (householdData) {
            setSelectedHousehold(JSON.parse(householdData));
          }
        }
      } catch (error) {
        console.error("Error loading vendor page data:", error);
        setVendor(null);
        setProducts([]);
        setUser(null);
        setSelectedHousehold(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchPageData();
  }, []);

  const handleAddToCart = async (product) => {
    await addToCart(product);
  };

  const handleUpdateQuantity = async (productId, newQuantity) => {
    const cartItem = cartItems.find(item => item.product_id === productId);
    if (cartItem) {
      await updateQuantity(cartItem.id, newQuantity);
    }
  };

  // Utility function to sanitize string for use as an HTML ID
  const sanitizeForId = (text) => {
    if (!text) return "";
    return text.replace(/\s+/g, '-').toLowerCase();
  };

  // Group and sort products using useMemo for performance
  const groupedProducts = useMemo(() => {
    let filtered = [...products];

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const isHebrewSearch = containsHebrew(searchQuery);

      filtered = filtered.filter(product => {
        // Search English fields (name, description, brand, subcategory)
        const englishMatch =
          product.name?.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower) ||
          product.brand?.toLowerCase().includes(searchLower) ||
          product.subcategory?.toLowerCase().includes(searchLower);

        // If search query contains Hebrew, also search Hebrew fields
        if (isHebrewSearch) {
          const hebrewMatch =
            product.name_hebrew?.includes(searchQuery) ||
            product.description_hebrew?.includes(searchQuery) ||
            product.brand_hebrew?.includes(searchQuery) ||
            product.subcategory_hebrew?.includes(searchQuery);
          
          return englishMatch || hebrewMatch;
        }
        
        return englishMatch;
      });
    }

    const sortFn = (a, b) => {
        const priceA = (user?.user_type === 'kcs staff' ? a.price_customer_kcs : a.price_customer_app) ?? a.price_base ?? 0;
        const priceB = (user?.user_type === 'kcs staff' ? b.price_customer_kcs : b.price_customer_app) ?? b.price_base ?? 0;
        switch (sortBy) {
            case "price_low":
                return priceA - priceB;
            case "price_high":
                return priceB - priceA;
            case "name":
                return a.name.localeCompare(b.name);
            default:
                return 0;
        }
    };

    const grouped = filtered.reduce((acc, product) => {
        const subcategory_en = product.subcategory || 'Other';
        const subcategory_he = product.subcategory_hebrew || subcategory_en;

        if (!acc[subcategory_en]) {
            acc[subcategory_en] = {
                name_hebrew: subcategory_he,
                products: []
            };
        }
        acc[subcategory_en].products.push(product);
        return acc;
    }, {});

    for (const subcategory_en in grouped) {
        grouped[subcategory_en].products.sort(sortFn);
    }

    // CRITICAL: Always prioritize admin-defined order if it exists
    if (vendor && vendor.subcategory_order && vendor.subcategory_order.length > 0) {
        const orderedGroupedProducts = {};
        
        // First, add categories in the admin-defined order
        vendor.subcategory_order.forEach(subName => {
            if (grouped[subName]) {
                orderedGroupedProducts[subName] = grouped[subName];
                delete grouped[subName]; // Remove from grouped to avoid duplication
            }
        });
        
        // Then, add any remaining categories not in the admin order (alphabetically sorted)
        const remainingKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
        remainingKeys.forEach(subName => {
            orderedGroupedProducts[subName] = grouped[subName];
        });
        
        return orderedGroupedProducts;
    }

    // Fallback: If no admin order is defined, sort alphabetically
    const sortedKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const sortedGrouped = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  }, [products, searchQuery, sortBy, user, vendor]);

  // Effect to set the first subcategory as active initially when groupedProducts are loaded
  useEffect(() => {
    const subcategories = Object.keys(groupedProducts);
    if (subcategories.length > 0 && !activeSubcategory) {
      setActiveSubcategory(subcategories[0]);
    }
  }, [groupedProducts, activeSubcategory]);

  // Handle navigation click for smooth scrolling to category section
  const handleNavClick = (e, subcategory) => {
    e.preventDefault();
    isClickScrolling.current = true; // Indicate that scrolling is initiated by a click
    setActiveSubcategory(subcategory);

    const element = document.getElementById(sanitizeForId(subcategory));
    const productsContainer = document.querySelector('.products-scroll-container');
    
    if (element && productsContainer) {
      // Scroll to the element's top position within the scrollable container
      productsContainer.scrollTo({
        top: element.offsetTop-280,
        behavior: 'smooth'
      });
    }

    // Clear any existing timeout and set a new one to reset isClickScrolling
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isClickScrolling.current = false;
    }, 1000); // Debounce to allow smooth scroll to finish (adjust as needed)
  };
  
  // Scroll-spy effect to highlight category in sidebar on scroll
  useEffect(() => {
    const productsContainer = document.querySelector('.products-scroll-container');
    if (!productsContainer || Object.keys(groupedProducts).length === 0) {
      // If no products or container not found, clear active subcategory
      setActiveSubcategory(""); 
      return;
    }

    const handleScroll = () => {
      // Prevent scroll-spy from activating if scroll was initiated by a click
      if (isClickScrolling.current) return;

      const currentScrollTop = productsContainer.scrollTop;
      // Add a small offset so categories highlight slightly before reaching the very top
      const offset = 20; 

      let foundSubcategory = '';

      // Iterate through categories and find the one whose section is currently at or just past the scroll position
      for (const subcategoryName of Object.keys(groupedProducts)) {
          const id = sanitizeForId(subcategoryName);
          const element = document.getElementById(id);

          if (element) {
              // If the current scroll position (plus offset) is at or past the top of this element,
              // then this element is the current active section (or the last one before the next).
              if (currentScrollTop + offset >= element.offsetTop) {
                  foundSubcategory = subcategoryName;
              } else {
                  // Elements are typically rendered in order. If we've passed the current element
                  // and its top is below the scroll position, then the previous one was the active one.
                  break; 
              }
          }
      }

      // If no section is found (e.g., at the very top before the first section), default to the first one
      if (!foundSubcategory && Object.keys(groupedProducts).length > 0) {
          foundSubcategory = Object.keys(groupedProducts)[0];
      }

      // Update active subcategory only if it has changed
      if (foundSubcategory && foundSubcategory !== activeSubcategory) {
          setActiveSubcategory(foundSubcategory);
      }
    };

    // Attach scroll listener
    productsContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Run once on mount/update to set initial active category based on scroll position
    handleScroll();

    // Cleanup function
    return () => {
      productsContainer.removeEventListener('scroll', handleScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [groupedProducts, activeSubcategory]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Store not found</h2>
          <Link to={createPageUrl("Home")}>
            <Button className="bg-green-600 hover:bg-green-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Get the vendor name based on language preference
  const vendorDisplayName = language === 'Hebrew' ? (vendor.name_hebrew || vendor.name) : vendor.name;

  return (
    <div className="min-h-screen bg-gray-50">
     

      {/* FIXED Search Bar - top-36 (144px) is (64px main header + 80px vendor header) */}
      <div className="bg-white border-b fixed top-30 left-0 right-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex items-center justify-between gap-4">
                  
                 
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            {(user?.user_type !== 'vendor' && user?.user_type !== 'picker') && (
              <Link to={createPageUrl("Home")}>
                <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0">
                  {language === 'Hebrew' ? (
                    <ArrowRight className="w-5 h-5" />
                  ) : (
                    <ArrowLeft className="w-5 h-5" />
                  )}
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{vendorDisplayName}</h1>
              {user?.user_type === 'kcs staff' && selectedHousehold && (
                <p className="text-sm text-purple-600">Shopping for {selectedHousehold.name}</p>
              )}
              <p className="text-sm text-gray-600 line-clamp-1">{vendor.description}</p>
            </div>
                  
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder={language === 'Hebrew' 
                  ? `חיפוש מוצרים ב${vendorDisplayName}...`
                  : `Search products in ${vendorDisplayName}...`
                }
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="pl-10"
                style={{ direction: containsHebrew(inputValue) ? 'rtl' : 'ltr' }}
              />
            </div>

          </div>

          {/* Mobile Category Scroller */}
          <div className="md:hidden mt-4 -mx-4 px-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <div className="flex items-center space-x-2 pb-2">
              {Object.keys(groupedProducts).length > 0 ? (
                Object.keys(groupedProducts).map(sub => {
                  const displayName = language === 'Hebrew' ? 
                    (groupedProducts[sub].name_hebrew || sub) : sub;
                  const isHebrew = language === 'Hebrew';
                  
                  return (
                    <button
                      key={sub}
                      onClick={(e) => handleNavClick(e, sub)}
                      className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors duration-150 ${
                        activeSubcategory === sub
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      style={{
                        direction: isHebrew ? 'rtl' : 'ltr'
                      }}
                    >
                      <span className="capitalize">{displayName}</span>
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-gray-500 w-full text-center">No categories found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content with proper padding for fixed headers
          Total fixed header height: (main app header 64px + vendor header 80px + search bar ~64px) = ~208px.
          pt-56 (224px) gives sufficient space.
          On mobile, the search bar and new category scroller are taller, so we need more padding (pt-80).
      */}
     
      <div   className="w-full min-h-screen  px-4 sm:px-6 lg:px-8 sm:pt-15   pb-8">
        {/* Main Container with Cart-like Structure */}
        <div className="w-full bg-white rounded-none shadow-none border-none overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {t('vendor.productsFrom')} {vendorDisplayName}
              </h2>
            </div>
          </div>

          {/* Main Content - Using VendorCartSection Grid Structure */}
          <div className="grid grid-cols-1 lg:grid-cols-7 md:grid-cols-7 min-h-[600px]">
            {/* Categories Sidebar - Left Side (1/5 width on desktop)actually 1/7 */}
            <div className="hidden md:block lg:col-span-1 md:col-span-1 p-4 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-800 mb-4">
                {language === 'Hebrew' ? 'קטגוריות' : 'Categories'}
              </h3>
              {/* Scrollable categories container */}
              <div
                className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
              >
                <ul className="space-y-1">
                  {Object.keys(groupedProducts).length > 0 ? (
                    Object.keys(groupedProducts).map(sub => {
                      const displayName = language === 'Hebrew' ? 
                        (groupedProducts[sub].name_hebrew || sub) : sub;
                      const isHebrew = language === 'Hebrew';
                      
                      return (
                        <li key={sub}>
                          <a
                            href={`#${sanitizeForId(sub)}`}
                            onClick={(e) => handleNavClick(e, sub)}
                            className={`block px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                              activeSubcategory === sub
                                ? 'bg-green-100 text-green-700 font-semibold'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            style={{
                              direction: isHebrew ? 'rtl' : 'ltr',
                              textAlign: isHebrew ? 'right' : 'left'
                            }}
                          >
                            <span className="capitalize">{displayName}</span>
                          </a>
                        </li>
                      );
                    })
                  ) : (
                    <li className="px-3 py-2 text-sm text-gray-500">No categories found.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Products Grid - Right Side (4/5 width on desktop)actually 6/7 */}
            <div className="lg:col-span-6 md:col-span-6 p-4">
              <div className="max-h-[600px] overflow-y-auto products-scroll-container scroll-smooth">
                <GroupedProductView
                  groupedProducts={groupedProducts}
                  isLoading={isLoading}
                  userType={user?.user_type}
                  sanitizeForId={sanitizeForId}
                  selectedHousehold={selectedHousehold}
                  viewMode={viewMode}
                  hideVendorInfoInProductCard={true}
                  onAddToCart={handleAddToCart}
                  onUpdateQuantity={handleUpdateQuantity}
                  cartItems={cartItems}
                  vendor={vendor}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
