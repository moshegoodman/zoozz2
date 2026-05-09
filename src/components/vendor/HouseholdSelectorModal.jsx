import React, { useState, useEffect } from "react";
import { Household, AppSettings } from "@/entities/all";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Home, Search, Users, ShoppingCart, Phone, User as UserIcon } from "lucide-react";
import { useLanguage } from '../i18n/LanguageContext';

export default function HouseholdSelectorModal({ isOpen, onClose, onSelect, vendorId }) {
  const { t, language } = useLanguage();
  const [households, setHouseholds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeSeason, setActiveSeason] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadHouseholds();
    }
  }, [isOpen]);

  const loadHouseholds = async () => {
    setIsLoading(true);
    try {
      const [householdsData, settings] = await Promise.all([
        Household.list(),
        AppSettings.list()
      ]);
      const season = settings?.[0]?.activeSeason || "";
      setActiveSeason(season);
      setHouseholds(householdsData);
    } catch (error) {
      console.error("Error loading households:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHouseholds = households.filter(household => {
    // Filter by active season
    if (activeSeason && household.season !== activeSeason) return false;
    // Show kcs type households always, or households where this vendor is in staff_orderable_vendors
    if (vendorId) {
      const isKcs = household.household_type === 'kcs' || !household.household_type;
      const hasVendor = household.staff_orderable_vendors?.some(v => v.vendor_id === vendorId);
      if (!isKcs && !hasVendor) return false;
    }
    const q = searchQuery.toLowerCase();
    return !q ||
      household.name?.toLowerCase().includes(q) ||
      household.name_hebrew?.toLowerCase().includes(q) ||
      household.address?.toLowerCase().includes(q);
  });

  const handleSelect = (household) => {
    onSelect(household);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('vendor.householdSelector.title')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
            placeholder={t('vendor.householdSelector.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('vendor.householdSelector.loadingHouseholds')}</p>
            </div>
          )}

          {/* Households Grid */}
          {!isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredHouseholds.length > 0 ? (
                filteredHouseholds.map((household) => (
                  <button
                    key={household.id}
                    onClick={() => handleSelect(household)}
                    className="text-left border rounded-xl p-3 hover:shadow-md hover:border-green-400 transition-all bg-white flex flex-col gap-1 group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-100 group-hover:bg-green-200 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Home className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <span className="font-semibold text-sm text-gray-900 truncate" dir={language === "Hebrew" ? "rtl" : "ltr"}>
                        {language === "Hebrew" ? (household.name_hebrew || household.name) : household.name}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs bg-gray-50 px-1.5 py-0">
                        {(household.household_code || '').slice(0, 4)}
                      </Badge>
                      {household.season && (
                        <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 px-1.5 py-0">
                          {household.season}
                        </Badge>
                      )}
                    </div>
                    {household.lead_name && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 truncate">
                        <UserIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{household.lead_name}</span>
                      </div>
                    )}
                    {household.lead_phone && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{household.lead_phone}</span>
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  {searchQuery ? (
                    <>
                      <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vendor.householdSelector.noHouseholdsFound')}</h3>
                      <p className="text-gray-600">{t('vendor.householdSelector.tryAdjusting')}</p>
                    </>
                  ) : (
                    <>
                      <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vendor.householdSelector.noHouseholdsAvailable')}</h3>
                      <p className="text-gray-600">{t('vendor.householdSelector.noHouseholdsSetup')}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}