import React, { useState, useEffect } from "react";
import { Vendor, User } from "@/entities/all";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

import VendorGrid from "./VendorGrid";
import { Household } from "@/entities/Household"; // Added import for Household

export default function KCSHome() {
  const { t } = useLanguage();
  const [vendors, setVendors] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [shoppingForHousehold, setShoppingForHousehold] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    loadData();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadData = async () => {
    try {
      const [vendorsData, userData] = await Promise.all([
        Vendor.list("-created_date"),
        User.me().catch(() => null)
      ]);
      
      const householdDataString = sessionStorage.getItem('selectedHousehold');
      if (householdDataString) {
        setSelectedHousehold(JSON.parse(householdDataString));
      }
      
      const shoppingDataString = sessionStorage.getItem('shoppingForHousehold');
      if (shoppingDataString) {
        setShoppingForHousehold(JSON.parse(shoppingDataString));
      }
      
      const isShoppingForHousehold = !!shoppingDataString;
      const userType = userData?.user_type;

      let filteredVendors = vendorsData;

      // Filtering logic for 'kcs staff' shopping for a household
      if (userType === 'kcs staff' && householdDataString) {
        const householdData = JSON.parse(householdDataString);
        if (householdData.id) {
          const household = await Household.get(householdData.id);
          if (household && household.staff_orderable_vendors && household.staff_orderable_vendors.length > 0) {
            const staffVendorIds = household.staff_orderable_vendors.map(v => v.vendor_id);
            filteredVendors = vendorsData.filter(vendor => staffVendorIds.includes(vendor.id));
          } else {
            // If no staff orderable vendors, show all vendors (default behavior)
            filteredVendors = vendorsData;
          }
        }
      }
      // Filtering logic for 'household owner'
      else if (userType === 'household owner') {
        if (userData && userData.household_id) {
          const household = await Household.get(userData.household_id);
          if (household && household.viewable_vendors) {
            const viewableVendorIds = household.viewable_vendors.map(v => v.vendor_id);
            filteredVendors = vendorsData.filter(vendor => viewableVendorIds.includes(vendor.id));
          } else {
            filteredVendors = []; 
          }
        } else {
          filteredVendors = [];
        }
      }
      // Filtering logic for admin/chief shopping for household
      else if ((userType === 'admin' || userType === 'chief of staff') && shoppingDataString) {
        const householdData = JSON.parse(shoppingDataString);
        if (householdData.id) {
          const household = await Household.get(householdData.id);
          if (household && household.staff_orderable_vendors && household.staff_orderable_vendors.length > 0) {
            const staffVendorIds = household.staff_orderable_vendors.map(v => v.vendor_id);
            filteredVendors = vendorsData.filter(vendor => staffVendorIds.includes(vendor.id));
          }
        }
      }
      // Regular customer filtering
      else if (
        userType !== 'kcs staff' &&
        userType !== 'admin' &&
        userType !== 'chief of staff' &&
        !isShoppingForHousehold
      ) {
        filteredVendors = vendorsData.filter(vendor => !vendor.kcs_exclusive);
      }
      
      // Apply filtering for testing vendors. Admins can see them, others cannot.
      if (userType !=='admin'){
        filteredVendors = filteredVendors.filter(vendor => !vendor.is_for_testing);
      }
      
      setVendors(filteredVendors);
      setUser(userData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      window.location.href = createPageUrl(`Products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Define banner heights for layout calculation, matching Layout.js
  const roleBannerHeight = (user?.user_type && user.user_type !== 'customerApp') ? 30 : 0;
  const householdBannerHeight = (user?.user_type === 'kcs staff' && selectedHousehold) ? 40 : 0;
  const shoppingBannerHeight = (['vendor', 'picker', 'admin', 'chief of staff'].includes(user?.user_type) && shoppingForHousehold) ? 40 : 0;
  const totalBannerHeight = roleBannerHeight + householdBannerHeight + shoppingBannerHeight;
  const mainHeaderHeight = 64;
  const stickyHeaderTopPosition = totalBannerHeight + mainHeaderHeight;

  // Calculate dynamic padding top for the main content section
  const sectionPaddingTop = isScrolled ? '128px' : '0px'; // Simplified from previous complex calculations

  const getPageTitle = () => {
    const householdContext = shoppingForHousehold || selectedHousehold;
    if (householdContext) {
      return t('home.titleForHousehold', { householdName: householdContext.name });
    }
    return t('home.title');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Sticky Header with Title and Search Bar */}
      <div className={`bg-white border-b fixed left-0 right-0 z-30 shadow-sm transition-all duration-300 ${
        isScrolled ? 'py-2' : 'py-4'
      }`} style={{
        top: `${stickyHeaderTopPosition}px`
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className={`font-bold text-gray-900 text-center transition-all duration-300 ${
            isScrolled ? 'text-xl mb-2' : 'text-2xl md:text-3xl mb-4'
          }`}>
            {getPageTitle()}
          </h1>
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder={t('home.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 text-base"
                />
              </div>
              <Button 
                onClick={handleSearch}
                className="bg-green-600 hover:bg-green-700"
              >
                <Search className="w-5 h-5" />
              </Button>
            </div>
          </div>
          {!user && !isScrolled && (
            <div className="text-center mt-3 transition-opacity duration-300">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 max-w-lg mx-auto">
                <p className="text-green-800 text-xs">
                  {t('home.welcomeGuestMessage')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Vendors Section - Adjust padding for the fixed banners and sticky search */}
      <section className={`pb-12 transition-all duration-300`} style={{
        paddingTop: `calc(${stickyHeaderTopPosition}px + ${sectionPaddingTop})`
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('home.shopFromLocalStores')}</h2>
                <p className="text-gray-600">{t('home.browseEverything')}</p>
            </div>
            {user?.user_type !== 'household owner' && (
              <Link to={createPageUrl("Products")}>
                <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                  {t('home.viewAllProducts')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
          <VendorGrid vendors={vendors} isLoading={isLoading} userType={user?.user_type} />
        </div>
      </section>
    </div>
  );
}