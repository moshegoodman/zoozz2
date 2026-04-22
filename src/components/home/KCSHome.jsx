import React, { useState, useEffect } from "react";
import { Vendor, User } from "@/entities/all";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "../i18n/LanguageContext";

import VendorGrid from "./VendorGrid";
import { Household } from "@/entities/Household";

export default function KCSHome() {
  const { t } = useLanguage();
  const [vendors, setVendors] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [shoppingForHousehold, setShoppingForHousehold] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // Household owner season switching
  const [ownerHouseholds, setOwnerHouseholds] = useState([]);
  const [activeOwnerHouseholdId, setActiveOwnerHouseholdId] = useState(null);

  useEffect(() => {
    loadData();

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // When household owner switches season, reload vendors for new household
  useEffect(() => {
    if (activeOwnerHouseholdId && user?.user_type === 'household owner') {
      loadVendorsForOwnerHousehold(activeOwnerHouseholdId);
    }
  }, [activeOwnerHouseholdId]);

  const loadVendorsForOwnerHousehold = async (householdId) => {
    setIsLoading(true);
    try {
      const [vendorsData, household] = await Promise.all([
      Vendor.list("-created_date"),
      Household.get(householdId)]
      );
      if (household && household.viewable_vendors) {
        const viewableVendorIds = household.viewable_vendors.map((v) => v.vendor_id);
        setVendors(vendorsData.filter((v) => viewableVendorIds.includes(v.id) && !v.is_for_testing));
      } else {
        setVendors([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [vendorsData, userData] = await Promise.all([
      Vendor.list("-created_date"),
      User.me().catch(() => null)]
      );

      const householdDataString = localStorage.getItem('selectedHousehold') || sessionStorage.getItem('selectedHousehold');
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
            const staffVendorIds = household.staff_orderable_vendors.map((v) => v.vendor_id);
            filteredVendors = vendorsData.filter((vendor) => staffVendorIds.includes(vendor.id));
          } else {
            filteredVendors = vendorsData;
          }
        }
      }
      // Filtering logic for 'household owner'
      else if (userType === 'household owner') {
        const allHouseholdIds = userData.household_ids?.length ? userData.household_ids : userData.household_id ? [userData.household_id] : [];

        if (allHouseholdIds.length > 0) {
          // Load all households for the season switcher
          const allHouseholds = await Promise.all(allHouseholdIds.map((id) => Household.get(id).catch(() => null)));
          const validHouseholds = allHouseholds.filter(Boolean);
          setOwnerHouseholds(validHouseholds);

          // Default to the primary household_id (current season)
          const primaryId = userData.household_id || allHouseholdIds[0];
          setActiveOwnerHouseholdId(primaryId);

          const primaryHousehold = validHouseholds.find((h) => h.id === primaryId) || validHouseholds[0];
          if (primaryHousehold && primaryHousehold.viewable_vendors) {
            const viewableVendorIds = primaryHousehold.viewable_vendors.map((v) => v.vendor_id);
            filteredVendors = vendorsData.filter((vendor) => viewableVendorIds.includes(vendor.id));
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
            const staffVendorIds = household.staff_orderable_vendors.map((v) => v.vendor_id);
            filteredVendors = vendorsData.filter((vendor) => staffVendorIds.includes(vendor.id));
          }
        }
      }
      // Regular customer filtering
      else if (
      userType !== 'kcs staff' &&
      userType !== 'admin' &&
      userType !== 'chief of staff' &&
      !isShoppingForHousehold)
      {
        filteredVendors = vendorsData.filter((vendor) => !vendor.kcs_exclusive);
      }

      // Apply filtering for testing vendors. Admins can see them, others cannot.
      if (userType !== 'admin') {
        filteredVendors = filteredVendors.filter((vendor) => !vendor.is_for_testing);
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
  const roleBannerHeight = user?.user_type && user.user_type !== 'customerApp' ? 30 : 0;
  const householdBannerHeight = (user?.user_type === 'kcs staff' || user?.user_type === 'household owner') && selectedHousehold ? 40 : 0;
  const shoppingBannerHeight = ['vendor', 'picker', 'admin', 'chief of staff'].includes(user?.user_type) && shoppingForHousehold ? 40 : 0;
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
      
    
      <div className="px-4 max-w-7xl mx-auto sm:px-6 lg:px-8" style={{ paddingTop: `${stickyHeaderTopPosition}px` }}>
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('home.shopFromLocalStores')}</h2>
                <p className="text-gray-600">{t('home.browseEverything')}</p>
            </div>
            {user?.user_type === 'household owner' && ownerHouseholds.length > 1 &&
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">Season:</span>
                <Select value={activeOwnerHouseholdId} onValueChange={setActiveOwnerHouseholdId}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerHouseholds.map((h) =>
                  <SelectItem key={h.id} value={h.id}>
                        {h.season || h.name}
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>
            }
          </div>
          <VendorGrid vendors={vendors} isLoading={isLoading} userType={user?.user_type} />
        </div>
    </div>);

}